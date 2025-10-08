const troops = [
  'Knight', 'Archers', 'Minions', 'Giant', 'P.E.K.K.A', 'Wizard',
  'Musketeer', 'Mini P.E.K.K.A', 'Hog Rider', 'Valkyrie', 'Skeleton Army',
  'Bomber', 'Prince', 'Goblin Gang', 'Elite Barbarians', 'Hunter',
  'Electro Wizard', 'Executioner', 'Bowler', 'Mega Knight'
];

const spells = [
  'Fireball', 'Zap', 'Lightning', 'Rocket', 'Freeze', 'Poison',
  'Tornado', 'Clone', 'Mirror', 'Rage', 'Heal', 'Log',
  'Arrows', 'Earthquake', 'Royal Delivery'
];

const buildings = [
  'Cannon', 'Tesla', 'Mortar', 'Inferno Tower', 'Bomb Tower',
  'Barbarian Hut', 'Goblin Hut', 'Spawner', 'X-Bow', 'Furnace',
  'Collector', 'Goblin Cage'
];

function getRandomCard(gameMode = 'mixed') {
  let cardPool;
  
  switch(gameMode) {
    case 'troops':
      cardPool = troops;
      break;
    case 'spells':
      cardPool = spells;
      break;
    case 'buildings':
      cardPool = buildings;
      break;
    case 'mixed':
    default:
      // In mixed mode, combine all cards
      cardPool = [...troops, ...spells, ...buildings];
      break;
  }
  
  return cardPool[Math.floor(Math.random() * cardPool.length)];
}

// Deprecated - keeping for backwards compatibility
function getRandomCards(gameMode = 'mixed') {
  const card = getRandomCard(gameMode);
  return {
    troop: card,
    spell: card,
    building: card
  };
}

module.exports = { getRandomCard, getRandomCards, troops, spells, buildings };
