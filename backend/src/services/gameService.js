const Room = require('../models/Room');
const User = require('../models/User');
const { getRandomCard } = require('../utils/clashRoyaleData');

class GameService {
  constructor() {
    this.votingTimers = new Map();
  }

  async handlePlayerJoin(io, socket, roomId, userId, username) {
    try {
      const room = await Room.findById(roomId);
      if (!room) return;

      // Check if game is already in progress
      if (room.gameState === 'playing' || room.gameState === 'voting') {
        const player = room.players.find(p => p.userId.toString() === userId);
        
        if (player && player.card) {
          console.log(`Sending card to rejoining player ${username}`);
          
          // Send their card to the rejoining player
          socket.emit('your-card', {
            card: player.card
          });

          // Send game state
          socket.emit('game-state-update', {
            gameState: room.gameState,
            round: room.currentRound,
            gameMode: room.settings.gameMode
          });

          // Send who has revealed (but NOT their cards)
          const revealedPlayers = room.players
            .filter(p => p.hasRevealed)
            .map(p => p.userId);
          
          socket.emit('revealed-players', {
            revealedPlayers
          });
        }
      }

      io.to(roomId).emit('player-joined', {
        players: room.players,
        newPlayer: { userId, username },
        settings: room.settings
      });
    } catch (error) {
      console.error('Error handling player join:', error);
    }
  }

  async startGame(io, roomId, impostorCount) {
    try {
      const room = await Room.findById(roomId);
      if (!room || room.gameState !== 'waiting') {
        console.log('Cannot start game - invalid state or room not found');
        return;
      }

      if (room.players.length < 3) {
        io.to(roomId).emit('game-error', { message: 'Need at least 3 players to start' });
        return;
      }

      const maxImposters = Math.floor(room.players.length / 2);
      const actualImpostorCount = Math.min(impostorCount, maxImposters);

      const playerIndices = [...Array(room.players.length).keys()];
      const shuffled = playerIndices.sort(() => Math.random() - 0.5);
      const imposterIndices = shuffled.slice(0, actualImpostorCount);

      const gameMode = room.settings.gameMode || 'mixed';
      console.log(`Starting game with mode: ${gameMode}, imposters: ${actualImpostorCount}`);

      // Get cards for imposters and crewmates
      const imposterCard = getRandomCard(gameMode);
      let crewmateCard = getRandomCard(gameMode);
      
      // Make sure imposters have different card
      while (imposterCard === crewmateCard) {
        crewmateCard = getRandomCard(gameMode);
      }

      // Assign cards to players and increment games played
      for (let i = 0; i < room.players.length; i++) {
        const player = room.players[i];
        player.isImposter = imposterIndices.includes(i);
        player.card = player.isImposter ? imposterCard : crewmateCard;
        player.hasRevealed = false;
        player.isAlive = true;
        player.votes = 0;
        player.hasVoted = false;
        player.votedFor = null;

        // Increment games played for each player
        await User.findByIdAndUpdate(player.userId, {
          $inc: { 'stats.gamesPlayed': 1 }
        });
      }

      room.gameState = 'playing';
      room.currentRound = 1;
      room.winner = null;
      await room.save();

      // Send game start
      io.to(roomId).emit('game-started', {
        players: room.players.map(p => ({
          userId: p.userId,
          username: p.username,
          isAlive: p.isAlive,
          hasRevealed: p.hasRevealed
        })),
        actualImpostorCount: actualImpostorCount,
        gameMode: gameMode
      });

      // Send individual cards to each player
      for (const player of room.players) {
        const playerSockets = [...io.sockets.sockets.values()]
          .filter(s => s.userId === player.userId.toString());
        
        playerSockets.forEach(socket => {
          console.log(`Sending card to ${player.username}: ${player.card}`);
          socket.emit('your-card', {
            card: player.card
          });
        });
      }

      io.to(roomId).emit('game-state-update', {
        gameState: 'playing',
        round: room.currentRound,
        gameMode: gameMode
      });

      console.log('Game started successfully');
    } catch (error) {
      console.error('Error starting game:', error);
      io.to(roomId).emit('game-error', { message: 'Failed to start game' });
    }
  }

