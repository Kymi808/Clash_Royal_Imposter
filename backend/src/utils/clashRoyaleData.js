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

function getRandomCards() {
  return {
    troop: troops[Math.floor(Math.random() * troops.length)],
    spell: spells[Math.floor(Math.random() * spells.length)],
    building: buildings[Math.floor(Math.random() * buildings.length)]
  };
}

module.exports = { getRandomCards, troops, spells, buildings };