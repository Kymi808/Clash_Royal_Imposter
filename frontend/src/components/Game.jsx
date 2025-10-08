import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Paper, Typography, Box, Button, Grid,
  Card, CardContent, Alert, List, ListItem,
  ListItemText, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton
} from '@mui/material';
import { Visibility, HowToVote, ExitToApp } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import socketService from '../services/socket';
import CardDisplay from './CardDisplay';

function Game() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [gameData, setGameData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState('playing');
  const [votingTarget, setVotingTarget] = useState(null);
  const [votingDialogOpen, setVotingDialogOpen] = useState(false);
  const [revealedCards, setRevealedCards] = useState({});
  const [round, setRound] = useState(1);
  const [winner, setWinner] = useState(null);
  const [eliminatedPlayer, setEliminatedPlayer] = useState(null);

  useEffect(() => {
    // Socket event listeners
    socketService.on('game-started', (data) => {
      setGameData(data);
      setPlayers(data.players);
    });

    socketService.on('card-revealed', (data) => {
      setRevealedCards(prev => ({
        ...prev,
        [`${data.userId}-${data.cardType}`]: data.card
      }));
    });

    socketService.on('voting-started', (data) => {
      setGameState('voting');
      setVotingDialogOpen(true);
    });

    socketService.on('vote-cast', (data) => {
      setPlayers(prev => prev.map(p => {
        const voteData = data.votes.find(v => v.userId === p.userId);
        return voteData ? { ...p, votes: voteData.votes } : p;
      }));
    });

    socketService.on('player-eliminated', (data) => {
      setEliminatedPlayer(data);
      setPlayers(prev => prev.map(p => 
        p.userId === data.userId ? { ...p, isAlive: false } : p
      ));
      setTimeout(() => setEliminatedPlayer(null), 5000);
    });

    socketService.on('new-round', (data) => {
      setRound(data.round);
      setGameState('playing');
      setRevealedCards({});
      setVotingDialogOpen(false);
      setPlayers(prev => prev.map(p => ({ ...p, votes: 0 })));
    });

    socketService.on('game-ended', (data) => {
      setWinner(data.winner);
      setGameState('ended');
    });

    return () => {
      socketService.off('game-started');
      socketService.off('card-revealed');
      socketService.off('voting-started');
      socketService.off('vote-cast');
      socketService.off('player-eliminated');
      socketService.off('new-round');
      socketService.off('game-ended');
    };
  }, []);

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

  const handleLeaveGame = () => {
    navigate('/lobby');
  };

  if (!gameData) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <Typography variant="h5">Waiting for game to start...</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 2 }}>
        {/* Game Header */}
        <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h5">
                Round {round}
              </Typography>
              <Chip
                label={gameData.isImposter ? 'IMPOSTER' : 'CREWMATE'}
                color={gameData.isImposter ? 'error' : 'primary'}
                sx={{ mt: 1 }}
              />
            </Box>
            <Typography variant="h6">
              {gameState === 'playing' && 'Reveal Phase'}
              {gameState === 'voting' && 'Voting Phase'}
              {gameState === 'ended' && 'Game Over'}
            </Typography>
            <Button
              variant="outlined"
              color="error"
              startIcon={<ExitToApp />}
              onClick={handleLeaveGame}
            >
              Leave Game
            </Button>
          </Box>
        </Paper>

        {/* Alerts */}
        {eliminatedPlayer && (
          <Alert severity={eliminatedPlayer.wasImposter ? 'success' : 'warning'} sx={{ mb: 2 }}>
            {eliminatedPlayer.username} was eliminated! 
            They were {eliminatedPlayer.wasImposter ? 'an IMPOSTER' : 'a CREWMATE'}!
          </Alert>
        )}

        {winner && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Game Over! {winner === 'imposters' ? 'Imposters' : 'Crewmates'} Win!
          </Alert>
        )}

        {/* Main Game Area */}
        <Grid container spacing={2}>
          {/* Your Cards */}
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Your Cards</Typography>
              {['troop', 'spell', 'building'].map((cardType) => (
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
            </Paper>
          </Grid>

          {/* Players Area */}
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
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="h6">
                            {player.username}
                            {!player.isAlive && ' (Eliminated)'}
                          </Typography>
                          {gameState === 'voting' && player.votes > 0 && (
                            <Chip label={`${player.votes} votes`} color="error" size="small" />
                          )}
                        </Box>
                        
                        {/* Revealed Cards */}
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
              You can only vote once. Choose wisely!
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