  async revealCard(io, roomId, userId) {
    try {
      console.log(`RevealCard called - Room: ${roomId}, User: ${userId}`);
      
      const room = await Room.findById(roomId);
      if (!room) {
        console.log('Room not found');
        return;
      }
      
      if (room.gameState !== 'playing') {
        console.log(`Invalid game state: ${room.gameState}`);
        return;
      }

      const player = room.players.find(p => p.userId.toString() === userId);
      if (!player) {
        console.log(`Player not found for userId: ${userId}`);
        return;
      }
      
      if (!player.isAlive) {
        console.log('Player is not alive');
        return;
      }

      if (player.hasRevealed) {
        console.log('Card already revealed');
        return;
      }

      player.hasRevealed = true;
      await room.save();

      console.log(`${player.username} revealed their card (privately)`);
      
      // Only tell everyone that the player revealed, NOT what their card is
      io.to(roomId).emit('player-revealed', {
        userId: player.userId,
        username: player.username
      });

      // Check if all alive players have revealed
      const allRevealed = room.players
        .filter(p => p.isAlive)
        .every(p => p.hasRevealed);

      if (allRevealed) {
        console.log('All players have revealed, starting voting phase');
        setTimeout(() => this.startVotingPhase(io, roomId), 2000);
      }
    } catch (error) {
      console.error('Error revealing card:', error);
    }
  }

  async startVotingPhase(io, roomId) {
    try {
      const room = await Room.findById(roomId);
      if (!room) return;

      room.gameState = 'voting';
      room.players.forEach(p => {
        p.votes = 0;
        p.hasVoted = false;
        p.votedFor = null;
      });
      
      const votingEndTime = new Date(Date.now() + room.settings.votingTime * 1000);
      room.votingEndTime = votingEndTime;
      
      await room.save();

      io.to(roomId).emit('voting-started', {
        votingTime: room.settings.votingTime,
        votingEndTime: votingEndTime
      });

      if (this.votingTimers.has(roomId)) {
        clearTimeout(this.votingTimers.get(roomId));
      }

      const timer = setTimeout(() => {
        this.endVoting(io, roomId);
        this.votingTimers.delete(roomId);
      }, room.settings.votingTime * 1000);

      this.votingTimers.set(roomId, timer);
    } catch (error) {
      console.error('Error starting voting phase:', error);
    }
  }

  async handleVote(io, roomId, voterId, targetId) {
    try {
      const room = await Room.findById(roomId);
      if (!room || room.gameState !== 'voting') return;

      const voter = room.players.find(p => p.userId.toString() === voterId);
      if (!voter || !voter.isAlive || voter.hasVoted) return;

      if (targetId === 'skip') {
        voter.hasVoted = true;
        voter.votedFor = null;
      } else {
        const target = room.players.find(p => p.userId.toString() === targetId);
        if (!target || !target.isAlive) return;

        if (voter.votedFor) {
          const previousTarget = room.players.find(p => p.userId.equals(voter.votedFor));
          if (previousTarget) {
            previousTarget.votes--;
          }
        }

        target.votes++;
        voter.hasVoted = true;
        voter.votedFor = target.userId;

        // Increment total votes stat
        await User.findByIdAndUpdate(voterId, {
          $inc: { 'stats.totalVotes': 1 }
        });
      }

      await room.save();

      io.to(roomId).emit('vote-cast', {
        voterId,
        targetId,
        votes: room.players.map(p => ({
          userId: p.userId,
          votes: p.votes
        })),
        votersCount: room.players.filter(p => p.isAlive && p.hasVoted).length,
        aliveCount: room.players.filter(p => p.isAlive).length
      });

      const allVoted = room.players
        .filter(p => p.isAlive)
        .every(p => p.hasVoted);

      if (allVoted) {
        if (this.votingTimers.has(roomId)) {
          clearTimeout(this.votingTimers.get(roomId));
          this.votingTimers.delete(roomId);
        }
        this.endVoting(io, roomId);
      }
    } catch (error) {
      console.error('Error handling vote:', error);
    }
  }

