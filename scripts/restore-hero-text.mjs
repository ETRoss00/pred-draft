import fs from 'node:fs';
import { loadTypeScript } from './lib/load-typescript.mjs';

const file = new URL('../data/predecessor/heroes.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const source = JSON.parse(fs.readFileSync(new URL('../data/predecessor/sources/hero-text-entries-2026-11-26.json', import.meta.url), 'utf8'));
const { inferPrimaryKitDamage } = loadTypeScript(new URL('../data/predecessor/audit.ts', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const key = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const clean = text => text.replace(/\*\*/g, '').replace(/&#x([\da-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16))).replace(/\r/g, '').trim();
const effectsFor = text => {
  const positive = text.toLowerCase().replace(/[^.!?]*(?:no longer|can no longer|but cannot)[^.!?]*/g, '');
  const rules = [
    [/physical damage/, 'physical-damage'], [/magical damage/, 'magical-damage'], [/true damage/, 'true-damage'],
    [/\b(stun|stuns|stunned|stunning)\b/, 'stun'], [/\b(root|roots|rooted|rooting)\b/, 'root'],
    [/\b(suppress|suppresses|suppressed|suppressing)\b/, 'suppress'], [/\bmesmeriz/, 'mesmerize'],
    [/\bsuspend/, 'suspend'], [/\brestrain/, 'restrain'],
    [/knock(?:ed|ing)?\s*up/, 'knock-up'], [/\bsilenc/, 'silence'], [/\bfear(?:ed|s)?\b/, 'fear'],
    [/\bground(?:s|ed|ing)\b/, 'ground'], [/\bpull(?:s|ing|ed)?\b/, 'pull'], [/\bpush(?:es|ing|ed)?\b|knock(?:ed|ing)?\s*back/, 'push'],
    [/\bslow(?:s|ed|ing)?\b/, 'slow'], [/\bblind/, 'blind'], [/\bheals?\b|\bhealing (?:him|her|you|all|for)|health regen|restores?[^.]*health/i, 'healing'],
    [/\bshield|\bbarrier/, 'shield'], [/damage reduction|damage mitigation/, 'damage-reduction'],
    [/\bcleans/, 'cleanse'], [/cc immun|crowd control immun|unstoppable/, 'cc-immunity'],
    [/spell\s*shield|blocks?[^.]*ability/, 'spell-shield'], [/projectiles?[^.]*(?:block|halt)|block[^.]*projectile/, 'projectile-block'],
    [/reflect[^.]*projectile/, 'projectile-reflect'], [/\bdash|\bleap|\bteleport|\bjump/, 'mobility'],
    [/movement speed/, 'movement-speed'], [/attack speed/, 'attack-speed'], [/critically|critical (?:strike|chance|damage)/, 'crit'],
    [/on.hit/, 'on-hit'], [/physical armor[^.]*shred|shred[^.]*physical armor|physical armor[^.]*reduc/, 'physical-armor-shred'],
    [/magical armor[^.]*shred|shred[^.]*magical armor|magical armor[^.]*reduc/, 'magical-armor-shred'],
    [/anti.heal|blight|(?:reduc|decreas)[^.]*healing/, 'anti-heal'], [/\bomnivamp|\blifesteal/, 'sustain'],
    [/target.?s (?:maximum|max|current) health|enemy max health|of their (?:maximum|max|current) health/, 'tank-shred'], [/missing health/, 'missing-health-scaling'],
    [/\bexecute|\bexecuting/, 'execute'], [/cooldown[^.]*(?:reduc|reset|refund)|(?:reduc|reset|refund)[^.]*cooldown/, 'cooldown-reduction'],
    [/\barea\b|nearby enem|all enemies|all enemy|zone|field|dome|storm/, 'area-damage'],
    [/more damage|increased damage|damage[^.]*increased|damage[^.]*more/, 'damage-amplification'],
    [/\bcamouflage|\bstealth|\binvisible/, 'stealth'], [/infinite range|unlimited range|long.range|increased range|more range|further/, 'poke'],
    [/\bstack|permanently|\bgold|\bexperience|\bxp/, 'scaling'], [/\bduration/, 'duration-modifier'],
  ];
  return rules.filter(([pattern]) => pattern.test(positive)).map(([,tag]) => tag);
};
const slots = { BASIC:'basic', PASSIVE:'passive', PRIMARY:'primary', SECONDARY:'secondary', ALTERNATE:'alternate', ULTIMATE:'ultimate' };
let restored = 0;
for (const entry of source.entries) {
  const hero = data.heroes.find(h => key(h.name) === key(entry.hero));
  if (!hero) throw new Error(`No hero for ${entry.hero}`);
  const text = clean(entry.text);
  const lines = text.split('\n');
  const augmentStarts = hero.augments.map(a => lines.findIndex(l => key(l) === key(a.name)));
  if (augmentStarts.some(i => i < 0)) throw new Error(`Missing augment headings for ${hero.name}`);
  const firstAugment = Math.min(...augmentStarts);
  const abilityHeads = lines.map((line,index) => ({index,match:line.match(/^(.+?)\s*\((BASIC|PASSIVE|PRIMARY|SECONDARY|ALTERNATE|ULTIMATE)\)\s*$/)})).filter(h => h.match);
  if (abilityHeads.length !== 6) throw new Error(`Expected six abilities for ${hero.name}, got ${abilityHeads.length}`);
  const sourceRef = `${hero.id}-restored-text-2026-11-26`;
  data.sources[sourceRef] = {label:`${hero.name} restored user text`,url:null,use:'Full original user text archived in sources/hero-text-entries-2026-11-26.json; role mappings remain unchanged.'};
  hero.abilities = abilityHeads.map((head,i) => {
    const slot = slots[head.match[2]];
    const prior = hero.abilities.find(a => a.slot === slot);
    const body = lines.slice(head.index+1, abilityHeads[i+1]?.index ?? firstAugment);
    const kind = body.find(l=>/^Type:/.test(l))?.slice(5).trim().toLowerCase() ?? prior.kind;
    const parseValues = label => body.find(l=>l.startsWith(label+':'))?.slice(label.length+1).trim().split('/').map(Number);
    const description = body.filter(l=>! /^(?:Type|Cooldown|Cost|Augments):/.test(l)).join('\n').trim();
    const ability = {...prior,name:head.match[1],kind,description,effects:effectsFor(description),sourceRef};
    const cooldown=parseValues('Cooldown'),cost=parseValues('Cost');
    if(cooldown?.every(Number.isFinite)) ability.cooldown=cooldown;
    if(cost?.every(Number.isFinite)) ability.cost=cost;
    const physical=/physical damage/i.test(description),magical=/magical damage/i.test(description);
    if(physical||magical) ability.damageType=physical&&magical?'mixed':physical?'physical':'magical';
    else delete ability.damageType;
    if(!ability.effects.length) ability.effects=['kit-modifier'];
    return ability;
  });
  hero.augments = hero.augments.map((augment,i) => {
    const start=augmentStarts[i];
    const end=Math.min(...augmentStarts.filter(n=>n>start),lines.length);
    const description=lines.slice(start+1,end).join('\n').trim();
    const tags=effectsFor(description).filter(t=>!['physical-damage','magical-damage','duration-modifier'].includes(t));
    return {...augment,description,tags:tags.length?tags:['kit-modifier'],sourceRef};
  });
  hero.sourceRefs.kit=sourceRef;
  hero.verification.notes='Full abilities and augments restored from the original user text archived in sources/hero-text-entries-2026-11-26.json. Previously encoded detailed scaling is retained; no missing or ambiguous numeric formula is invented.';
  hero.damage=inferPrimaryKitDamage(hero);
  restored++;
}
fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
console.log(`Restored ${restored} full hero kits from original text.`);
