const Room = require('../models/Room');
const { getRandomCards } = require('../utils/clashRoyaleData');

class GameService {
  async handlePlayerJoin(io, socket, roomId, userId, username) {
    try {
      const room = await Room.findById(roomId);
      if (!room) return;

      io.to(roomId).emit('player-joined', {
        players: room.players,
        newPlayer: { userId, username }
      });
    } catch (error) {
      console.error('Error handling player join:', error);
    }
  }

  async startGame(io, roomId, impostorCount) {
    try {
      const room = await Room.findById(roomId);
      if (!room || room.gameState !== 'waiting') return;

      // Validate player count
      if (room.players.length < 4) {
        io.to(roomId).emit('game-error', { message: 'Need at least 4 players to start' });
        return;
      }

      // Randomly select imposters
      const playerIndices = [...Array(room.players.length).keys()];
      const shuffled = playerIndices.sort(() => Math.random() - 0.5);
      const imposterIndices = shuffled.slice(0, impostorCount);

      // Assign cards to all players
      const imposterCards = getRandomCards();
      const crewmateCards = getRandomCards();

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
      });

      room.gameState = 'playing';
      room.currentRound = 1;
      await room.save();

      // Send game start event with player-specific data
      room.players.forEach((player) => {
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
            }))
          });
        }
      });

      io.to(roomId).emit('game-state-update', {
        gameState: 'playing',
        round: room.currentRound
      });
    } catch (error) {
      console.error('Error starting game:', error);
    }
  }

  async revealCard(io, roomId, userId, cardType) {
    try {
      const room = await Room.findById(roomId);
      if (!room || room.gameState !== 'playing') return;

      const player = room.players.find(p => p.userId.toString() === userId);
      if (!player || !player.isAlive) return;

      if (!player.revealedCards[cardType]) {
        player.revealedCards[cardType] = true;
        await room.save();

        io.to(roomId).emit('card-revealed', {
          userId,
          cardType,
          card: player.cards[cardType]
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
          this.startVotingPhase(io, roomId);
        }
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
      room.players.forEach(p => p.votes = 0);
      await room.save();

      io.to(roomId).emit('voting-started', {
        votingTime: room.settings.votingTime
      });

      // Auto-end voting after time limit
      setTimeout(() => this.endVoting(io, roomId), room.settings.votingTime * 1000);
    } catch (error) {
      console.error('Error starting voting phase:', error);
    }
  }

  async handleVote(io, roomId, voterId, targetId) {
    try {
      const room = await Room.findById(roomId);
      if (!room || room.gameState !== 'voting') return;

      const voter = room.players.find(p => p.userId.toString() === voterId);
      const target = room.players.find(p => p.userId.toString() === targetId);

      if (!voter || !voter.isAlive || !target || !target.isAlive) return;

      target.votes++;
      await room.save();

      io.to(roomId).emit('vote-cast', {
        voterId,
        targetId,
        votes: room.players.map(p => ({
          userId: p.userId,
          votes: p.votes
        }))
      });
    } catch (error) {
      console.error('Error handling vote:', error);
    }
  }

  async endVoting(io, roomId) {
    try {
      const room = await Room.findById(roomId);
      if (!room || room.gameState !== 'voting') return;

      // Find player with most votes
      const alivePlayers = room.players.filter(p => p.isAlive);
      let maxVotes = 0;
      let eliminatedPlayer = null;

      alivePlayers.forEach(player => {
        if (player.votes > maxVotes) {
          maxVotes = player.votes;
          eliminatedPlayer = player;
        }
      });

      if (eliminatedPlayer && maxVotes > 0) {
        eliminatedPlayer.isAlive = false;
        
        io.to(roomId).emit('player-eliminated', {
          userId: eliminatedPlayer.userId,
          username: eliminatedPlayer.username,
          wasImposter: eliminatedPlayer.isImposter
        });
      }

      // Check win conditions
      const aliveImposters = room.players.filter(p => p.isAlive && p.isImposter);
      const aliveCrewmates = room.players.filter(p => p.isAlive && !p.isImposter);

      if (aliveImposters.length === 0) {
        room.gameState = 'ended';
        room.winner = 'crewmates';
        io.to(roomId).emit('game-ended', { winner: 'crewmates' });
      } else if (aliveImposters.length >= aliveCrewmates.length) {
        room.gameState = 'ended';
        room.winner = 'imposters';
        io.to(roomId).emit('game-ended', { winner: 'imposters' });
      } else {
        // Continue to next round
        room.gameState = 'playing';
        room.currentRound++;
        room.players.forEach(p => {
          p.votes = 0;
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