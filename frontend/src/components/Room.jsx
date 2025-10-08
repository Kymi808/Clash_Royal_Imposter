import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Button,
  List, ListItem, ListItemText, Chip, Grid,
  Alert, CircularProgress, Select, MenuItem,
  FormControl, InputLabel
} from '@mui/material';
import { PlayArrow, ExitToApp, ContentCopy, Settings } from '@mui/icons-material';
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
  const [showSettings, setShowSettings] = useState(false);
  const [gameMode, setGameMode] = useState('mixed');
  const [impostorCount, setImpostorCount] = useState(1);

  useEffect(() => {
    const initRoom = async () => {
      try {
        const response = await api.get(`/rooms/${roomId}`);
        setRoom(response.data);
        setGameMode(response.data.settings.gameMode || 'mixed');
        setImpostorCount(response.data.settings.impostorCount || 1);
        setLoading(false);

        // Connect to socket
        socketService.connect(token);
        
        // Join room after connection
        setTimeout(() => {
          socketService.emit('join-room', {
            roomId,
            userId: user.id,
            username: user.username
          });
        }, 100);

        // Socket event listeners
        socketService.on('player-joined', (data) => {
          console.log('Player joined:', data);
          setRoom(prev => ({
            ...prev,
            players: data.players,
            settings: data.settings || prev.settings
          }));
        });

        socketService.on('settings-updated', (data) => {
          console.log('Settings updated:', data);
          setRoom(prev => ({
            ...prev,
            settings: data.settings
          }));
          setGameMode(data.settings.gameMode);
          setImpostorCount(data.settings.impostorCount);
        });

        socketService.on('player-left', (data) => {
          console.log('Player left:', data);
          setRoom(prev => ({
            ...prev,
            players: prev.players.filter(p => p.userId !== data.userId)
          }));
        });

        socketService.on('game-started', (data) => {
          console.log('Game started! Navigating to game...', data);
          sessionStorage.setItem('gameData', JSON.stringify(data));
          navigate(`/game/${roomId}`);
        });

        socketService.on('game-state-update', (data) => {
          console.log('Game state update:', data);
        });

        socketService.on('game-error', (data) => {
          console.log('Game error:', data);
          setError(data.message);
        });
      } catch (error) {
        console.error('Room init error:', error);
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
    console.log('Starting game with room:', roomId, 'impostor count:', room.settings.impostorCount);
    socketService.emit('start-game', {
      roomId,
      impostorCount: room.settings.impostorCount
    });
  };

  const handleUpdateSettings = async () => {
    try {
      await api.patch(`/rooms/${roomId}/settings`, {
        gameMode,
        impostorCount
      });
      
      socketService.emit('update-settings', {
        roomId,
        settings: { gameMode, impostorCount }
      });
      
      setShowSettings(false);
    } catch (error) {
      setError('Failed to update settings');
    }
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

  const isHost = room.host === user?.id || room.host?._id === user?.id;
  const maxImposters = Math.floor(room.players.length / 2);

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4">Game Room</Typography>
            <Box>
              {isHost && (
                <Button
                  variant="outlined"
                  startIcon={<Settings />}
                  onClick={() => setShowSettings(!showSettings)}
                  sx={{ mr: 1 }}
                >
                  Settings
                </Button>
              )}
              <Button
                variant="outlined"
                color="error"
                startIcon={<ExitToApp />}
                onClick={handleLeaveRoom}
              >
                Leave Room
              </Button>
            </Box>
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
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">
                  Players: {room.players.length}/{room.settings.maxPlayers}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">
                  Mode: {room.settings.gameMode}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">
                  Imposters: {room.settings.impostorCount}
                </Typography>
              </Grid>
            </Grid>
          </Box>

          {showSettings && isHost && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid #444' }}>
              <Typography variant="h6" gutterBottom>Game Settings</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Game Mode</InputLabel>
                    <Select
                      value={gameMode}
                      onChange={(e) => setGameMode(e.target.value)}
                      label="Game Mode"
                    >
                      <MenuItem value="mixed">Mixed (Traditional)</MenuItem>
                      <MenuItem value="troops">Troops Only</MenuItem>
                      <MenuItem value="spells">Spells Only</MenuItem>
                      <MenuItem value="buildings">Buildings Only</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Imposters</InputLabel>
                    <Select
                      value={impostorCount}
                      onChange={(e) => setImpostorCount(e.target.value)}
                      label="Imposters"
                    >
                      {[1, 2, 3].map(n => (
                        <MenuItem key={n} value={n} disabled={n > maxImposters}>
                          {n} {n > maxImposters ? '(Too many)' : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              <Button
                variant="contained"
                onClick={handleUpdateSettings}
                sx={{ mt: 2 }}
              >
                Apply Settings
              </Button>
            </Box>
          )}

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
                {(player.userId === room.host || player.userId === room.host?._id) && (
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
                disabled={room.players.length < 3}
              >
                {room.players.length < 3 
                  ? `Need ${3 - room.players.length} more players`
                  : 'Start Game'}
              </Button>
              {room.players.length >= 3 && (
                <Typography variant="caption" display="block" textAlign="center" sx={{ mt: 1 }}>
                  Game Mode: {room.settings.gameMode} | Max imposters with {room.players.length} players: {maxImposters}
                </Typography>
              )}
            </Box>
          )}

          {!isHost && (
            <Alert severity="info" sx={{ mt: 3 }}>
              Waiting for host to start the game... (Minimum 3 players required)
            </Alert>
          )}
        </Paper>
      </Box>
    </Container>
  );
}

export default Room;