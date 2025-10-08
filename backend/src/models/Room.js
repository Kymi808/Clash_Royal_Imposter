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
    votes: { type: Number, default: 0 },
    hasVoted: { type: Boolean, default: false },
    votedFor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  }],
  settings: {
    maxPlayers: { type: Number, default: 10, min: 3, max: 11 },
    impostorCount: { type: Number, default: 1, min: 1, max: 3 },
    votingTime: { type: Number, default: 60 },
    gameMode: { 
      type: String, 
      enum: ['troops', 'spells', 'buildings', 'mixed'],
      default: 'mixed'
    }
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
  votingEndTime: {
    type: Date,
    default: null
  },
  winner: {
    type: String,
    enum: ['imposters', 'crewmates', null],
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 7200
  }
});

module.exports = mongoose.model('Room', roomSchema);