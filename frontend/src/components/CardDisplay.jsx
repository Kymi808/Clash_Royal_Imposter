import React from 'react';
import { Box, Typography, Card } from '@mui/material';

const cardImages = {
  // Troops
  'Knight': '⚔️',
  'Archers': '🏹',
  'Minions': '🦇',
  'Giant': '👹',
  'P.E.K.K.A': '🤖',
  'Wizard': '🧙‍♂️',
  'Musketeer': '🔫',
  'Mini P.E.K.K.A': '🗡️',
  'Hog Rider': '🐗',
  'Valkyrie': '🪓',
  'Skeleton Army': '💀',
  'Bomber': '💣',
  'Prince': '🤴',
  'Goblin Gang': '👺',
  'Elite Barbarians': '⚔️',
  'Hunter': '🎯',
  'Electro Wizard': '⚡',
  'Executioner': '🪓',
  'Bowler': '🎳',
  'Mega Knight': '🛡️',
  
  // Spells
  'Fireball': '🔥',
  'Zap': '⚡',
  'Lightning': '🌩️',
  'Rocket': '🚀',
  'Freeze': '❄️',
  'Poison': '☠️',
  'Tornado': '🌪️',
  'Clone': '👥',
  'Mirror': '🪞',
  'Rage': '😡',
  'Heal': '💚',
  'Log': '🪵',
  'Arrows': '🏹',
  'Earthquake': '🌍',
  'Royal Delivery': '📦',
  
  // Buildings
  'Cannon': '🔫',
  'Tesla': '⚡',
  'Mortar': '💣',
  'Inferno Tower': '🔥',
  'Bomb Tower': '💣',
  'Barbarian Hut': '🏠',
  'Goblin Hut': '🏚️',
  'Spawner': '🏭',
  'X-Bow': '🏹',
  'Furnace': '🔥',
  'Collector': '💎',
  'Goblin Cage': '🗑️'
};

function CardDisplay({ card, cardType, revealed }) {
  const getCardColor = () => {
    switch(cardType) {
      case 'troop': return '#4CAF50';
      case 'spell': return '#9C27B0';
      case 'building': return '#FF9800';
      default: return '#757575';
    }
  };

  return (
    <Card sx={{
      p: 2,
      textAlign: 'center',
      bgcolor: revealed ? getCardColor() : 'grey.800',
      color: 'white',
      transition: 'all 0.3s ease',
      transform: revealed ? 'rotateY(0)' : 'rotateY(180deg)',
      minHeight: 100,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      {revealed ? (
        <>
          <Typography variant="h2">
            {cardImages[card] || '❓'}
          </Typography>
          <Typography variant="h6" sx={{ mt: 1 }}>
            {card}
          </Typography>
        </>
      ) : (
        <Typography variant="h3">
          ?
        </Typography>
      )}
    </Card>
  );
}

export default CardDisplay;