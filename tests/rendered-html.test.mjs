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
  const audit = await readFile(new URL("../data/predecessor/audit.ts", import.meta.url), "utf8");
  const crestAudit = await readFile(new URL("../data/predecessor/crests.ts", import.meta.url), "utf8");
  const itemAudit = await readFile(new URL("../data/predecessor/items.ts", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");

  assert.doesNotMatch(page, /const heroes: Hero\[\] = \[/);
  assert.match(page, /from "@\/data\/predecessor\/audit"/);
  assert.match(heroes, /"schemaVersion": 2/);
  assert.match(heroes, /"official-hero-gallery"/);
  assert.match(heroes, /"argus-game-client-screenshots-2026-08-02"/);
  assert.match(heroes, /"name": "Disintegrate"/);
  assert.match(heroes, /"name": "Infinite Obliteration"/);
  assert.match(heroes, /"roleStatus": "needs-review"/);
  assert.match(heroes, /"roleStatus": "source-backed"/);
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
  assert.match(audit, /auditHeroData/);
  assert.match(audit, /fullyVerifiedHeroes/);
  assert.match(crestAudit, /auditCrestData/);
  assert.match(itemAudit, /auditItemData/);
  assert.match(page, /const counterRules = \[/);
  assert.match(page, /peels dive/);
  assert.match(page, /frontline shred/);
  assert.match(page, /recommendBuild/);
  assert.match(layout, /kit-based draft assistant/i);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
