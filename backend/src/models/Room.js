const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  players: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    isImposter: { type: Boolean, default: false },
    cards: {
      troop: String,
      spell: String,
      building: String
    },
    revealedCards: {
      troop: { type: Boolean, default: false },
      spell: { type: Boolean, default: false },
      building: { type: Boolean, default: false }
    },
    isAlive: { type: Boolean, default: true },
    votes: { type: Number, default: 0 }
  }],
  settings: {
    maxPlayers: { type: Number, default: 10, min: 4, max: 20 },
    impostorCount: { type: Number, default: 1, min: 1, max: 3 },
    votingTime: { type: Number, default: 60 }
  },
  gameState: {
    type: String,
    enum: ['waiting', 'playing', 'voting', 'ended'],
    default: 'waiting'
  },
  currentRound: {
    type: Number,
    default: 0
  },
  winner: {
    type: String,
    enum: ['imposters', 'crewmates', null],
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 7200 // Room expires after 2 hours
  }
});

module.exports = mongoose.model('Room', roomSchema);