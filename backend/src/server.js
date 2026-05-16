const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const authController = require('./controllers/authController');
const roomController = require('./controllers/roomController');
const gameService = require('./services/gameService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://192.168.1.66:3000',
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  transports: ['polling', 'websocket'], // Allow both
  allowEIO3: true // Compatibility flag
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://192.168.1.66:3000',
  credentials: true
}));
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authController);
app.use('/api/rooms', roomController);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('join-room', async (data) => {
    const { roomId, userId, username } = data;
    console.log(`User ${username} (${userId}) joining room ${roomId}`);
    
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userId = userId;
    socket.username = username;

    await gameService.handlePlayerJoin(io, socket, roomId, userId, username);
  });

  socket.on('update-settings', async (data) => {
    const { roomId, settings } = data;
    await gameService.updateSettings(io, roomId, settings);
  });

  socket.on('start-game', async (data) => {
    const { roomId, impostorCount } = data;
    console.log(`Starting game in room ${roomId} with ${impostorCount} imposters`);
    await gameService.startGame(io, roomId, impostorCount);
  });

  socket.on('reveal-card', async (data) => {
    const { roomId, userId, cardType } = data;
    console.log(`Reveal card request - Room: ${roomId}, User: ${userId}, Card: ${cardType}`);
    await gameService.revealCard(io, roomId, userId, cardType);
  });

  socket.on('vote-player', async (data) => {
    const { roomId, voterId, targetId } = data;
    await gameService.handleVote(io, roomId, voterId, targetId);
  });

  socket.on('reset-game', async (data) => {
    const { roomId } = data;
    await gameService.resetGame(io, roomId);
  });

  socket.on('leave-room', async () => {
    if (socket.roomId && socket.userId) {
      await gameService.handlePlayerLeave(io, socket.roomId, socket.userId);
      socket.leave(socket.roomId);
    }
  });

  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.id);
    if (socket.roomId && socket.userId) {
      await gameService.handlePlayerLeave(io, socket.roomId, socket.userId);
    }
  });
});

const PORT = process.env.PORT || 3600;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});