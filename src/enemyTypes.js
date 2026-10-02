// Enemy stats and which enemies fly in which world. Pure data, so the combat
// logic (and its tests) never pull in any mesh-building code.
//   hp: fireball hits to destroy   speed: m/s   turn: homing rate in rad/s
//   radius: hit sphere   ram: damage on collision   points: score on kill
//   shoots: seconds between shots, or 0 for enemies that only ram
export const ENEMY_TYPES = {
  pterosaur: { name: 'PTEROSAUR', hp: 1, speed: 85, turn: 1.4, radius: 6, ram: 15, shoots: 0, points: 150 },
  wyvern: { name: 'WYVERN', hp: 4, speed: 75, turn: 1.0, radius: 8, ram: 15, shoots: 1.8, points: 300 },
  dragonfly: { name: 'MEGANEURA', hp: 1, speed: 120, turn: 1.6, radius: 5, ram: 15, shoots: 0, points: 200 },
  lung: { name: 'RIVAL DRAGON', hp: 4, speed: 80, turn: 1.0, radius: 9, ram: 15, shoots: 2.0, points: 300 },
  crane: { name: 'WAR CRANE', hp: 1, speed: 90, turn: 1.5, radius: 6, ram: 15, shoots: 0, points: 150 },
  kite: { name: 'WAR KITE', hp: 2, speed: 65, turn: 0.8, radius: 7, ram: 15, shoots: 2.4, points: 200 },
  jet: { name: 'FIGHTER JET', hp: 3, speed: 140, turn: 0.8, radius: 9, ram: 15, shoots: 1.4, points: 300 },
  helicopter: { name: 'HELICOPTER', hp: 3, speed: 60, turn: 1.2, radius: 8, ram: 15, shoots: 1.6, points: 250 },
  drone: { name: 'DRONE', hp: 1, speed: 100, turn: 1.6, radius: 4, ram: 15, shoots: 0, points: 150 },
  gull: { name: 'SEAGULL', hp: 1, speed: 85, turn: 1.6, radius: 4, ram: 15, shoots: 0, points: 100 },
};

const ROSTERS = {
  dino: ['pterosaur', 'wyvern', 'dragonfly'],
  china: ['lung', 'crane', 'kite'],
  modern: ['jet', 'helicopter', 'drone', 'gull'],
};

export function rosterFor(world) {
  return ROSTERS[world].map((id) => ({ id, ...ENEMY_TYPES[id] }));
}
