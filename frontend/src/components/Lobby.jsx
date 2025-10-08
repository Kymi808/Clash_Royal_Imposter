import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, TextField, Button, Typography,
  Box, Grid, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl,
  InputLabel, Alert
} from '@mui/material';
import { Add, MeetingRoom, ExitToApp } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

function Lobby() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [impostorCount, setImpostorCount] = useState(1);
  const [error, setError] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleCreateRoom = async () => {
    try {
      const response = await api.post('/rooms/create', {
        maxPlayers,
        impostorCount
      });
      navigate(`/room/${response.data.roomId}`);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to create room');
    }
  };

  const handleJoinRoom = async () => {
    try {
      const response = await api.post('/rooms/join', { roomCode });
      navigate(`/room/${response.data.roomId}`);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to join room');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
            <Typography variant="h4">
              Welcome, {user?.username}!
            </Typography>
            <Button
              variant="outlined"
              color="error"
              startIcon={<ExitToApp />}
              onClick={handleLogout}
            >
              Logout
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={<Add />}
                onClick={() => setCreateDialogOpen(true)}
                sx={{ py: 3 }}
              >
                Create Room
              </Button>
            </Grid>
            <Grid item xs={12} md={6}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                startIcon={<MeetingRoom />}
                onClick={() => setJoinDialogOpen(true)}
                sx={{ py: 3 }}
              >
                Join Room
              </Button>
            </Grid>
          </Grid>

          {user?.stats && (
            <Box sx={{ mt: 4, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom>Your Stats</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">
                    Games Played
                  </Typography>
                  <Typography variant="h5">
                    {user.stats.gamesPlayed}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">
                    Won as Imposter
                  </Typography>
                  <Typography variant="h5">
                    {user.stats.gamesWonAsImposter}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">
                    Won as Crewmate
                  </Typography>
                  <Typography variant="h5">
                    {user.stats.gamesWonAsCrewmate}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">
                    Total Votes
                  </Typography>
                  <Typography variant="h5">
                    {user.stats.totalVotes}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Create Room Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <DialogTitle>Create New Room</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>Max Players</InputLabel>
            <Select
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
              label="Max Players"
            >
              {[4, 5, 6, 8, 10, 12, 15, 20].map(n => (
                <MenuItem key={n} value={n}>{n}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Imposters</InputLabel>
            <Select
              value={impostorCount}
              onChange={(e) => setImpostorCount(e.target.value)}
              label="Imposters"
            >
              {[1, 2, 3].map(n => (
                <MenuItem key={n} value={n}>{n}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateRoom} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Join Room Dialog */}
      <Dialog open={joinDialogOpen} onClose={() => setJoinDialogOpen(false)}>
        <DialogTitle>Join Room</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Room Code"
            variant="outlined"
            margin="normal"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            inputProps={{ maxLength: 6 }}
            placeholder="Enter 6-digit code"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJoinDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleJoinRoom} 
            variant="contained"
            disabled={roomCode.length !== 6}
          >
            Join
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default Lobby;