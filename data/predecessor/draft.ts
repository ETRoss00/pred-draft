import { heroes, type Hero, type HeroAugment, type Role } from './audit';
import { eternals, type Eternal, type EternalBlessing, type EternalTrait } from './eternals';

export type EnemyPick = { name: string; role?: Role | 'unknown' };
export type DraftAdvice<T> = { option: T; score: number; reasons: string[]; tags: string[]; eligible: boolean; unmet: string[] };
export type Profile = { capabilities: Set<string>; threats: Set<string>; weaknesses: Set<string> };

const immobilizes = ['stun', 'root', 'conditional-root', 'center-root', 'suppress', 'suspend', 'restrain', 'mesmerize', 'fear', 'knock-up', 'pull', 'push'];
const roleWeights: Record<Role, Record<Role, number>> = {
  carry: { carry: 0.9, support: 1.35, jungle: 1.2, midlane: 0.75, offlane: 0.55 },
  support: { carry: 1.25, support: 1.2, jungle: 1.1, midlane: 0.8, offlane: 0.5 },
  midlane: { carry: 0.75, support: 0.8, jungle: 1.2, midlane: 1.25, offlane: 0.55 },
  jungle: { carry: 1.05, support: 1, jungle: 1.1, midlane: 1.05, offlane: 0.95 },
  offlane: { carry: 0.55, support: 0.6, jungle: 1.15, midlane: 0.75, offlane: 1.35 },
};
const counters = [
  { threat: 'dive', answers: ['immobilize', 'peel', 'ground', 'shield'], reason: 'helps contain dive' },
  { threat: 'mobility', answers: ['immobilize', 'ground'], reason: 'restricts mobile enemies' },
  { threat: 'sustain', answers: ['anti-heal'], reason: 'reduces enemy healing' },
  { threat: 'frontline', answers: ['tank-shred', 'armor-shred'], reason: 'pressures durable frontline' },
  { threat: 'burst', answers: ['shield', 'damage-reduction', 'durability', 'spell-shield'], reason: 'offers burst protection' },
  { threat: 'poke', answers: ['healing', 'shield', 'mobility'], reason: 'helps manage poke' },
  { threat: 'pick', answers: ['cleanse', 'spell-shield', 'peel'], reason: 'helps against picks' },
  { threat: 'projectile', answers: ['projectile-block', 'projectile-reflect'], reason: 'answers enemy projectiles' },
];

export function isVerified(hero?: Hero): hero is Hero {
  return !!hero && hero.verification.kitStatus === 'source-backed' &&
    hero.verification.abilityStatus === 'source-backed' && hero.verification.augmentStatus === 'source-backed' &&
    hero.abilities?.length === 6 && hero.augments?.length === 3 &&
    ![...hero.abilities, ...hero.augments].some(a => /^User-verified text entry/i.test(a.description));
}

export function heroFitsRole(hero: Hero, role: Role) {
  return [...hero.roles, ...(hero.flexRoles ?? [])].includes(role);
}

export function profileFor(hero: Hero, augment?: HeroAugment): Profile {
  const effects = new Set(hero.abilities?.flatMap(a => a.effects.filter(e=>!augment?.mechanics?.removesBySlot?.[a.slot]?.includes(e))) ?? []);
  const text = hero.abilities?.map(a => a.description).join(' ').toLowerCase() ?? '';
  const caps = new Set<string>(effects);
  if (!hero.abilities?.some(a => a.effects.includes('shield') && !a.effects.includes('spell-shield'))) caps.delete('shield');
  if ([...effects].some(e => immobilizes.includes(e))) caps.add('immobilize');
  if (effects.has('physical-armor-shred') || effects.has('magical-armor-shred')) caps.add('armor-shred');
  if (effects.has('tank-shred') || effects.has('target-max-health-damage')) caps.add('tank-shred');
  if (['healing','self-heal','ally-heal','health-regeneration'].some(e=>effects.has(e))) caps.add('healing');
  if (hero.classes?.includes('tank') || (hero.ratings?.durability ?? 0) >= 7) caps.add('durability');
  if (hero.range === 'ranged') caps.add('ranged');
  if (hero.range === 'melee') caps.add('melee');
  if (hero.damage === 'magical' || hero.damage === 'mixed') caps.add('magical-damage');
  if (hero.damage === 'physical' || hero.damage === 'mixed') caps.add('physical-damage');
  if (/over \d|every 0\.|per second|damage over|bleed|damage per second/.test(text)) caps.add('dot');
  if (!/energy instead of mana/.test(text)) caps.add('mana');
  if (hero.abilities?.some(a => a.slot === 'ultimate' && /damage/i.test(a.description))) caps.add('damaging-ultimate');
  caps.add('basic-attack');
  if ((hero.ratings?.basicAttack ?? 0) >= 6 || effects.has('attack-speed')) caps.add('basic-attack-focus');
  if ((hero.ratings?.abilityPower ?? 0) >= 6) caps.add('ability-focus');
  if (augment) {
    const delta = augmentDelta(augment);
    delta.removes.forEach(e => caps.delete(e));
    delta.grants.forEach(e => caps.add(e));
  }
  if (![...caps].some(e => immobilizes.includes(e))) caps.delete('immobilize');
  if (caps.has('immobilize') || caps.has('push') || caps.has('projectile-block')) caps.add('peel');
  const threats = new Set<string>();
  if (caps.has('mobility')) { threats.add('mobility'); if (hero.range === 'melee') threats.add('dive'); }
  if (caps.has('healing') || caps.has('sustain')) threats.add('sustain');
  if (caps.has('durability') || caps.has('armor-amplification')) threats.add('frontline');
  if (caps.has('immobilize')) threats.add('pick');
  if (caps.has('ranged') && caps.has('ability-focus')) threats.add('poke');
  if (caps.has('projectile') || caps.has('piercing-projectile') || caps.has('ranged')) threats.add('projectile');
  if (hero.classes?.includes('assassin') || caps.has('execute')) threats.add('burst');
  const weaknesses = new Set<string>();
  if (!caps.has('mobility') && (hero.ratings?.mobility ?? 0) <= 2) weaknesses.add('low-mobility');
  if (hero.range === 'melee') weaknesses.add('low-range');
  if ((hero.ratings?.durability ?? 0) <= 3) weaknesses.add('burst');
  return { capabilities: caps, threats, weaknesses };
}

