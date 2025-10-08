import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Button, Grid,
  Card, CardContent, Alert, Chip, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { Visibility, HowToVote, ExitToApp, SkipNext } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import socketService from '../services/socket';
import CardDisplay from './CardDisplay';

function Game() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [gameData, setGameData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState('playing');
  const [votingTarget, setVotingTarget] = useState(null);
  const [revealedCards, setRevealedCards] = useState({});
  const [round, setRound] = useState(1);
  const [winner, setWinner] = useState(null);
  const [votingDialogOpen, setVotingDialogOpen] = useState(false);
  const [voteStatus, setVoteStatus] = useState({ votersCount: 0, aliveCount: 0 });
  const [votingTimeLeft, setVotingTimeLeft] = useState(null);
  const [showMessage, setShowMessage] = useState(null);
  const [gameEndData, setGameEndData] = useState(null);

  useEffect(() => {
    // Get initial game data from sessionStorage or socket
    const storedGameData = sessionStorage.getItem('gameData');
    if (storedGameData) {
      const data = JSON.parse(storedGameData);
      setGameData(data);
      setPlayers(data.players || []);
      sessionStorage.removeItem('gameData');
    }

    // Reconnect socket if needed
    if (!socketService.socket || !socketService.socket.connected) {
      socketService.connect(token);
      setTimeout(() => {
        socketService.emit('join-room', {
          roomId,
          userId: user.id,
          username: user.username
        });
      }, 100);
    }

    // Socket event listeners
    socketService.on('game-started', (data) => {
      console.log('Game started event received:', data);
      setGameData(data);
      setPlayers(data.players || []);
    });

    socketService.on('card-revealed', (data) => {
      console.log('Card revealed:', data);
      setRevealedCards(prev => ({
        ...prev,
        [`${data.userId}-${data.cardType}`]: data.card
      }));
    });

    socketService.on('voting-started', (data) => {
      setGameState('voting');
      setVotingDialogOpen(true);
      setVotingTimeLeft(data.votingTime);
      setVoteStatus({ votersCount: 0, aliveCount: players.filter(p => p.isAlive).length });
    });

    socketService.on('vote-cast', (data) => {
      setPlayers(prev => prev.map(p => {
        const voteData = data.votes.find(v => v.userId === p.userId);
        return voteData ? { ...p, votes: voteData.votes } : p;
      }));
      setVoteStatus({ votersCount: data.votersCount, aliveCount: data.aliveCount });
    });

    socketService.on('player-eliminated', (data) => {
      setPlayers(prev => prev.map(p => 
        p.userId === data.userId ? { ...p, isAlive: false } : p
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
      setRevealedCards({});
      setVotingDialogOpen(false);
      setVotingTarget(null);
      setPlayers(prev => prev.map(p => ({ ...p, votes: 0 })));
    });

    socketService.on('game-ended', (data) => {
      setWinner(data.winner);
      setGameState('ended');
      setGameEndData(data);
    });

    return () => {
      socketService.off('game-started');
      socketService.off('card-revealed');
      socketService.off('voting-started');
      socketService.off('vote-cast');
      socketService.off('player-eliminated');
      socketService.off('voting-tied');
      socketService.off('vote-skipped');
      socketService.off('new-round');
      socketService.off('game-ended');
    };
  }, [roomId, user, token, players.length]);

  // Voting timer
  useEffect(() => {
    if (votingTimeLeft !== null && votingTimeLeft > 0) {
      const timer = setTimeout(() => {
        setVotingTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [votingTimeLeft]);

  const handleRevealCard = (cardType) => {
    if (!revealedCards[`${user.id}-${cardType}`]) {
      socketService.emit('reveal-card', {
        roomId,
        userId: user.id,
        cardType
      });
    }
  };

  const handleVote = (targetId) => {
    socketService.emit('vote-player', {
      roomId,
      voterId: user.id,
      targetId
    });
    setVotingTarget(targetId);
  };

  const handleSkipVote = () => {
    socketService.emit('vote-player', {
      roomId,
      voterId: user.id,
      targetId: 'skip'
    });
    setVotingTarget('skip');
  };

  const handleLeaveGame = () => {
    navigate('/lobby');
  };

  if (!gameData) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <Typography variant="h5">Loading game...</Typography>
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
              <Chip
                label={gameData.isImposter ? 'IMPOSTER' : 'CREWMATE'}
                color={gameData.isImposter ? 'error' : 'primary'}
                sx={{ mt: 1 }}
              />
            </Box>
            <Box textAlign="center">
              <Typography variant="h6">
                {gameState === 'playing' && 'Reveal your cards!'}
                {gameState === 'voting' && 'Vote for the imposter!'}
                {gameState === 'ended' && 'Game Over'}
              </Typography>
              {gameState === 'voting' && votingTimeLeft !== null && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    Time left: {votingTimeLeft}s | Voted: {voteStatus.votersCount}/{voteStatus.aliveCount}
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={(voteStatus.votersCount / voteStatus.aliveCount) * 100}
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

        {winner && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Game Over! {winner === 'imposters' ? 'Imposters' : 'Crewmates'} Win!
            {gameEndData && gameEndData.imposters && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Imposters were: {gameEndData.imposters.map(i => i.username).join(', ')}
              </Typography>
            )}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Your Cards</Typography>
              {gameData.cards && ['troop', 'spell', 'building'].map((cardType) => (
                <Card key={cardType} sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      {cardType.charAt(0).toUpperCase() + cardType.slice(1)}
                    </Typography>
                    <CardDisplay
                      card={gameData.cards[cardType]}
                      cardType={cardType}
                      revealed={!!revealedCards[`${user.id}-${cardType}`]}
                    />
                    {gameState === 'playing' && (
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<Visibility />}
                        onClick={() => handleRevealCard(cardType)}
                        disabled={!!revealedCards[`${user.id}-${cardType}`]}
                        sx={{ mt: 1 }}
                      >
                        {revealedCards[`${user.id}-${cardType}`] ? 'Revealed' : 'Reveal'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}

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
                    : `You voted for ${players.find(p => p.userId === votingTarget)?.username}`}
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
                      opacity: player.isAlive ? 1 : 0.5,
                      border: player.userId === user.id ? '2px solid #4169e1' : 'none'
                    }}>
                      <CardContent>
                        <Typography variant="h6">
                          {player.username}
                          {!player.isAlive && ' (Eliminated)'}
                        </Typography>
                        
                        {gameState === 'voting' && player.votes > 0 && (
                          <Chip 
                            label={`${player.votes} vote${player.votes > 1 ? 's' : ''}`} 
                            color="error" 
                            size="small" 
                            sx={{ mt: 1 }}
                          />
                        )}
                        
                        <Box sx={{ mt: 2 }}>
                          {['troop', 'spell', 'building'].map((cardType) => {
                            const cardKey = `${player.userId}-${cardType}`;
                            const revealed = revealedCards[cardKey];
                            return revealed ? (
                              <Chip
                                key={cardType}
                                label={`${cardType}: ${revealed}`}
                                size="small"
                                sx={{ mr: 1, mb: 1 }}
                              />
                            ) : null;
                          })}
                        </Box>

                        {gameState === 'voting' && player.isAlive && player.userId !== user.id && (
                          <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<HowToVote />}
                            onClick={() => handleVote(player.userId)}
                            disabled={votingTarget !== null}
                            sx={{ mt: 1 }}
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
              Discuss and vote who you think the imposter is!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • You can vote for a player or skip the vote
              • If votes are tied, no one will be eliminated
              • Voting ends when everyone votes or time runs out
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