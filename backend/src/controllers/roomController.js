const express = require('express');
const Room = require('../models/Room');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Generate room code
const generateRoomCode = () => {
  return uuidv4().substring(0, 6).toUpperCase();
};

// Create room
router.post('/create', auth, async (req, res) => {
  try {
    const { maxPlayers, impostorCount, gameMode } = req.body;
    const roomCode = generateRoomCode();

    const room = new Room({
      roomCode,
      host: req.userId,
      players: [{
        userId: req.userId,
        username: req.username,
        isImposter: false,
        cards: {},
        revealedCards: {},
        isAlive: true,
        hasVoted: false
      }],
      settings: {
        maxPlayers: maxPlayers || 10,
        impostorCount: impostorCount || 1,
        gameMode: gameMode || 'mixed'
      }
    });

    await room.save();
    res.status(201).json({ roomCode, roomId: room._id });
  } catch (error) {
    console.error('Room creation error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Update room settings (for host)
router.patch('/:roomId/settings', auth, async (req, res) => {
  try {
    const { gameMode, impostorCount } = req.body;
    
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.host.toString() !== req.userId) {
      return res.status(403).json({ error: 'Only host can change settings' });
    }

    if (room.gameState !== 'waiting') {
      return res.status(400).json({ error: 'Cannot change settings after game started' });
    }

    if (gameMode) room.settings.gameMode = gameMode;
    if (impostorCount) room.settings.impostorCount = impostorCount;

    await room.save();
    res.json({ settings: room.settings });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Join room
router.post('/join', auth, async (req, res) => {
  try {
    const { roomCode } = req.body;

    const room = await Room.findOne({ 
      roomCode: roomCode.toUpperCase(),
      gameState: 'waiting'
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found or game already started' });
    }

    if (room.players.length >= room.settings.maxPlayers) {
      return res.status(400).json({ error: 'Room is full' });
    }

    const existingPlayer = room.players.find(p => p.userId.toString() === req.userId);
    if (existingPlayer) {
      return res.status(400).json({ error: 'Already in this room' });
    }

    room.players.push({
      userId: req.userId,
      username: req.username,
      isImposter: false,
      cards: {},
      revealedCards: {},
      isAlive: true,
      hasVoted: false
    });

    await room.save();
    res.json({ roomId: room._id, roomCode: room.roomCode });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Get room details
router.get('/:roomId', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to get room details' });
  }
});

module.exports = router;