export function analyzeDraft(picks: EnemyPick[]) {
  const names = new Set<string>();
  const enemies = picks.flatMap(p => {
    const hero = heroes.find(h => h.name === p.name);
    if (!isVerified(hero) || names.has(hero.name)) return [];
    names.add(hero.name);
    return [{ ...p, hero, profile: profileFor(hero) }];
  });
  const threatCounts = new Map<string, number>();
  const weaknessCounts = new Map<string, number>();
  for (const enemy of enemies) {
    enemy.profile.threats.forEach(t => threatCounts.set(t, (threatCounts.get(t) ?? 0) + 1));
    enemy.profile.weaknesses.forEach(t => weaknessCounts.set(t, (weaknessCounts.get(t) ?? 0) + 1));
  }
  return { enemies, threatCounts, weaknessCounts };
}

function matchupWeight(enemy: EnemyPick & { hero: Hero }, role: Role) {
  const possible = [...new Set([...enemy.hero.roles, ...(enemy.hero.flexRoles ?? [])])];
  const weight = enemy.role && enemy.role !== 'unknown' && possible.includes(enemy.role)
    ? roleWeights[role][enemy.role]
    : possible.reduce((sum, r) => sum + roleWeights[role][r], 0) / Math.max(possible.length, 1);
  return 0.65 + weight * 0.35;
}

function scoreAnswers(caps: Set<string>, picks: EnemyPick[], role: Role) {
  let score = 0;
  const reasons: string[] = [];
  for (const enemy of analyzeDraft(picks).enemies) {
    for (const counter of counters) {
      if (!enemy.profile.threats.has(counter.threat)) continue;
      const matches = counter.answers.filter(a => caps.has(a));
      if (!matches.length) continue;
      const immunityPenalty = enemy.profile.capabilities.has('cc-immunity') && matches.every(a => ['immobilize', 'ground'].includes(a)) ? 0.5 : 1;
      score += Math.round((7 + Math.min(matches.length - 1, 2) * 2) * matchupWeight(enemy, role) * immunityPenalty);
      reasons.push(`${counter.reason}: ${enemy.hero.name}`);
    }
  }
  return { score, reasons: [...new Set(reasons)] };
}

export function rankHeroes(picks: EnemyPick[], role: Role, search = ''): DraftAdvice<Hero>[] {
  const taken = new Set(picks.map(p => p.name));
  return heroes.filter(h => isVerified(h) && heroFitsRole(h, role) && !taken.has(h.name) && h.name.toLowerCase().includes(search.toLowerCase()))
    .map(hero => {
      const profile = profileFor(hero);
      const matchup = scoreAnswers(profile.capabilities, picks, role);
      let score = 20 + matchup.score;
      const reasons = [...matchup.reasons];
      for (const enemy of analyzeDraft(picks).enemies) {
        if (enemy.profile.weaknesses.has('low-mobility') && (profile.capabilities.has('immobilize') || profile.capabilities.has('poke'))) {
          score += 4; reasons.push(`pressures immobile targets: ${enemy.hero.name}`);
        }
      }
      if (!reasons.length) reasons.push(picks.some(p=>p.name) ? 'role-valid kit option; no strong counter identified' : 'role-valid baseline; enemy matchup unknown');
      return { option: hero, score, reasons: reasons.slice(0, 4), tags: [...profile.capabilities], eligible: true, unmet: [] };
    }).sort(compareAdvice);
}

