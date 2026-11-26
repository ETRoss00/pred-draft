import assert from 'node:assert/strict';
import test from 'node:test';
import { performance } from 'node:perf_hooks';
import { loadTypeScript } from '../scripts/lib/load-typescript.mjs';

const draft = loadTypeScript('data/predecessor/draft.ts');
const { heroes, auditHeroData, predecessorHeroData, inferPrimaryKitDamage } = loadTypeScript('data/predecessor/audit.ts');
const { eternals } = loadTypeScript('data/predecessor/eternals.ts');
const hero = name => { const h=heroes.find(h=>h.name===name); assert.ok(h, name); return h; };
const eternal = name => eternals.find(e=>e.name===name);
const picks = (...names) => names.map(name=>({name}));
const sustain = picks('Grux','Khaimera','Narbash','Morigesh','Sparrow');
const dive = picks('Riktor','Khaimera','Grux','Gideon','Murdock');
const scenarios = [
  ['carry',dive],
  ['carry',picks('Muriel','Sparrow','Greystone','Rampage','The Fey')],
  ['support',picks('Kira','Kallari','Steel','Aurora','Gideon')],
  ['midlane',picks('Kallari','Gideon','Serath','Riktor','Kira')],
  ['offlane',sustain],
  ['jungle',picks('Steel','Sevarog','Rampage','Gadget','Murdock')],
];

for (const [role,enemies] of scenarios) {
  test(`${role}: every partial/full draft stays role-valid, available, explained and deterministic (${enemies[0].name})`,()=>{
    for(let n=0;n<=5;n++) {
      const partial=enemies.slice(0,n);
      const result=draft.rankHeroes(partial,role);
      assert.ok(result.length>0);
      assert.deepEqual(result,draft.rankHeroes(partial,role));
      assert.ok(result.every(a=>draft.heroFitsRole(a.option,role)&&!partial.some(p=>p.name===a.option.name)&&a.reasons.length));
      assert.ok(draft.rankHeroes(partial,role,'a').every(a=>draft.heroFitsRole(a.option,role)));
      assert.deepEqual(partial,enemies.slice(0,n),'scoring must not mutate picks');
    }
  });
}

test('all verified heroes have full supplied descriptions and complete slots',()=>{
  for(const h of heroes) {
    assert.ok(draft.isVerified(h),h.name);
    assert.equal(new Set(h.abilities.map(a=>a.slot)).size,6);
    assert.equal(h.augments.length,3);
    assert.ok([...h.abilities,...h.augments].every(a=>a.description&&!/^User-verified text entry/.test(a.description)),h.name);
    assert.equal(h.damage,inferPrimaryKitDamage(h));
  }
  assert.match(hero('Greystone').augments.find(a=>a.name==='Tainted Oath').description,/50% Blight/);
  assert.deepEqual(hero('Argus').abilities.find(a=>a.slot==='primary').scaling.damage,[85,125,165,205,245]);
});

test('audit rejects source-backed placeholder regressions',()=>{
  const data=structuredClone(predecessorHeroData);
  data.heroes[0].augments[0].description='User-verified text entry for Adele\'s augment.';
  assert.ok(auditHeroData(data).errors.some(e=>/placeholder/.test(e.message)));
  assert.equal(draft.isVerified(data.heroes[0]),false);
});

test('threat and weakness counts are separate and each hero counts only once',()=>{
  const one=draft.analyzeDraft(picks('Argus'));
  const repeated=draft.analyzeDraft(picks('Argus','Argus'));
  assert.deepEqual(one,repeated);
  assert.ok([...one.threatCounts.values()].every(n=>n===1));
  assert.equal(one.weaknessCounts.get('burst'),1);
});

test('Tainted Oath responds to healing compositions',()=>{
  const options=draft.rankAugments(sustain,hero('Greystone'),'offlane');
  assert.equal(options[0].option.name,'Tainted Oath');
  assert.ok(options[0].score>draft.rankAugments([],hero('Greystone'),'offlane').find(a=>a.option.name==='Tainted Oath').score);
  assert.match(options[0].reasons.join(' '),/healing/);
});

