import fs from 'node:fs';
const filename = new URL('../data/predecessor/heroes.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
const explicit = {
  'Vein Splitter': { grants: ['area-damage', 'slow'], removes: ['ground'] },
  'Relentless Hunt': { grants: ['attack-speed-scaling', 'crit', 'area-damage', 'sustained-dps'], removes: ['armor-amplification'] },
  'Neverending Chase': { grants: ['mobility', 'cooldown-reduction', 'on-hit'], removes: [] },
  'Last Winter': { grants: ['shield', 'ally-movement-speed', 'health-scaling'], removes: [] },
  'Rupturing Fangs': { grants: ['missing-health-scaling', 'damage-amplification'], removes: [] },
  'Sanguine Banquet': { grants: ['healing', 'sustain', 'mana-scaling', 'scaling'], removes: [] },
  'Tyrant of Thorns': { grants: ['damage-amplification', 'cooldown-reduction', 'movement-speed'], removes: ['mesmerize'] },
  'Roar of Torment': { grants: ['push', 'area-damage', 'damage-amplification'], removes: ['ultimate-pull', 'ultimate-bite'] },
  'Tainted Oath': { grants: ['anti-heal'], removes: [] },
  'Polarity Strike': { grants: ['shield', 'ally-shield', 'health-scaling'], removes: [] },
  'Smog Therapy': { grants: ['healing', 'ally-healing'], removes: [] },
  'War Anthem': { grants: ['physical-power'], removes: ['full-strength-healing'] },
  'Press the Advantage': { grants: ['attack-speed', 'takedown', 'ally-attack-speed'], removes: ['rally-point-healing'] },
  'Communion': { grants: ['ally-healing', 'healing', 'area-damage'], removes: ['execute'] },
  'Tiny Titan': { grants: ['attack-speed'], removes: ['behemoth-size'] },
  'Mana Catalyst': { grants: ['mana-restore', 'mana-sustain'], removes: [] },
  'Frenzied Fighter': { grants: ['attack-speed', 'movement-speed', 'tenacity', 'sustained-dps'], removes: ['berserk-cooldown'] },
  'Bolster Bearicade': { grants: ['armor-amplification', 'durability'], removes: [] },
  'Shadow Echo': { grants: ['ability-damage', 'area-damage'], removes: [] },
  "Nothin' But Net": { grants: ['economy', 'magical-power', 'scaling'], removes: [] },
  'Limit Break: Echo': { grants: ['cooldown-reset', 'cooldown-reduction'], removes: [] },
  'Auto-Lock Amp': { grants: ['projectile-speed'], removes: [] },
  'Turret Maniac': { grants: ['summon-capacity', 'area-damage'], removes: ['full-strength-turret-health'] },
  'Undertow': { grants: ['pull', 'cooldown-reduction'], removes: [] },
  'Feral Ambush': { grants: ['mobility'], removes: [] },
  'Jungle Invasion': { grants: ['physical-power', 'jungle'], removes: [] },
  'Lenore': { grants: ['cooldown-reset', 'damage-amplification'], removes: [] },
  'Heavenly Tactician': { grants: ['ultimate-haste', 'cooldown-reduction', 'persistent-blade'], removes: [] },
  'Longshot': { grants: ['damage-amplification', 'poke'], removes: [] },
  'Sting Operation': { grants: ['zone-control', 'root'], removes: [] },
  "Justice's Reach": { grants: ['poke', 'pierce'], removes: [] },
  'Percussive Tear': { grants: ['armor-shred'], removes: [] },
  'Psychic Support': { grants: ['mana-sustain', 'ally-mana-restore'], removes: [] },
  'Wanton Warden': { grants: ['healing', 'sustain'], removes: [] },
  'Allegro': { grants: ['mobility', 'cooldown-reduction'], removes: [] },
  'Crescendo': { grants: ['magical-damage', 'on-hit'], removes: [] },
  'Assault MK-II': { grants: ['mobility', 'on-hit', 'physical-damage'], removes: [] },
  'Atomised Artillery': { grants: ['area-damage', 'ability-damage'], removes: [] },
  'Mystic Marksman': { grants: ['magical-damage'], removes: ['knock-knock-physical-damage'] },
  'Illusionist': { grants: ['ally-stealth', 'ally-movement-speed', 'teamfight'], removes: [] },
  'From Up High': { grants: ['damage-amplification', 'height-scaling'], removes: [] },
  'Hallowed Reverberation': { grants: ['poke', 'on-hit', 'area-damage'], removes: [] },
  'The Ascended': { grants: ['scaling', 'health-scaling', 'physical-power'], removes: [] },
  'Master Of Spears': { grants: ['poke', 'cooldown-reduction'], removes: [] },
  'Endless Hunt': { grants: ['cooldown-reduction', 'takedown', 'scaling', 'physical-penetration'], removes: [] },
  'Inner Fury': { grants: ['area-damage', 'poke', 'ultimate', 'on-hit'], removes: [] },
  'Sun Shards': { grants: ['area-damage', 'on-hit', 'basic-attack'], removes: [] },
};
const removesBySlot = {
  'Vein Splitter': {alternate:['ground']},
  'Relentless Hunt': {primary:['armor-amplification']},
  'Tyrant of Thorns': {primary:['mesmerize']},
  'Roar of Torment': {ultimate:['pull','healing','self-heal','execute']},
  'Press the Advantage': {secondary:['healing'],passive:['healing']},
  'Communion': {primary:['execute']},
};
const tradeoffs = {
  'Tyrant of Thorns': ['Royal Flourish loses Mesmerize'],
  'Roar of Torment': ['Consume pushes instead of pulling and cannot bite'],
  'Swift Strikes': ['the third basic attack deals 20% less damage'],
  'Shred Spree': ['Shrapnel Cannon deals 60% less damage'],
  'Kinetic Waltz': ['Axiom Strike deals 90% damage'],
  'Turret Maniac': ['turrets have 20% less Health'],
  'Relentless Hunt': ['Rimeglass no longer grants Armors'],
  'Critical Override': ['Critical Damage decreases by 35%'],
  'Lane Lurker': ['Health Regen is reduced until level 16'],
  'Press the Advantage': ['Rally Point loses Health Regeneration'],
  'Heavy Caliber': ['basic attack timer increases to 0.75s and magazine size falls to 6'],
  'War Anthem': ['ability healing is reduced by 50%'],
  'Final Flash': ['Energy Lance is 30% shorter'],
  'The Rumbling': ['35% less damage, 5 more Mana, and a 60% self-slow while active'],
  'Tiny Titan': ['receives 45% more damage'],
  'Communion': ['Mortal Coil can no longer Execute'],
  'Adaptive Force': ['Force Shield is smaller'],
  "Spray 'N Pray": ['reduced accuracy at longer ranges'],
  'Rupturing Fangs': ['Rupture blades deal 20% less base damage'],
  'Vein Splitter': ['Arterial Grip no longer Grounds'],
  'Illusionist': ['Surprise, Surprise! has 10% longer Cooldown'],
  'Heal Matrix': ['Infuse heals 15% less per charge'],
};
for (const hero of data.heroes) {
  for (const augment of hero.augments) {
    const mechanics = explicit[augment.name] ?? { grants: [...augment.tags].filter(t=>!['kit-modifier','removes-ground','removes-rimeglass-armor'].includes(t)), removes: [] };
    augment.mechanics = {...mechanics, ...(tradeoffs[augment.name] ? {tradeoffs:tradeoffs[augment.name]} : {}), ...(removesBySlot[augment.name] ? {removesBySlot:removesBySlot[augment.name]} : {})};
    augment.tags = mechanics.grants.length ? [...mechanics.grants] : ['kit-modifier'];
  }
}
fs.writeFileSync(filename, JSON.stringify(data, null, 2) + '\n');
console.log('Encoded explicit augment benefits and source-backed tradeoffs.');