export function augmentDelta(augment: HeroAugment) {
  const grants = new Set(augment.mechanics?.grants ?? augment.tags);
  const removes = new Set(augment.mechanics?.removes ?? []);
  // Only explicit, source-derived effects are scored. Names and negated prose are never keyword-scanned.
  if ([...grants].some(e => immobilizes.includes(e))) grants.add('immobilize');
  if (grants.has('shields') || grants.has('self-shield') || grants.has('ally-shield')) grants.add('shield');
  if (grants.has('anti-burst')) grants.add('shield');
  if (grants.has('sustain')) grants.add('healing');
  if (grants.has('physical-armor-shred') || grants.has('magical-armor-shred')) grants.add('armor-shred');
  removes.forEach(e => grants.delete(e));
  return { grants, removes };
}

export function rankAugments(picks: EnemyPick[], hero: Hero, role: Role): DraftAdvice<HeroAugment>[] {
  if (!isVerified(hero)) return [];
  return (hero.augments ?? []).map(augment => {
    const delta = augmentDelta(augment);
    const matchup = scoreAnswers(delta.grants, picks, role);
    const baseProfile = profileFor(hero);
    const synergy = ['attack-speed','on-hit','basic-attack'].some(e=>delta.grants.has(e)) && baseProfile.capabilities.has('basic-attack-focus') ? 5 : 0;
    const rangeTargets = delta.grants.has('poke') ? analyzeDraft(picks).enemies.filter(e=>e.profile.weaknesses.has('low-range')).length : 0;
    const onHitTargets = delta.grants.has('on-hit') && baseProfile.capabilities.has('tank-shred') ? analyzeDraft(picks).enemies.filter(e=>e.profile.threats.has('frontline')).length : 0;
    const reasons = [...matchup.reasons];
    if (synergy) reasons.push('supports basic-attack kit');
    if (rangeTargets) reasons.push('range benefit against short-range kits');
    if (onHitTargets) reasons.push('extends on-hit frontline pressure');
    if (delta.removes.size) reasons.push(`tradeoff: removes ${[...delta.removes].join(', ').replaceAll('-', ' ')}`);
    augment.mechanics?.tradeoffs?.forEach(tradeoff => reasons.push(`tradeoff: ${tradeoff}`));
    if (!reasons.length) reasons.push(picks.some(p=>p.name) ? 'kit benefit; no strong matchup advantage identified' : 'kit benefit; enemy matchup unknown');
    const defensiveLoss = delta.removes.has('armor-amplification') && analyzeDraft(picks).enemies.some(e=>e.profile.threats.has('dive')||e.profile.threats.has('burst')) ? 6 : 0;
    const increasedRisk = augment.name === 'Tiny Titan' && analyzeDraft(picks).enemies.some(e=>e.profile.threats.has('burst')||e.profile.threats.has('dive')) ? 8 : 0;
    return { option: augment, score: Math.max(0, 10 + matchup.score + synergy + rangeTargets*3 + onHitTargets*2 - defensiveLoss - increasedRisk), reasons, tags: [...delta.grants], eligible: true, unmet: [] };
  }).sort(compareAdvice);
}

function optionRequirements(option: EternalTrait | EternalBlessing, profile: Profile): string[] {
  const effects = new Set(option.effects);
  const has = (name: string) => profile.capabilities.has(name);
  const missing: string[] = [];
  if (effects.has('immobilize') && !effects.has('damage-over-time') && !has('immobilize')) missing.push('requires your own immobilizing ability');
  if (effects.has('anti-heal') && effects.has('immobilize') && effects.has('damage-over-time') && !has('immobilize') && !has('dot')) missing.push('requires damage over time or immobilization');
  if (effects.has('heal-trigger') && effects.has('shield-trigger') && !has('healing') && !has('shield')) missing.push('requires a heal or shield');
  if (effects.has('stealth-exit') && !has('stealth') && !has('mobility')) missing.push('requires a dash, leap, teleport, or stealth');
  if (option.name === 'Taste of Iron' && !has('dot')) missing.push('requires outgoing damage over time');
  if (effects.has('ultimate-damage') && !has('damaging-ultimate')) missing.push('requires a damaging ultimate');
  if (effects.has('magical-lifesteal') && !has('magical-damage')) missing.push('requires magical damage');
  if ((effects.has('max-mana-shield') || effects.has('current-mana-scaling')) && !has('mana')) missing.push('requires mana');
  return missing;
}

