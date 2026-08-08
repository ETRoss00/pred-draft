"use client";

import { useMemo, useState } from "react";
import { auditHeroData, heroes, predecessorHeroData, roles, type Hero, type Role } from "@/data/predecessor/audit";

type Advice = {
  name: string;
  role: string;
  score: number;
  reasons: string[];
  tags: string[];
};

const counterRules = [
  rule("dive", ["hard-cc", "peel", "anti-dive", "disengage"], "peels dive"),
  rule("mobility", ["hard-cc", "anti-dive"], "locks down mobility"),
  rule("engage", ["disengage", "peel", "zone-control", "anti-engage"], "stops engage"),
  rule("poke", ["anti-poke", "sustain", "dive", "backline-access"], "answers poke"),
  rule("burst", ["anti-burst", "shields", "frontline"], "absorbs burst"),
  rule("sustain", ["anti-heal", "burst"], "cuts sustain"),
  rule("frontline", ["tank-shred", "anti-frontline"], "frontline shred"),
  rule("zone-control", ["dive", "backline-access", "poke"], "breaks zones"),
  rule("pick", ["peel", "anti-burst", "frontline"], "denies picks"),
  rule("split-push", ["duelist", "waveclear", "global-presence"], "checks split push"),
  rule("objective-control", ["pick", "zone-control", "tank-shred"], "contests objectives"),
  rule("scaling", ["burst", "pick", "early-pressure"], "punishes scaling"),
  rule("low-mobility", ["poke", "pick", "burst"], "punishes immobile targets"),
  rule("low-range", ["poke", "zone-control"], "outranges short kits"),
  rule("weak-early", ["early-pressure", "dive", "duelist"], "pressures weak early game"),
];

const buildPlans = [
  plan("Dive control", ["dive", "mobility", "pick"], ["cleanse or stasis crest", "armor/health early", "peel-active support item"], "Survive first contact, then punish the diver after cooldowns."),
  plan("Anti-poke sustain", ["poke", "zone-control"], ["sustain crest", "regen or shielding item", "early magic resist if poke is magical"], "Reduce chip damage so the enemy cannot force objectives for free."),
  plan("Frontline shred", ["frontline", "sustain"], ["armor penetration", "percent-health damage", "anti-heal"], "Do not overbuild burst into tanks; prioritize damage that keeps working."),
  plan("Burst insurance", ["burst", "pick"], ["stasis/cleanse option", "defensive second item", "vision and spacing tools"], "Avoid being removed before the fight starts."),
  plan("Siege breaker", ["objective-control", "zone-control", "scaling"], ["waveclear item", "objective damage", "engage or flank tool"], "Clear waves, deny setup, and force fights before scaling takes over."),
];

function rule(threat: string, answers: string[], reason: string) {
  return { threat, answers, reason };
}

function plan(title: string, threats: string[], items: string[], note: string) {
  return { title, threats, items, note };
}


function analyze(enemyNames: string[]) {
  const enemies = enemyNames
    .map((name) => heroes.find((hero) => hero.name === name))
    .filter(Boolean) as Hero[];

  const counts = new Map<string, number>();
  const damage = { physical: 0, magical: 0, mixed: 0 };

  enemies.forEach((enemy) => {
    damage[enemy.damage] += 1;
    [...enemy.threats, ...enemy.weaknesses].forEach((tag) => {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    });
  });

  return {
    enemies,
    damage,
    topTraits: [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8),
    counts,
  };
}

function scoreHero(hero: Hero, enemyNames: string[], role: Role | "flex", lockedName: string) {
  const comp = analyze(enemyNames);
  let score = 0;
  const reasons = new Set<string>();
  const tags = new Set<string>();

  if (role !== "flex" && !hero.roles.includes(role)) score -= 100;
  if (hero.name === lockedName) score -= 100;
  if (enemyNames.includes(hero.name)) score -= 100;

  counterRules.forEach((counter) => {
    const threatCount = comp.counts.get(counter.threat) ?? 0;
    if (!threatCount) return;
    const matchingAnswers = counter.answers.filter((answer) => hero.answers.includes(answer) || hero.threats.includes(answer));
    if (matchingAnswers.length) {
      score += threatCount * (matchingAnswers.length > 1 ? 18 : 12);
      reasons.add(counter.reason);
      matchingAnswers.forEach((tag) => tags.add(tag));
    }
  });

  comp.enemies.forEach((enemy) => {
    hero.threats.forEach((threat) => {
      if (enemy.weaknesses.includes(threat)) {
        score += 10;
        reasons.add(`punishes ${enemy.name}`);
        tags.add(threat);
      }
    });
  });

  if (comp.damage.physical >= 3 && hero.answers.includes("frontline")) {
    score += 8;
    reasons.add("stable into physical pressure");
  }
  if (comp.damage.magical >= 3 && (hero.answers.includes("anti-burst") || hero.answers.includes("sustain"))) {
    score += 8;
    reasons.add("stable into magic pressure");
  }

  return {
    name: hero.name,
    role: hero.roles.join(" / "),
    score,
    reasons: [...reasons].slice(0, 4),
    tags: [...tags].slice(0, 5),
  };
}

