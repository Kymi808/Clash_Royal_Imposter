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

function getRandomCards(gameMode = 'mixed') {
  switch(gameMode) {
    case 'troops':
      // All cards are troops
      return {
        troop: troops[Math.floor(Math.random() * troops.length)],
        spell: troops[Math.floor(Math.random() * troops.length)],
        building: troops[Math.floor(Math.random() * troops.length)]
      };
    
    case 'spells':
      // All cards are spells
      return {
        troop: spells[Math.floor(Math.random() * spells.length)],
        spell: spells[Math.floor(Math.random() * spells.length)],
        building: spells[Math.floor(Math.random() * spells.length)]
      };
    
    case 'buildings':
      // All cards are buildings
      return {
        troop: buildings[Math.floor(Math.random() * buildings.length)],
        spell: buildings[Math.floor(Math.random() * buildings.length)],
        building: buildings[Math.floor(Math.random() * buildings.length)]
      };
    
    case 'mixed':
    default:
      // Original mixed mode
      return {
        troop: troops[Math.floor(Math.random() * troops.length)],
        spell: spells[Math.floor(Math.random() * spells.length)],
        building: buildings[Math.floor(Math.random() * buildings.length)]
      };
  }
}

module.exports = { getRandomCards, troops, spells, buildings };