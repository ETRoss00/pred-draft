import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the draft companion shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Predecessor Counterpick<\/title>/i);
  assert.match(html, /Kit draft lab/);
  assert.match(html, /Enemy draft/);
  assert.match(html, /Data audit/);
  assert.match(html, /Counter picks/);
  assert.match(html, /I already picked/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/);
});

test("keeps the kit data in a source-audited data folder", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const heroes = await readFile(new URL("../data/predecessor/heroes.json", import.meta.url), "utf8");
  const crests = await readFile(new URL("../data/predecessor/crests.json", import.meta.url), "utf8");
  const items = await readFile(new URL("../data/predecessor/items.json", import.meta.url), "utf8");
  const eternals = await readFile(new URL("../data/predecessor/eternals.json", import.meta.url), "utf8");
  const heroData = JSON.parse(heroes);
  const audit = await readFile(new URL("../data/predecessor/audit.ts", import.meta.url), "utf8");
  const auditScript = await readFile(new URL("../scripts/audit-data.mjs", import.meta.url), "utf8");
  const crestAudit = await readFile(new URL("../data/predecessor/crests.ts", import.meta.url), "utf8");
  const itemAudit = await readFile(new URL("../data/predecessor/items.ts", import.meta.url), "utf8");
  const eternalAudit = await readFile(new URL("../data/predecessor/eternals.ts", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");

  assert.doesNotMatch(page, /const heroes: Hero\[\] = \[/);
  assert.match(page, /from "@\/data\/predecessor\/audit"/);
  assert.match(heroes, /"schemaVersion": 2/);
  assert.doesNotMatch(heroes, /"official-hero-gallery"/);
  assert.doesNotMatch(heroes, /"predecessor-wiki-hero"/);
  assert.doesNotMatch(heroes, /"prototype-kit-taxonomy"/);
  assert.doesNotMatch(heroes, /"kitStatus": "prototype"/);
  assert.doesNotMatch(heroes, /"threats": \[\]/);
  assert.doesNotMatch(heroes, /"answers": \[\]/);
  assert.doesNotMatch(heroes, /"weaknesses": \[\]/);
  assert.match(heroes, /"argus-manual-entry-2026-08-23"/);
  assert.doesNotMatch(heroes, /"argus-game-client-screenshots-2026-08-02"/);
  assert.doesNotMatch(heroes, /1000001800\.jpg/);
  assert.match(heroes, /"verified-combined-hero-roles-2026-08-23"/);
  assert.match(heroes, /"scarlett-manual-entry-2026-08-23"/);
  assert.match(heroes, /"name": "Disintegrate"/);
  assert.match(heroes, /"name": "Infinite Obliteration"/);
  assert.match(heroes, /"name": "Argus"[\s\S]*?"damage": "magical"/);
  assert.match(heroes, /"name": "Argus"[\s\S]*?"name": "Dread Nova"[\s\S]*?"description": "Argus lobs an unstable orb of energy\./);
  assert.match(heroes, /"name": "Argus"[\s\S]*?"name": "Dread Nova"[\s\S]*?"scaling": \{[\s\S]*?"magicalPowerRatio": 0\.5/);
  assert.match(heroes, /"name": "Argus"[\s\S]*?"name": "Dread Nova"[\s\S]*?"cooldown": \[[\s\S]*?16[\s\S]*?15[\s\S]*?14[\s\S]*?13[\s\S]*?12/);
  assert.match(heroes, /"name": "Gadget"[\s\S]*?"damage": "magical"/);
  assert.match(heroes, /"name": "Howitzer"[\s\S]*?"damage": "magical"/);
  const heroByName = new Map(heroData.heroes.map((hero) => [hero.name, hero]));
  for (const [name, damage] of [
    ["Akeron", "magical"],
    ["Aurora", "magical"],
    ["Boris", "magical"],
    ["Crunch", "physical"],
    ["Dekker", "magical"],
    ["GRIM.exe", "magical"],
    ["Kwang", "magical"],
    ["Mourn", "physical"],
    ["Rampage", "magical"],
    ["Riktor", "magical"],
    ["Sevarog", "magical"],
    ["Shinbi", "magical"],
    ["Steel", "magical"],
    ["TwinBlast", "mixed"],
  ]) {
    assert.equal(heroByName.get(name)?.damage, damage, `${name} should use primary kit damage inferred from non-basic abilities`);
  }
  const staleWeaknessTags = new Set(["burst-vulnerable", "cc-vulnerable", "low-damage", "mana-dependent", "needs-matchup-review"]);
  assert.deepEqual(
    heroData.heroes.flatMap((hero) => hero.weaknesses.filter((tag) => staleWeaknessTags.has(tag))),
    [],
  );
  assert.match(heroes, /"name": "Scarlett"[\s\S]*?"roles": \[[\s\S]*?"offlane"[\s\S]*?"jungle"/);
  assert.match(heroes, /"name": "Swan Song"/);
  assert.match(heroes, /"name": "Scarlet Dawn"/);
  assert.match(heroes, /"name": "Argus"[\s\S]*?"roles": \[[\s\S]*?"midlane"[\s\S]*?"support"/);
  assert.match(heroes, /"name": "Yin"[\s\S]*?"roles": \[[\s\S]*?"jungle"[\s\S]*?"offlane"/);
  assert.match(heroes, /"name": "Legion"[\s\S]*?"roles": \[[\s\S]*?"carry"/);
  assert.match(heroes, /"roleStatus": "source-backed"/);
  assert.doesNotMatch(heroes, /"roleStatus": "needs-review"/);
  assert.match(crests, /"schemaVersion": 1/);
  assert.match(crests, /"Eviscerator"/);
  assert.match(crests, /"Liberator"/);
  assert.match(crests, /"Pacifier"/);
  assert.match(crests, /"Exodus"/);
  assert.match(crests, /"Leafsong"/);
  assert.match(crests, /"Rift Walkers"/);
  assert.match(crests, /"Tranquility"/);
  assert.match(crests, /"Pygmy Dust"/);
  assert.match(crests, /"Epoch"/);
  assert.match(crests, /"Obelisk"/);
  assert.match(crests, /"Time-Flux Band"/);
  assert.match(crests, /"Winter's Fury"/);
  assert.match(crests, /"Nyr Warboots"/);
  assert.match(crests, /"Razorback"/);
  assert.match(crests, /"Saphir's Mantle"/);
  assert.match(crests, /"Gamma Gloop"/);
  assert.match(crests, /"Brutallax"/);
  assert.match(crests, /"Iceskorn Talons"/);
  assert.match(crests, /"Judgement"/);
  assert.match(crests, /"Gravitum"/);
  assert.match(crests, /"Nex"/);
  assert.match(crests, /"Witchstalker"/);
  assert.match(crests, /"Abyssal Dart"/);
  assert.match(crests, /"Ortus"/);
  assert.match(items, /"schemaVersion": 1/);
  assert.match(items, /"Nuclear Rounds"/);
  assert.match(items, /"Onixian Quiver"/);
  assert.match(items, /"Tainted Rounds"/);
  assert.match(items, /"Sky Splitter"/);
  assert.match(items, /"Imperator"/);
  assert.match(items, /"Warp Stream"/);
  assert.match(items, /"Tainted Totem"/);
  assert.match(items, /"Truesilver Bracelet"/);
  assert.match(items, /"Enra's Blessing"/);
  assert.match(items, /"Devotion"/);
  assert.match(items, /"Dreambinder"/);
  assert.match(items, /"Caustica"/);
  assert.match(items, /"Megacosm"/);
  assert.match(items, /"Lifecore"/);
  assert.match(items, /"Oblivion Crown"/);
  assert.match(items, /"Flux Matrix"/);
  assert.match(items, /"Fire Blossom"/);
  assert.match(items, /"Fist Of Razuul"/);
  assert.match(items, /"Raiment of Renewal"/);
  assert.match(items, /"Cursed Scroll"/);
  assert.match(items, /"Volcanica"/);
  assert.match(items, /"Gaia Greaves"/);
  assert.match(items, /"Tainted Blade"/);
  assert.match(items, /"Mutilator"/);
  assert.match(items, /"Aegis Of Agawar"/);
  assert.match(items, /"Echelon Cloak"/);
  assert.match(items, /"Malady"/);
  assert.match(items, /"Nightfall"/);
  assert.match(items, /"Tainted Trident"/);
  assert.match(items, /"The Perforator"/);
  assert.match(eternals, /"schemaVersion": 1/);
  assert.match(eternals, /"Marrow"/);
  assert.match(eternals, /"Blood Bank"/);
  assert.match(eternals, /"Vermis"/);
  assert.match(eternals, /"Mechadrive"/);
  assert.match(eternals, /"Weald"/);
  assert.match(eternals, /"Natural Resistance"/);
  assert.match(eternals, /"Exarch"/);
  assert.match(eternals, /"Delayed Fate"/);
  assert.match(eternals, /"Lotus"/);
  assert.match(eternals, /"Prima Donna"/);
  assert.match(eternals, /"Pilow"/);
  assert.match(eternals, /"Lil Sucker"/);
  assert.match(eternals, /"Vesh"/);
  assert.match(eternals, /"The Tenth Seal"/);
  assert.match(eternals, /"Xyris"/);
  assert.match(eternals, /"Bone Collector"/);
  assert.match(eternals, /"Idrisil"/);
  assert.match(eternals, /"Diamond Tip"/);
  assert.match(eternals, /"Knell"/);
  assert.match(eternals, /"Resonant Repair"/);
  assert.match(eternals, /"Krix"/);
  assert.match(eternals, /"Festering Wounds"/);
  assert.match(eternals, /"Nihil"/);
  assert.match(eternals, /"Inescapable"/);
  assert.match(eternals, /"Thraex"/);
  assert.match(eternals, /"Rallying Roar"/);
  assert.match(eternals, /"Aion"/);
  assert.match(eternals, /"Runic Focus"/);
  assert.match(eternals, /"Demiurge"/);
  assert.match(eternals, /"Memory Leak"/);
  assert.match(eternals, /"Satariel"/);
  assert.match(eternals, /"Psychosis"/);
  assert.match(audit, /auditHeroData/);
  assert.match(audit, /inferPrimaryKitDamage/);
  assert.match(audit, /ability\.slot !== "basic"/);
  assert.match(audit, /Basic attack damage is excluded/);
  assert.match(auditScript, /function inferPrimaryKitDamage/);
  assert.match(auditScript, /ability\.slot !== "basic"/);
  assert.match(audit, /fullyVerifiedHeroes/);
  assert.match(audit, /sourceBackedKits/);
  assert.match(crestAudit, /auditCrestData/);
  assert.match(itemAudit, /auditItemData/);
  assert.match(eternalAudit, /auditEternalData/);
  assert.match(page, /const counterRules = \[/);
  assert.match(page, /punishes CC vulnerability/);
  assert.match(page, /punishes healing vulnerability/);
  assert.match(page, /function hasSourceBackedKit/);
  assert.match(page, /verifiedEnemies/);
  assert.match(page, /sourceBackedKitHeroes/);
  assert.match(page, /Prototype hero kit tags are visible for audit only and are not used for recommendations/);
  assert.match(page, /const roleMatchupWeights/);
  assert.match(page, /matchup answer/);
  assert.match(page, /peels dive/);
  assert.match(page, /frontline shred/);
  assert.match(page, /recommendBuild/);
  assert.match(page, /buildSlots/);
  assert.match(page, /augment-synergy/);
  assert.match(page, /lane-counter/);
  assert.match(page, /role-identity/);
  assert.match(page, /team-counter/);
  assert.match(page, /scoreBuildItem/);
  assert.match(page, /pickBuildItem/);
  assert.match(page, /scoreLaneCounter/);
  assert.match(page, /scoreTeamCounter/);
  assert.match(page, /Phased match build/);
  assert.match(page, /phase: "early"/);
  assert.match(page, /phase: "mid"/);
  assert.match(page, /phase: "late"/);
  assert.match(page, /recommendAugments/);
  assert.match(page, /scoreAugment/);
  assert.match(page, /augmentTextSignals/);
  assert.match(page, /roleMatchupWeights\[role\]\[enemyRole\]/);
  assert.match(page, /formatAugmentCategory/);
  assert.match(page, /isPlaceholderAugmentDescription/);
  assert.match(page, /hero-specific option/);
  assert.doesNotMatch(page, /needs full augment text for matchup weighting/);
  assert.match(page, /Actual augment options/);
  assert.match(page, /lockedHero\.augments/);
  assert.match(page, /!isPlaceholderAugmentDescription\(augment\.description\)/);
  assert.match(layout, /kit-based draft assistant/i);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