function recommendBuild(enemyNames: string[], lockedHero?: Hero) {
  const comp = analyze(enemyNames);
  return buildPlans
    .map((build) => ({
      ...build,
      score: build.threats.reduce((sum, threat) => sum + (comp.counts.get(threat) ?? 0), 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((build) => ({
      ...build,
      heroNote: lockedHero
        ? `${lockedHero.name} brings ${lockedHero.answers.slice(0, 2).join(" and ")}. Build to cover the remaining draft pressure.`
        : "Lock a hero to tailor this into a tighter item order.",
    }));
}

export default function Home() {
  const [role, setRole] = useState<Role | "flex">("carry");
  const [enemyPicks, setEnemyPicks] = useState<string[]>(["", "", "", "", ""]);
  const [lockedHero, setLockedHero] = useState("");
  const [search, setSearch] = useState("");
  const [showAudit, setShowAudit] = useState(false);

  const enemyNames = enemyPicks.filter(Boolean);
  const comp = useMemo(() => analyze(enemyNames), [enemyNames]);
  const locked = heroes.find((hero) => hero.name === lockedHero);
  const audit = useMemo(() => auditHeroData(), []);

  const recommendations = useMemo(
    () =>
      heroes
        .map((hero) => scoreHero(hero, enemyNames, role, lockedHero))
        .filter((advice) => advice.score > 0 && advice.reasons.length)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .slice(0, 8),
    [enemyNames, role, lockedHero],
  );

  const builds = useMemo(() => recommendBuild(enemyNames, locked), [enemyNames, locked]);
  const availableHeroes = heroes.filter((hero) => !enemyPicks.includes(hero.name));
  const filteredHeroes = availableHeroes.filter((hero) => hero.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#191712]">
      <section className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <header className="sticky top-0 z-20 border-b border-[#2b29231a] bg-[#f7f4ee]/95 px-4 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a3524]">Kit draft lab</p>
              <h1 className="mt-1 text-2xl font-black leading-tight">Predecessor Counterpick</h1>
            </div>
            <div className="rounded-md bg-[#191712] px-3 py-2 text-right text-white">
              <p className="text-lg font-black">{enemyNames.length}/5</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#f1d08a]">enemy</p>
            </div>
          </div>
        </header>

        <div className="flex-1 space-y-5 px-4 py-5">
          <section className="rounded-lg border border-[#2b29231a] bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-[0.12em]">Your lane</h2>
              <button
                className="rounded-md border border-[#191712] px-3 py-1 text-xs font-bold"
                onClick={() => setRole(role === "flex" ? "carry" : "flex")}
              >
                {role === "flex" ? "Role locked" : "Flex mode"}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {roles.map((item) => (
                <button
                  key={item}
                  onClick={() => setRole(item)}
                  className={`rounded-md border px-2 py-2 text-sm font-bold capitalize ${
                    role === item ? "border-[#8a3524] bg-[#8a3524] text-white" : "border-[#2b29231a] bg-[#faf8f3]"
                  }`}
                >
                  {item}
                </button>
              ))}
              <button
                onClick={() => setRole("flex")}
                className={`rounded-md border px-2 py-2 text-sm font-bold ${
                  role === "flex" ? "border-[#8a3524] bg-[#8a3524] text-white" : "border-[#2b29231a] bg-[#faf8f3]"
                }`}
              >
                Flex
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-[#2b29231a] bg-white p-3 shadow-sm">
            <h2 className="mb-3 text-sm font-black uppercase tracking-[0.12em]">Enemy draft</h2>
            <div className="grid gap-2">
              {enemyPicks.map((pick, index) => (
                <select
                  key={index}
                  value={pick}
                  onChange={(event) => {
                    const next = [...enemyPicks];
                    next[index] = event.target.value;
                    setEnemyPicks(next);
                  }}
                  className="h-11 rounded-md border border-[#2b29231a] bg-[#faf8f3] px-3 text-sm font-semibold"
                  aria-label={`Enemy pick ${index + 1}`}
                >
                  <option value="">Enemy pick {index + 1}</option>
                  {heroes.map((hero) => (
                    <option key={hero.name} value={hero.name} disabled={enemyPicks.includes(hero.name) && pick !== hero.name}>
                      {hero.name}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-[#2b29231a] bg-white p-3 shadow-sm">
            <label className="mb-2 block text-sm font-black uppercase tracking-[0.12em]" htmlFor="locked-hero">
              I already picked
            </label>
            <select
              id="locked-hero"
              value={lockedHero}
              onChange={(event) => setLockedHero(event.target.value)}
              className="h-11 w-full rounded-md border border-[#2b29231a] bg-[#faf8f3] px-3 text-sm font-semibold"
            >
              <option value="">No locked hero</option>
              {availableHeroes.map((hero) => (
                <option key={hero.name} value={hero.name}>
                  {hero.name} ({hero.roles.join("/")})
                </option>
              ))}
            </select>
          </section>

          <section className="rounded-lg border border-[#2b29231a] bg-[#191712] p-3 text-white shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-[0.12em]">Enemy read</h2>
              <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-bold">{comp.enemies.length ? "Live" : "Waiting"}</span>
            </div>
            {comp.topTraits.length ? (
              <div className="flex flex-wrap gap-2">
                {comp.topTraits.map(([trait, count]) => (
                  <span key={trait} className="rounded-md bg-[#f1d08a] px-2 py-1 text-xs font-black text-[#191712]">
                    {trait.replaceAll("-", " ")} x{count}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#e9dfcf]">Add enemy picks to reveal draft pressure.</p>
            )}
          </section>

          <section className="rounded-lg border border-[#2b29231a] bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.12em]">Data audit</h2>
                <p className="mt-1 text-sm font-semibold text-[#665f52]">
                  {audit.heroCount} heroes / {audit.fullyVerifiedHeroes} fully verified / {audit.errors.length} errors
                </p>
              </div>
              <button
                className="rounded-md border border-[#191712] px-3 py-2 text-xs font-bold"
                onClick={() => setShowAudit((value) => !value)}
              >
                {showAudit ? "Hide" : "Review"}
              </button>
            </div>
            {showAudit && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {roles.map((item) => (
                    <p key={item} className="rounded-md bg-[#faf8f3] px-3 py-2 text-xs font-black capitalize text-[#191712]">
                      {item}: {audit.roleCoverage[item]}
                    </p>
                  ))}
                </div>
                <p className="rounded-md bg-[#fff5cf] px-3 py-2 text-sm font-semibold text-[#5f4610]">
                  Current patch: {predecessorHeroData.patch}. Role and kit fields marked as needs-review are visible here until checked against current game data.
                </p>
                {[...audit.errors, ...audit.warnings].slice(0, 8).map((issue, index) => (
                  <p key={`${issue.severity}-${issue.hero}-${issue.field}-${index}`} className="rounded-md bg-[#f4e0d9] px-3 py-2 text-xs font-bold text-[#8a3524]">
                    {issue.severity.toUpperCase()} / {issue.hero ?? "Dataset"} / {issue.field}: {issue.message}
                  </p>
                ))}
                {audit.warnings.length > 8 && <p className="text-xs font-semibold text-[#665f52]">Run npm run audit:data to see all {audit.warnings.length} warnings.</p>}
              </div>
            )}
          </section>

          {!lockedHero ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.12em]">Counter picks</h2>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Filter heroes"
                  className="h-9 w-36 rounded-md border border-[#2b29231a] bg-white px-3 text-sm"
                />
              </div>
              {(search ? filteredHeroes.map((hero) => scoreHero(hero, enemyNames, role, lockedHero)).filter((advice) => advice.score > -50) : recommendations).map((advice) => (
                <Recommendation key={advice.name} advice={advice} />
              ))}
              {!recommendations.length && <EmptyState text="Add at least one enemy pick to get kit-based counter recommendations." />}
            </section>
          ) : (
            <section className="space-y-3">
              <h2 className="text-sm font-black uppercase tracking-[0.12em]">Augment and build direction</h2>
              {builds.map((build) => (
                <article key={build.title} className="rounded-lg border border-[#2b29231a] bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black">{build.title}</h3>
                      <p className="mt-1 text-sm text-[#665f52]">{build.note}</p>
                    </div>
                    <span className="rounded-md bg-[#8a3524] px-2 py-1 text-xs font-black text-white">score {build.score}</span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {build.items.map((item) => (
                      <p key={item} className="rounded-md bg-[#faf1dc] px-3 py-2 text-sm font-bold capitalize">
                        {item}
                      </p>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-[#665f52]">{build.heroNote}</p>
                </article>
              ))}
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

function Recommendation({ advice }: { advice: Advice }) {
  return (
    <article className="rounded-lg border border-[#2b29231a] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black">{advice.name}</h3>
          <p className="text-sm font-semibold capitalize text-[#665f52]">{advice.role}</p>
        </div>
        <span className="rounded-md bg-[#191712] px-2 py-1 text-xs font-black text-white">{advice.score}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {advice.reasons.map((reason) => (
          <span key={reason} className="rounded-md bg-[#e9f0dd] px-2 py-1 text-xs font-black text-[#273713]">
            {reason}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {advice.tags.map((tag) => (
          <span key={tag} className="rounded-md bg-[#f4e0d9] px-2 py-1 text-[11px] font-bold text-[#8a3524]">
            {tag.replaceAll("-", " ")}
          </span>
        ))}
      </div>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-[#2b29214d] bg-white px-4 py-6 text-center text-sm font-semibold text-[#665f52]">{text}</p>;
}