  async endVoting(io, roomId) {
    try {
      const room = await Room.findById(roomId);
      if (!room || room.gameState !== 'voting') return;

      const alivePlayers = room.players.filter(p => p.isAlive);
      let maxVotes = 0;
      
      alivePlayers.forEach(player => {
        if (player.votes > maxVotes) {
          maxVotes = player.votes;
        }
      });

      if (maxVotes > 0) {
        const playersWithMaxVotes = alivePlayers.filter(p => p.votes === maxVotes);
        
        if (playersWithMaxVotes.length === 1) {
          const eliminatedPlayer = playersWithMaxVotes[0];
          eliminatedPlayer.isAlive = false;
          
          io.to(roomId).emit('player-eliminated', {
            userId: eliminatedPlayer.userId,
            username: eliminatedPlayer.username,
            wasImposter: eliminatedPlayer.isImposter
          });
        } else {
          io.to(roomId).emit('voting-tied', {
            message: `Vote was tied between ${playersWithMaxVotes.length} players. No one was eliminated.`,
            tiedPlayers: playersWithMaxVotes.map(p => p.username)
          });
        }
      } else {
        io.to(roomId).emit('vote-skipped', {
          message: 'No votes were cast. Proceeding to next round.'
        });
      }

      const aliveImposters = room.players.filter(p => p.isAlive && p.isImposter);
      const aliveCrewmates = room.players.filter(p => p.isAlive && !p.isImposter);

      if (aliveImposters.length === 0) {
        room.gameState = 'ended';
        room.winner = 'crewmates';
        
        // Update win stats for crewmates
        for (const player of room.players) {
          if (!player.isImposter) {
            await User.findByIdAndUpdate(player.userId, {
              $inc: { 'stats.gamesWonAsCrewmate': 1 }
            });
          }
        }

        io.to(roomId).emit('game-ended', { 
          winner: 'crewmates',
          imposters: room.players.filter(p => p.isImposter).map(p => ({
            userId: p.userId,
            username: p.username
          })),
          allCards: room.players.map(p => ({
            userId: p.userId,
            username: p.username,
            card: p.card,
            wasImposter: p.isImposter
          }))
        });
      } else if (aliveImposters.length >= aliveCrewmates.length) {
        room.gameState = 'ended';
        room.winner = 'imposters';
        
        // Update win stats for imposters
        for (const player of room.players) {
          if (player.isImposter) {
            await User.findByIdAndUpdate(player.userId, {
              $inc: { 'stats.gamesWonAsImposter': 1 }
            });
          }
        }

        io.to(roomId).emit('game-ended', { 
          winner: 'imposters',
          imposters: room.players.filter(p => p.isImposter).map(p => ({
            userId: p.userId,
            username: p.username
          })),
          allCards: room.players.map(p => ({
            userId: p.userId,
            username: p.username,
            card: p.card,
            wasImposter: p.isImposter
          }))
        });
      } else {
        // Continue to next round
        room.gameState = 'playing';
        room.currentRound++;
        room.votingEndTime = null;
        room.players.forEach(p => {
          p.votes = 0;
          p.hasVoted = false;
          p.votedFor = null;
          if (p.isAlive) {
            p.hasRevealed = false;
          }
        });

        io.to(roomId).emit('new-round', {
          round: room.currentRound
        });
      }

      await room.save();
    } catch (error) {
      console.error('Error ending voting:', error);
    }
  }

  async resetGame(io, roomId) {
    try {
      const room = await Room.findById(roomId);
      if (!room) return;

      // Reset room to waiting state
      room.gameState = 'waiting';
      room.currentRound = 0;
      room.winner = null;
      room.votingEndTime = null;

      // Reset all players
      room.players.forEach(p => {
        p.isImposter = false;
        p.card = null;
        p.hasRevealed = false;
        p.isAlive = true;
        p.votes = 0;
        p.hasVoted = false;
        p.votedFor = null;
      });

      await room.save();

      io.to(roomId).emit('game-reset', {
        players: room.players.map(p => ({
          userId: p.userId,
          username: p.username
        }))
      });

      console.log(`Game reset for room ${roomId}`);
    } catch (error) {
      console.error('Error resetting game:', error);
    }
  }

  async handlePlayerLeave(io, roomId, userId) {
    try {
      const room = await Room.findById(roomId);
      if (!room) return;

      room.players = room.players.filter(p => p.userId.toString() !== userId);
      
      if (room.players.length === 0) {
        if (this.votingTimers.has(roomId)) {
          clearTimeout(this.votingTimers.get(roomId));
          this.votingTimers.delete(roomId);
        }
        await Room.findByIdAndDelete(roomId);
      } else {
        if (room.host.toString() === userId) {
          room.host = room.players[0].userId;
        }
        await room.save();
      }

      io.to(roomId).emit('player-left', { userId });
    } catch (error) {
      console.error('Error handling player leave:', error);
    }
  }

  async updateSettings(io, roomId, settings) {
    try {
      const room = await Room.findById(roomId);
      if (!room) return;

      Object.assign(room.settings, settings);
      await room.save();

      io.to(roomId).emit('settings-updated', {
        settings: room.settings
      });
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  }
}

module.exports = new GameService();
