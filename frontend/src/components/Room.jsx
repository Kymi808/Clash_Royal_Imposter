import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Button,
  List, ListItem, ListItemText, Chip, Grid,
  Alert, CircularProgress
} from '@mui/material';
import { PlayArrow, ExitToApp, ContentCopy } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import socketService from '../services/socket';
import api from '../services/api';

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const initRoom = async () => {
      try {
        const response = await api.get(`/rooms/${roomId}`);
        setRoom(response.data);
        setLoading(false);

        // Connect to socket
        socketService.connect(token);
        socketService.emit('join-room', {
          roomId,
          userId: user.id,
          username: user.username
        });

        // Socket event listeners
        socketService.on('player-joined', (data) => {
          setRoom(prev => ({
            ...prev,
            players: data.players
          }));
        });

        socketService.on('player-left', (data) => {
          setRoom(prev => ({
            ...prev,
            players: prev.players.filter(p => p.userId !== data.userId)
          }));
        });

        socketService.on('game-started', () => {
          navigate(`/game/${roomId}`);
        });

        socketService.on('game-error', (data) => {
          setError(data.message);
        });
      } catch (error) {
        setError('Failed to load room');
        setLoading(false);
      }
    };

    initRoom();

    return () => {
      socketService.emit('leave-room');
      socketService.disconnect();
    };
  }, [roomId, token, user, navigate]);

  const handleStartGame = () => {
    socketService.emit('start-game', {
      roomId,
      impostorCount: room.settings.impostorCount
    });
  };

  const handleLeaveRoom = () => {
    navigate('/lobby');
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <Container maxWidth="md">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!room) {
    return (
      <Container maxWidth="md">
        <Alert severity="error" sx={{ mt: 4 }}>Room not found</Alert>
      </Container>
    );
  }

  const isHost = room.host === user?.id;

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4">Game Room</Typography>
            <Button
              variant="outlined"
              color="error"
              startIcon={<ExitToApp />}
              onClick={handleLeaveRoom}
            >
              Leave Room
            </Button>
          </Box>

          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Room Code: {room.roomCode}
              <Button
                size="small"
                startIcon={<ContentCopy />}
                onClick={copyRoomCode}
                sx={{ ml: 2 }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Players: {room.players.length}/{room.settings.maxPlayers}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Imposters: {room.settings.impostorCount}
                </Typography>
              </Grid>
            </Grid>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Typography variant="h6" gutterBottom>
            Players ({room.players.length})
          </Typography>
          <List>
            {room.players.map((player) => (
              <ListItem key={player.userId}>
                <ListItemText primary={player.username} />
                {player.userId === room.host && (
                  <Chip label="Host" color="primary" size="small" />
                )}
              </ListItem>
            ))}
          </List>

          {isHost && (
            <Box sx={{ mt: 3 }}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={<PlayArrow />}
                onClick={handleStartGame}
                disabled={room.players.length < 4}
              >
                {room.players.length < 4 
                  ? `Need ${4 - room.players.length} more players`
                  : 'Start Game'}
              </Button>
            </Box>
          )}

          {!isHost && (
            <Alert severity="info" sx={{ mt: 3 }}>
              Waiting for host to start the game...
            </Alert>
          )}
        </Paper>
      </Box>
    </Container>
  );
}

export default Room;