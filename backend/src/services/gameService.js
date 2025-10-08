const Room = require('../models/Room');
const { getRandomCards } = require('../utils/clashRoyaleData');

class GameService {
  constructor() {
    this.votingTimers = new Map();
  }

  async handlePlayerJoin(io, socket, roomId, userId, username) {
    try {
      const room = await Room.findById(roomId);
      if (!room) return;

      io.to(roomId).emit('player-joined', {
        players: room.players,
        newPlayer: { userId, username },
        settings: room.settings
      });
    } catch (error) {
      console.error('Error handling player join:', error);
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

  async startGame(io, roomId, impostorCount) {
    try {
      const room = await Room.findById(roomId);
      if (!room || room.gameState !== 'waiting') {
        console.log('Cannot start game - invalid state or room not found');
        return;
      }

      // Allow 3 players minimum
      if (room.players.length < 3) {
        io.to(roomId).emit('game-error', { message: 'Need at least 3 players to start' });
        return;
      }

      // Adjust imposter count if necessary
      const maxImposters = Math.floor(room.players.length / 2);
      const actualImpostorCount = Math.min(impostorCount, maxImposters);

      // Randomly select imposters
      const playerIndices = [...Array(room.players.length).keys()];
      const shuffled = playerIndices.sort(() => Math.random() - 0.5);
      const imposterIndices = shuffled.slice(0, actualImpostorCount);

      // Get game mode from room settings
      const gameMode = room.settings.gameMode || 'mixed';
      console.log(`Starting game with mode: ${gameMode}, imposters: ${actualImpostorCount}`);

      // Assign cards based on game mode
      const imposterCards = getRandomCards(gameMode);
      const crewmateCards = getRandomCards(gameMode);

      // Make sure imposters have different cards than crewmates
      while (JSON.stringify(imposterCards) === JSON.stringify(crewmateCards)) {
        crewmateCards = getRandomCards(gameMode);
      }

      room.players.forEach((player, index) => {
        player.isImposter = imposterIndices.includes(index);
        player.cards = player.isImposter ? imposterCards : crewmateCards;
        player.revealedCards = {
          troop: false,
          spell: false,
          building: false
        };
        player.isAlive = true;
        player.votes = 0;
        player.hasVoted = false;
        player.votedFor = null;
      });

      room.gameState = 'playing';
      room.currentRound = 1;
      await room.save();

      // Send game start event with player-specific data
      for (const player of room.players) {
        const playerSocket = [...io.sockets.sockets.values()]
          .find(s => s.userId === player.userId.toString());
        
        if (playerSocket) {
          playerSocket.emit('game-started', {
            isImposter: player.isImposter,
            cards: player.cards,
            players: room.players.map(p => ({
              userId: p.userId,
              username: p.username,
              isAlive: p.isAlive,
              revealedCards: p.revealedCards
            })),
            actualImpostorCount: actualImpostorCount,
            gameMode: gameMode
          });
          console.log(`Sent game-started to ${player.username} with cards:`, player.cards);
        }
      }

      io.to(roomId).emit('game-state-update', {
        gameState: 'playing',
        round: room.currentRound,
        gameMode: gameMode
      });
    } catch (error) {
      console.error('Error starting game:', error);
      io.to(roomId).emit('game-error', { message: 'Failed to start game' });
    }
  }

  async revealCard(io, roomId, userId, cardType) {
    try {
      console.log(`Revealing card - Room: ${roomId}, User: ${userId}, CardType: ${cardType}`);
      
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
        console.log('Player not found');
        return;
      }
      
      if (!player.isAlive) {
        console.log('Player is not alive');
        return;
      }

      if (!player.cards || !player.cards[cardType]) {
        console.log('Player cards not found:', player.cards);
        return;
      }

      if (!player.revealedCards[cardType]) {
        player.revealedCards[cardType] = true;
        await room.save();

        console.log(`Card revealed: ${player.cards[cardType]}`);
        
        io.to(roomId).emit('card-revealed', {
          userId,
          cardType,
          card: player.cards[cardType],
          username: player.username
        });

        // Check if discussion phase should start
        const allRevealed = room.players
          .filter(p => p.isAlive)
          .every(p => 
            p.revealedCards.troop || 
            p.revealedCards.spell || 
            p.revealedCards.building
          );

        if (allRevealed) {
          console.log('All cards revealed, starting voting phase');
          this.startVotingPhase(io, roomId);
        }
      } else {
        console.log('Card already revealed');
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
      let eliminatedPlayers = [];

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
          eliminatedPlayers = [eliminatedPlayer];
          
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
        io.to(roomId).emit('game-ended', { 
          winner: 'crewmates',
          imposters: room.players.filter(p => p.isImposter).map(p => ({
            userId: p.userId,
            username: p.username
          }))
        });
      } else if (aliveImposters.length >= aliveCrewmates.length) {
        room.gameState = 'ended';
        room.winner = 'imposters';
        io.to(roomId).emit('game-ended', { 
          winner: 'imposters',
          imposters: room.players.filter(p => p.isImposter).map(p => ({
            userId: p.userId,
            username: p.username
          }))
        });
      } else {
        room.gameState = 'playing';
        room.currentRound++;
        room.votingEndTime = null;
        room.players.forEach(p => {
          p.votes = 0;
          p.hasVoted = false;
          p.votedFor = null;
          if (p.isAlive) {
            p.revealedCards = {
              troop: false,
              spell: false,
              building: false
            };
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
}

module.exports = new GameService();