test('negated augment benefits are never credited as grants',()=>{
  const val=hero('Valmont');
  const split=val.augments.find(a=>a.name==='Vein Splitter');
  assert.ok(!draft.augmentDelta(split).grants.has('ground'));
  assert.ok(!draft.augmentDelta(split).grants.has('immobilize'));
  assert.ok(!draft.profileFor(val,split).capabilities.has('ground'));
  const relentless=hero('Kaelen').augments.find(a=>a.name==='Relentless Hunt');
  assert.ok(!draft.augmentDelta(relentless).grants.has('armor-amplification'));
  assert.ok(!draft.profileFor(hero('Kaelen'),relentless).capabilities.has('armor-amplification'));
  assert.ok(!draft.augmentDelta(val.augments.find(a=>a.name==='Rupturing Fangs')).grants.has('healing'));
});

test('terrain references and spell shields do not grant unrelated capabilities',()=>{
  assert.equal(draft.profileFor(hero('Kaelen')).capabilities.has('ground'),false);
  assert.equal(draft.profileFor(hero('Feng Mao')).capabilities.has('shield'),false);
});

test('Sparrow cannot trigger Crush; a rooting hero can',()=>{
  const vermis=eternal('Vermis');
  const invalid=draft.rankBlessings(vermis,1,dive,hero('Sparrow'),'carry').find(a=>a.option.name==='Crush');
  assert.equal(invalid.eligible,false);
  assert.equal(invalid.score,0);
  assert.match(invalid.unmet.join(' '),/immobilizing/);
  assert.equal(draft.rankBlessings(vermis,1,dive,hero('Murdock'),'carry').find(a=>a.option.name==='Crush').eligible,true);
});

test('Exarch requires healing/shielding and Polarity Strike enables it',()=>{
  const dekker=hero('Dekker'),exarch=eternal('Exarch');
  assert.equal(draft.scoreEternalOption(exarch.mainTrait,exarch,dive,dekker,'support').eligible,false);
  const augment=dekker.augments.find(a=>a.name==='Polarity Strike');
  assert.equal(draft.scoreEternalOption(exarch.mainTrait,exarch,dive,dekker,'support',augment).eligible,true);
});

test('ability-specific tradeoffs remove only the affected source',()=>{
  const legion=hero('Legion');
  assert.equal(draft.profileFor(legion).capabilities.has('healing'),true);
  assert.equal(draft.profileFor(legion,legion.augments.find(a=>a.name==='Press the Advantage')).capabilities.has('healing'),false);
  const akeron=hero('Akeron');
  assert.equal(draft.profileFor(akeron,akeron.augments.find(a=>a.name==='Roar of Torment')).capabilities.has('healing'),true,'Crushing Maw still heals');
});

test('blessings score their own mechanics rather than inherited Eternal tags',()=>{
  const vermis=eternal('Vermis'),sub=vermis.minorBlessing2.find(b=>b.name==='Sub-Surface');
  const result=draft.scoreEternalOption(sub,vermis,dive,hero('Sparrow'),'carry');
  assert.ok(!result.tags.includes('frontline'));
  assert.ok(!result.tags.includes('armor-shred'));
  assert.ok(!result.reasons.some(r=>/durable frontline/.test(r)));
});

test('selected augments change Eternal/blessing evaluations',()=>{
  const val=hero('Valmont');
  const fangs=val.augments.find(a=>a.name==='Rupturing Fangs');
  const banquet=val.augments.find(a=>a.name==='Sanguine Banquet');
  const serialize=a=>draft.rankEternals(dive,val,'midlane',a).map(e=>[e.option.id,e.score,e.blessing1.map(b=>b.score),e.blessing2.map(b=>b.score)]);
  assert.notDeepEqual(serialize(fangs),serialize(banquet));
});

test('empty drafts provide baselines with unknown-matchup reasons',()=>{
  assert.ok(draft.rankHeroes([],'carry').every(a=>a.reasons.some(r=>/unknown/.test(r))));
  assert.ok(draft.rankAugments([],hero('Sparrow'),'carry').every(a=>a.reasons.length));
});

test('alternate Eternal categories remain available for kit synergy',()=>{
  const all=draft.rankEternals([],hero('Ikra'),'midlane');
  assert.equal(all.length,eternals.length);
  assert.ok(all.some(a=>a.option.name==='Aion'));
});

test('draft scoring stays local and practical across all scenarios',()=>{
  const start=performance.now();
  for(const [role,enemies] of scenarios) for(let n=0;n<=5;n++) {
    const partial=enemies.slice(0,n),h=draft.rankHeroes(partial,role)[0].option;
    const augment=draft.rankAugments(partial,h,role)[0].option;
    draft.rankEternals(partial,h,role,augment);
  }
  assert.ok(performance.now()-start<5000,'36 full local recommendation passes should stay comfortably below five seconds');
});