function optionCapabilities(option: EternalTrait | EternalBlessing) {
  const effects = new Set([...option.tags, ...option.effects]);
  const caps = new Set<string>();
  const groups: Record<string, string[]> = {
    'anti-heal': ['anti-heal'],
    'tank-shred': ['max-health-damage', 'current-health-damage', 'anti-tank', 'anti-frontline'],
    'armor-shred': ['physical-armor-reduction', 'armor-shred'],
    'shield': ['shield', 'max-mana-shield'],
    'damage-reduction': ['damage-reduction', 'damage-mitigation', 'aoe-damage-reduction', 'non-aoe-damage-reduction', 'enemy-damage-reduction', 'damage-delay'],
    'healing': ['health-restore', 'health-on-hit', 'hero-damage-healing', 'ally-healing', 'healing', 'sustain', 'omnivamp', 'magical-lifesteal', 'max-health-regeneration'],
    'durability': ['physical-armor', 'magical-armor', 'armor-amplification', 'max-health', 'armor-steal', 'armor-stacking'],
    'cleanse': ['cleanse'],
    'peel': ['attack-speed-reduction', 'movement-speed-steal', 'slow'],
  };
  for (const [cap, signals] of Object.entries(groups)) if (signals.some(s => effects.has(s))) caps.add(cap);
  return caps;
}

export function scoreEternalOption<T extends EternalTrait>(option: T, eternal: Eternal, picks: EnemyPick[], hero: Hero, role: Role, augment?: HeroAugment): DraftAdvice<T> {
  const profile = profileFor(hero, augment);
  const unmet = optionRequirements(option, profile);
  const caps = optionCapabilities(option);
  const matchup = scoreAnswers(caps, picks, role);
  const reasons = [...matchup.reasons];
  let synergy = 0;
  const own = new Set([...option.tags, ...option.effects]);
  if ((own.has('on-hit') || own.has('attack-speed') || own.has('basic-attack')) && profile.capabilities.has('basic-attack-focus')) {
    synergy += 5; reasons.push('fits basic-attack kit');
  }
  if ((own.has('ability-damage') || own.has('cooldown-reduction') || own.has('ability-haste')) && profile.capabilities.has('ability-focus')) {
    synergy += 5; reasons.push('fits ability-focused kit');
  }
  if (own.has('magical-power') && profile.capabilities.has('magical-damage')) synergy += 4;
  if (own.has('physical-power') && profile.capabilities.has('physical-damage')) synergy += 4;
  if (augment) {
    const delta = augmentDelta(augment);
    const healingSynergy = delta.grants.has('healing') && (own.has('healing-amplification') || own.has('healing-received') || own.has('shielding-received'));
    const overlaps = [...delta.grants].some(t => own.has(t));
    if (overlaps || healingSynergy) { synergy += 6; reasons.push(`synergy with ${augment.name}`); }
  }
  if (own.has('increased-damage-taken') || own.has('max-health-reduction')) {
    if (analyzeDraft(picks).enemies.some(e => e.profile.threats.has('burst') || e.profile.threats.has('dive'))) { synergy -= 6; reasons.push('tradeoff: increased survival risk'); }
  }
  if (!reasons.length) reasons.push(picks.some(p=>p.name) ? 'general kit option; no strong matchup advantage identified' : 'baseline option; enemy matchup unknown');
  return { option, score: unmet.length ? 0 : Math.max(0, 10 + matchup.score + synergy), reasons: unmet.length ? unmet : reasons, tags: [...own], eligible: !unmet.length, unmet };
}

export function rankBlessings(eternal: Eternal, group: 1 | 2, picks: EnemyPick[], hero: Hero, role: Role, augment?: HeroAugment) {
  return (group === 1 ? eternal.minorBlessing1 : eternal.minorBlessing2)
    .map(b => scoreEternalOption(b, eternal, picks, hero, role, augment)).sort(compareAdvice);
}

export function rankEternals(picks: EnemyPick[], hero: Hero, role: Role, augment?: HeroAugment) {
  if (!isVerified(hero)) return [];
  return eternals.filter(e => e.verification.status === 'source-backed').map(eternal => {
    const main = scoreEternalOption(eternal.mainTrait, eternal, picks, hero, role, augment);
    const blessing1 = rankBlessings(eternal, 1, picks, hero, role, augment);
    const blessing2 = rankBlessings(eternal, 2, picks, hero, role, augment);
    const identity = hero.classes?.includes(eternal.role) || (role === 'support' && eternal.role === 'support') ? 12 : 0;
    return { ...main, option: eternal, score: main.eligible ? main.score + identity + Math.round((blessing1[0].score + blessing2[0].score) / 4) : 0, blessing1, blessing2 };
  }).sort(compareAdvice);
}

function compareAdvice<T extends { name: string }>(a: DraftAdvice<T>, b: DraftAdvice<T>) {
  return Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.option.name.localeCompare(b.option.name);
}
