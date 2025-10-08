import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Button, Grid,
  Card, CardContent, Alert, Chip, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Table, TableBody, TableCell, TableRow, TableHead
} from '@mui/material';
import { Visibility, HowToVote, ExitToApp, SkipNext, Refresh } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import socketService from '../services/socket';
import CardDisplay from './CardDisplay';

function Game() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [myCard, setMyCard] = useState(null);
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState('playing');
  const [votingTarget, setVotingTarget] = useState(null);
  const [revealedPlayers, setRevealedPlayers] = useState([]);
  const [round, setRound] = useState(1);
  const [winner, setWinner] = useState(null);
  const [votingDialogOpen, setVotingDialogOpen] = useState(false);
  const [voteStatus, setVoteStatus] = useState({ votersCount: 0, aliveCount: 0 });
  const [votingTimeLeft, setVotingTimeLeft] = useState(null);
  const [showMessage, setShowMessage] = useState(null);
  const [gameEndData, setGameEndData] = useState(null);
  const [impostorCount, setImpostorCount] = useState(1);
  const [gameMode, setGameMode] = useState('mixed');
  const [loading, setLoading] = useState(true);
  const [hasRevealed, setHasRevealed] = useState(false);
  const [waitingForNewGame, setWaitingForNewGame] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user || !token) {
      console.log('No user or token, redirecting to login');
      navigate('/login');
    }
  }, [user, token, navigate]);

  useEffect(() => {
    if (!user || !user.id) {
      console.log('User not available yet');
      return;
    }

    // Get initial game data from sessionStorage
    const storedGameData = sessionStorage.getItem('gameData');
    
    if (storedGameData) {
      const data = JSON.parse(storedGameData);
      console.log('Loaded game data from session:', data);
      setPlayers(data.players || []);
      setImpostorCount(data.actualImpostorCount || 1);
      setGameMode(data.gameMode || 'mixed');
      sessionStorage.removeItem('gameData');
    }

    // Socket should already be connected from Room component
    if (!socketService.socket || !socketService.connected) {
      console.log('Socket not connected, reconnecting...');
      socketService.connect(token);
    }

    // Set up all event listeners
    const setupEventListeners = () => {
      socketService.on('your-card', (data) => {
        console.log('Received my card:', data.card);
        setMyCard(data.card);
        setLoading(false);
        setWaitingForNewGame(false);
      });

      socketService.on('game-started', (data) => {
        console.log('New game started:', data);
        setPlayers(data.players || []);
        setImpostorCount(data.actualImpostorCount || 1);
        setGameMode(data.gameMode || 'mixed');
        setGameState('playing');
        setHasRevealed(false);
        setRevealedPlayers([]);
        setWinner(null);
        setGameEndData(null);
        setRound(1);
        setVotingTarget(null);
        setWaitingForNewGame(false);
      });

      socketService.on('player-revealed', (data) => {
        console.log('Player revealed their card:', data.username);
        setRevealedPlayers(prev => [...new Set([...prev, data.userId])]);
      });

      socketService.on('revealed-players', (data) => {
        setRevealedPlayers(data.revealedPlayers || []);
      });

      socketService.on('voting-started', (data) => {
        setGameState('voting');
        setVotingDialogOpen(true);
        setVotingTimeLeft(data.votingTime);
        const aliveCount = players.filter(p => p.isAlive !== false).length;
        setVoteStatus({ votersCount: 0, aliveCount });
      });

      socketService.on('vote-cast', (data) => {
        setPlayers(prev => prev.map(p => {
          const voteData = data.votes.find(v => v.userId.toString() === p.userId.toString());
          return voteData ? { ...p, votes: voteData.votes } : p;
        }));
        setVoteStatus({ votersCount: data.votersCount, aliveCount: data.aliveCount });
      });

      socketService.on('player-eliminated', (data) => {
        setPlayers(prev => prev.map(p => 
          p.userId.toString() === data.userId.toString() ? { ...p, isAlive: false } : p
        ));
        setShowMessage({
          type: 'elimination',
          text: `${data.username} was eliminated! They were ${data.wasImposter ? 'an IMPOSTER' : 'a CREWMATE'}!`,
          severity: data.wasImposter ? 'success' : 'warning'
        });
        setTimeout(() => setShowMessage(null), 5000);
      });

      socketService.on('voting-tied', (data) => {
        setShowMessage({
          type: 'tie',
          text: data.message,
          severity: 'info'
        });
        setTimeout(() => setShowMessage(null), 5000);
      });

      socketService.on('vote-skipped', (data) => {
        setShowMessage({
          type: 'skip',
          text: data.message,
          severity: 'info'
        });
        setTimeout(() => setShowMessage(null), 3000);
      });

      socketService.on('new-round', (data) => {
        setRound(data.round);
        setGameState('playing');
        setRevealedPlayers([]);
        setHasRevealed(false);
        setVotingDialogOpen(false);
        setVotingTarget(null);
        setPlayers(prev => prev.map(p => ({ ...p, votes: 0 })));
      });

      socketService.on('game-ended', (data) => {
        setWinner(data.winner);
        setGameState('ended');
        setGameEndData(data);
      });

      socketService.on('game-reset', (data) => {
        console.log('Game has been reset');
        setWaitingForNewGame(true);
        setGameState('waiting');
        setMyCard(null);
        setHasRevealed(false);
        setRevealedPlayers([]);
        setVotingTarget(null);
        setWinner(null);
        setGameEndData(null);
        setRound(1);
        setPlayers(data.players || []);
      });

      socketService.on('game-state-update', (data) => {
        console.log('Game state update:', data);
        if (data.gameState) setGameState(data.gameState);
        if (data.round) setRound(data.round);
        if (data.gameMode) setGameMode(data.gameMode);
      });
    };

    setupEventListeners();

    // Request card if we don't have it yet
    setTimeout(() => {
      if (user && user.id) {
        console.log('Rejoining room to get card...');
        socketService.emit('join-room', {
          roomId,
          userId: user.id,
          username: user.username
        });
      }
    }, 100);

    return () => {
      // Clean up event listeners but don't disconnect
      socketService.off('your-card');
      socketService.off('game-started');
      socketService.off('player-revealed');
      socketService.off('revealed-players');
      socketService.off('voting-started');
      socketService.off('vote-cast');
      socketService.off('player-eliminated');
      socketService.off('voting-tied');
      socketService.off('vote-skipped');
      socketService.off('new-round');
      socketService.off('game-ended');
      socketService.off('game-reset');
      socketService.off('game-state-update');
    };
  }, [roomId, user, token, navigate]);

  // Voting timer
  useEffect(() => {
    if (votingTimeLeft !== null && votingTimeLeft > 0) {
      const timer = setTimeout(() => {
        setVotingTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [votingTimeLeft]);

  const handleRevealCard = () => {
    if (!user || !user.id) {
      console.error('User not available');
      return;
    }
    console.log('Revealing card');
    if (myCard && !hasRevealed) {
      socketService.emit('reveal-card', {
        roomId,
        userId: user.id
      });
      setHasRevealed(true);
    }
  };

  const handleVote = (targetId) => {
    if (!user || !user.id) {
      console.error('User not available');
      return;
    }
    socketService.emit('vote-player', {
      roomId,
      voterId: user.id,
      targetId
    });
    setVotingTarget(targetId);
  };

  const handleSkipVote = () => {
    if (!user || !user.id) {
      console.error('User not available');
      return;
    }
    socketService.emit('vote-player', {
      roomId,
      voterId: user.id,
      targetId: 'skip'
    });
    setVotingTarget('skip');
  };

  const handleNewGame = () => {
    socketService.emit('reset-game', { roomId });
  };

  const handleStartNewGame = () => {
    socketService.emit('start-game', {
      roomId,
      impostorCount: impostorCount
    });
  };

  const handleLeaveGame = () => {
    socketService.emit('leave-room');
    socketService.disconnect();
    navigate('/lobby');
  };

  // Show loading if user is not available
  if (!user || !user.id) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8 }}>
          <CircularProgress />
          <Typography variant="h6" sx={{ mt: 2 }}>Loading user...</Typography>
        </Box>
      </Container>
    );
  }

  if (waitingForNewGame) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h5" gutterBottom>
              Waiting for New Game
            </Typography>
            <Typography variant="body1" sx={{ mb: 3 }}>
              All players are back in the room. Host can start a new game.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={handleStartNewGame}
              startIcon={<Refresh />}
            >
              Start New Game
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={handleLeaveGame}
              startIcon={<ExitToApp />}
              sx={{ ml: 2 }}
            >
              Leave Room
            </Button>
          </Paper>
        </Box>
      </Container>
    );
  }

  if (loading && !myCard) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8 }}>
          <CircularProgress />
          <Typography variant="h6" sx={{ mt: 2 }}>Loading game...</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>Waiting for card...</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 2 }}>
        <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h5">Round {round}</Typography>
              <Box sx={{ mt: 1 }}>
                <Chip label={`Mode: ${gameMode}`} sx={{ mr: 1 }} />
                <Chip 
                  label={`${impostorCount} Imposter${impostorCount > 1 ? 's' : ''} Among Us`} 
                  color="error" 
                />
              </Box>
            </Box>
            <Box textAlign="center">
              <Typography variant="h6">
                {gameState === 'playing' && 'Reveal your card and discuss!'}
                {gameState === 'voting' && 'Vote for the imposter!'}
                {gameState === 'ended' && `Game Over - ${winner === 'imposters' ? 'Imposters' : 'Crewmates'} Win!`}
              </Typography>
              {gameState === 'voting' && votingTimeLeft !== null && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    Time left: {votingTimeLeft}s | Voted: {voteStatus.votersCount}/{voteStatus.aliveCount}
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={(voteStatus.votersCount / Math.max(voteStatus.aliveCount, 1)) * 100}
                    sx={{ mt: 0.5 }}
                  />
                </Box>
              )}
            </Box>
            <Button
              variant="outlined"
              color="error"
              startIcon={<ExitToApp />}
              onClick={handleLeaveGame}
            >
              Leave
            </Button>
          </Box>
        </Paper>

        {showMessage && (
          <Alert severity={showMessage.severity} sx={{ mb: 2 }}>
            {showMessage.text}
          </Alert>
        )}

        {gameState === 'ended' && gameEndData && (
          <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>Game Results</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Player</TableCell>
                  <TableCell>Card</TableCell>
                  <TableCell>Role</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {gameEndData.allCards?.map((playerData) => (
                  <TableRow key={playerData.userId}>
                    <TableCell>{playerData.username}</TableCell>
                    <TableCell>{playerData.card}</TableCell>
                    <TableCell>
                      <Chip 
                        label={playerData.wasImposter ? 'IMPOSTER' : 'CREWMATE'} 
                        color={playerData.wasImposter ? 'error' : 'primary'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={handleNewGame}
              sx={{ mt: 2 }}
              fullWidth
            >
              Play Again
            </Button>
          </Paper>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Your Card</Typography>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Reveal your card and discuss who has a different one!
              </Typography>
              
              {myCard ? (
                <Card sx={{ mb: 2, mt: 2 }}>
                  <CardContent>
                    <CardDisplay
                      card={myCard}
                      cardType={gameMode === 'mixed' ? 'mixed' : gameMode.slice(0, -1)}
                      revealed={hasRevealed}
                    />
                    {gameState === 'playing' && (
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<Visibility />}
                        onClick={handleRevealCard}
                        disabled={hasRevealed}
                        sx={{ mt: 2 }}
                      >
                        {hasRevealed ? 'Revealed' : 'Reveal Card'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <CircularProgress size={24} />
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Waiting for card...
                  </Typography>
                </Box>
              )}

              {gameState === 'voting' && !votingTarget && (
                <Button
                  fullWidth
                  variant="outlined"
                  color="secondary"
                  startIcon={<SkipNext />}
                  onClick={handleSkipVote}
                  sx={{ mt: 2 }}
                >
                  Skip Vote
                </Button>
              )}

              {gameState === 'voting' && votingTarget && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {votingTarget === 'skip' 
                    ? 'You chose to skip voting' 
                    : `You voted for ${players.find(p => p.userId.toString() === votingTarget)?.username}`}
                </Alert>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={8}>
            <Paper elevation={3} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Players</Typography>
              <Grid container spacing={2}>
                {players.map((player) => (
                  <Grid item xs={12} sm={6} key={player.userId}>
                    <Card sx={{ 
                      opacity: player.isAlive !== false ? 1 : 0.5,
                      border: user && player.userId.toString() === user.id ? '2px solid #4169e1' : 'none'
                    }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="h6">
                            {player.username}
                            {player.isAlive === false && ' (Dead)'}
                          </Typography>
                          {revealedPlayers.includes(player.userId) && (
                            <Chip 
                              label="Revealed" 
                              color="success" 
                              size="small"
                            />
                          )}
                        </Box>
                        
                        {gameState === 'voting' && player.votes > 0 && (
                          <Chip 
                            label={`${player.votes} vote${player.votes > 1 ? 's' : ''}`} 
                            color="error" 
                            size="small" 
                            sx={{ mt: 1 }}
                          />
                        )}

                        {gameState === 'voting' && player.isAlive !== false && user && player.userId.toString() !== user.id && (
                          <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<HowToVote />}
                            onClick={() => handleVote(player.userId)}
                            disabled={votingTarget !== null}
                            sx={{ mt: 2 }}
                          >
                            Vote
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        </Grid>

        {/* Voting Dialog */}
        <Dialog open={votingDialogOpen && gameState === 'voting'} maxWidth="md" fullWidth>
          <DialogTitle>Voting Phase</DialogTitle>
          <DialogContent>
            <Typography variant="body1" gutterBottom>
              Discussion time! Based on what everyone said, who has a different card?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • {impostorCount} player{impostorCount > 1 ? 's have' : ' has'} different cards<br/>
              • Vote for who you think is lying about their card<br/>
              • Ties = no elimination
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setVotingDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
}

export default Game;
