"use client";

import { useMemo, useState } from "react";
import { heroes, roles, type Hero, type HeroAugment, type Role } from "@/data/predecessor/audit";
import { eternals, type Eternal, type EternalBlessing, type EternalRole } from "@/data/predecessor/eternals";
import { items, type Item, type ItemRole } from "@/data/predecessor/items";

type Advice = {
  name: string;
  role: string;
  score: number;
  reasons: string[];
  tags: string[];
};

type EnemyRole = Role | "unknown";

type EnemyPick = {
  name: string;
  role: EnemyRole;
};

type AugmentAdvice = {
  name: string;
  category: string;
  description: string;
  score: number;
  reasons: string[];
  tags: string[];
};

type EternalAdvice = {
  eternal: Eternal;
  score: number;
  reasons: string[];
  tags: string[];
};

type BuildPhase = "early" | "mid" | "late";

type BuildSlot = {
  position: number;
  phase: BuildPhase;
  title: string;
  purpose: "augment-synergy" | "lane-counter" | "role-identity" | "team-counter";
};

type BuildItemAdvice = {
  slot: BuildSlot;
  item: Item;
  score: number;
  reasons: string[];
  tags: string[];
};

const defaultEnemyPicks: EnemyPick[] = [
  { role: "unknown", name: "" },
  { role: "unknown", name: "" },
  { role: "unknown", name: "" },
  { role: "unknown", name: "" },
  { role: "unknown", name: "" },
];

const roleMatchupWeights: Record<Role, Partial<Record<EnemyRole, number>>> = {
  carry: { support: 1.35, jungle: 1.2, carry: 0.9, midlane: 0.75, offlane: 0.55, unknown: 0.45 },
  support: { carry: 1.25, support: 1.2, jungle: 1.1, midlane: 0.8, offlane: 0.5, unknown: 0.45 },
  midlane: { midlane: 1.25, jungle: 1.2, support: 0.8, carry: 0.75, offlane: 0.55, unknown: 0.45 },
  jungle: { jungle: 1.1, midlane: 1.05, carry: 1.05, support: 1.0, offlane: 0.95, unknown: 0.75 },
  offlane: { offlane: 1.35, jungle: 1.15, midlane: 0.75, support: 0.6, carry: 0.55, unknown: 0.45 },
};

const counterRules = [
  rule("dive", ["hard-cc", "peel", "anti-dive", "disengage"], "peels dive"),
  rule("mobility", ["hard-cc", "anti-dive"], "locks down mobility"),
  rule("engage", ["disengage", "peel", "zone-control", "anti-engage"], "stops engage"),
  rule("poke", ["anti-poke", "sustain", "dive", "backline-access"], "answers poke"),
  rule("burst", ["anti-burst", "shields", "frontline"], "absorbs burst"),
  rule("hard-cc", ["hard-cc"], "punishes CC vulnerability"),
  rule("sustain", ["anti-heal", "burst"], "cuts sustain"),
  rule("anti-heal", ["anti-heal"], "punishes healing vulnerability"),
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

const buildSlots: BuildSlot[] = [
  { position: 1, phase: "early", title: "Item 1", purpose: "augment-synergy" },
  { position: 2, phase: "early", title: "Item 2", purpose: "augment-synergy" },
  { position: 3, phase: "mid", title: "Item 3", purpose: "lane-counter" },
  { position: 4, phase: "mid", title: "Item 4", purpose: "role-identity" },
  { position: 5, phase: "late", title: "Item 5", purpose: "team-counter" },
  { position: 6, phase: "late", title: "Item 6", purpose: "team-counter" },
];

function rule(threat: string, answers: string[], reason: string) {
  return { threat, answers, reason };
}

function hasSourceBackedKit(hero?: Hero) {
  return hero?.verification.kitStatus === "source-backed";
}

const augmentTextSignals = [
  augmentSignal(["cooldown", "cooldowns", "recast", "refresh", "reset", "flow state"], ["cooldown-reduction", "multikill"]),
  augmentSignal(["movement speed", "dash", "leap", "blink", "range", "longer", "further", "mobility"], ["mobility"]),
  augmentSignal(["stun", "root", "knock", "pull", "push", "restrain", "ground", "silence", "cc"], ["hard-cc", "disruption"]),
  augmentSignal(["heal", "healing", "lifesteal", "omnivamp", "regen", "siphon"], ["sustain"]),
  augmentSignal(["shield", "barrier", "damage reduction", "mitigation", "tenacity", "armor"], ["anti-burst", "frontline"]),
  augmentSignal(["ultimate", "ult", "obliteration", "colosseum", "purge"], ["ultimate", "teamfight"]),
  augmentSignal(["attack speed", "basic attack", "on-hit", "ricochet", "shards"], ["sustained-dps", "tank-shred"]),
  augmentSignal(["execute", "missing health", "below", "burst"], ["burst", "pick"]),
  augmentSignal(["gold", "xp", "level", "stacks", "permanent", "ascended"], ["scaling"]),
  augmentSignal(["area", "zone", "field", "explosion", "barrage", "grenade"], ["zone-control", "area-damage"]),
  augmentSignal(["spear", "projectile", "sniper", "infinite", "range"], ["poke", "pick"]),
  augmentSignal(["cleanse", "immune", "immunity"], ["anti-burst", "disengage"]),
  augmentSignal(["anti heal", "blight"], ["anti-heal"]),
];

function augmentSignal(words: string[], tags: string[]) {
  return { words, tags };
}

const itemRoleByClass: Record<string, ItemRole> = {
  carry: "carry",
  support: "support",
  mage: "mage",
  tank: "tank",
  fighter: "fighter",
  assassin: "assassin",
};

const eternalRoleByClass: Record<string, EternalRole> = {
  carry: "carry",
  support: "support",
  mage: "mage",
  tank: "tank",
  fighter: "fighter",
  assassin: "assassin",
};

const laneFallbackItemRole: Partial<Record<Role, ItemRole>> = {
  carry: "carry",
  support: "support",
};

const laneFallbackEternalRole: Partial<Record<Role, EternalRole>> = {
  carry: "carry",
  support: "support",
};

const roleIdentityTags: Record<ItemRole, string[]> = {
  carry: ["damage-amplification", "crit", "attack-speed", "on-hit", "physical-power", "physical-penetration", "sustained-damage"],
  support: ["healing", "shielding", "heal-shield-power", "defensive-aura", "ally-buff", "utility", "anti-disruption"],
  mage: ["damage-amplification", "magical-power", "magical-penetration", "ability-haste", "burst", "poke"],
  tank: ["defense", "durability", "health", "armor", "physical-armor", "magical-armor", "damage-mitigation", "teamfight-durability"],
  fighter: ["sustain", "sustained-fighting", "dueling", "health", "physical-power", "ability-haste", "omnivamp"],
  assassin: ["burst", "physical-penetration", "mobility", "cooldown-reduction", "pick", "snowball", "execute"],
};

const laneMatchupTargets: Partial<Record<Role, EnemyRole[]>> = {
  carry: ["support", "carry"],
  support: ["support", "carry"],
  midlane: ["midlane", "jungle"],
  jungle: ["jungle", "midlane", "carry", "support", "offlane"],
  offlane: ["offlane"],
};

const buildThreatAnswers: Array<{ threat: string; tags: string[]; reason: string }> = [
  { threat: "sustain", tags: ["anti-heal", "healing-counter"], reason: "counters enemy sustain" },
  { threat: "frontline", tags: ["anti-tank", "frontline-shred", "armor-ignore", "max-health-damage", "current-health-damage"], reason: "breaks frontline" },
  { threat: "burst", tags: ["anti-burst", "burst-survival", "shield", "spell-shield", "defense"], reason: "protects from burst" },
  { threat: "hard-cc", tags: ["cleanse", "anti-cc", "cc-immunity", "anti-disruption", "tenacity"], reason: "covers crowd control" },
  { threat: "poke", tags: ["sustain", "healing", "shielding", "anti-poke", "mana-sustain"], reason: "stabilizes poke pressure" },
  { threat: "dive", tags: ["anti-burst", "defense", "mobility", "reposition", "shield"], reason: "survives dive pressure" },
  { threat: "mobility", tags: ["slow", "anti-mobility", "stickiness", "chase"], reason: "checks mobility" },
  { threat: "zone-control", tags: ["mobility", "poke", "long-range", "area-damage"], reason: "answers zone control" },
  { threat: "objective-control", tags: ["objective-control", "monster-damage", "teamfight", "frontline-shred"], reason: "helps contest objectives" },
  { threat: "scaling", tags: ["snowball", "burst", "damage-amplification", "early-pressure"], reason: "pressures scaling" },
];


function analyze(enemyPicks: EnemyPick[]) {
  const enemies = enemyPicks
    .filter((pick) => pick.name)
    .map((pick) => {
      const hero = heroes.find((item) => item.name === pick.name);
      return hero ? { ...pick, hero } : undefined;
    })
    .filter(Boolean) as Array<EnemyPick & { hero: Hero }>;

  const verifiedEnemies = enemies.filter(({ hero }) => hasSourceBackedKit(hero));
  const unverifiedEnemies = enemies.filter(({ hero }) => !hasSourceBackedKit(hero));
  const counts = new Map<string, number>();
  const damage = { physical: 0, magical: 0, mixed: 0 };

  verifiedEnemies.forEach(({ hero }) => {
    damage[hero.damage] += 1;
    [...hero.threats, ...hero.weaknesses].forEach((tag) => {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    });
  });

  return {
    enemies,
    verifiedEnemies,
    unverifiedEnemies,
    damage,
    topTraits: [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8),
    counts,
  };
}

function scoreHero(hero: Hero, enemyPicks: EnemyPick[], role: Role | "flex", lockedName: string) {
  const comp = analyze(enemyPicks);
  const enemyNames = enemyPicks.map((pick) => pick.name).filter(Boolean);
  let score = 0;
  const reasons = new Set<string>();
  const tags = new Set<string>();

  if (role !== "flex" && !hero.roles.includes(role)) {
    score += hero.flexRoles?.includes(role) ? -25 : -100;
  }
  if (hero.name === lockedName) score -= 100;
  if (enemyNames.includes(hero.name)) score -= 100;

  counterRules.forEach((counter) => {
    const threatCount = comp.counts.get(counter.threat) ?? 0;
    if (!threatCount) return;
    const matchingAnswers = counter.answers.filter((answer) => hero.answers.includes(answer) || hero.threats.includes(answer));
    if (matchingAnswers.length) {
      score += threatCount * (matchingAnswers.length > 1 ? 11 : 7);
      reasons.add(counter.reason);
      matchingAnswers.forEach((tag) => tags.add(tag));
    }
  });

  comp.verifiedEnemies.forEach(({ hero: enemyHero, role: enemyRole }) => {
    hero.threats.forEach((threat) => {
      if (enemyHero.weaknesses.includes(threat)) {
        score += 6;
        reasons.add(`punishes ${enemyHero.name}`);
        tags.add(threat);
      }
    });
  });

  if (role !== "flex") {
    comp.verifiedEnemies.forEach(({ hero: enemyHero, role: enemyRole }) => {
      const matchupWeight = roleMatchupWeights[role][enemyRole] ?? 0;
      if (!matchupWeight) return;

      counterRules.forEach((counter) => {
        const enemyTraits = [...enemyHero.threats, ...enemyHero.weaknesses];
        if (!enemyTraits.includes(counter.threat)) return;

        const matchingAnswers = counter.answers.filter((answer) => hero.answers.includes(answer) || hero.threats.includes(answer));
        if (!matchingAnswers.length) return;

        score += Math.round(matchupWeight * (matchingAnswers.length > 1 ? 10 : 7));
        reasons.add(`${formatRole(enemyRole)} matchup answer`);
        matchingAnswers.forEach((tag) => tags.add(tag));
      });

      hero.threats.forEach((threat) => {
        if (!enemyHero.weaknesses.includes(threat)) return;
        score += Math.round(matchupWeight * 7);
        reasons.add(`${formatRole(enemyRole)} pressure`);
        tags.add(threat);
      });
    });
  }

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
    role: hero.flexRoles?.length ? `${hero.roles.join(" / ")} (+ ${hero.flexRoles.join(" / ")})` : hero.roles.join(" / "),
    score,
    reasons: [...reasons].slice(0, 4),
    tags: [...tags].slice(0, 5),
  };
}

function recommendBuild(enemyPicks: EnemyPick[], lockedHero?: Hero, role: Role | "flex" = "flex", selectedAugment?: AugmentAdvice) {
  const comp = analyze(enemyPicks);
  if (!hasSourceBackedKit(lockedHero)) return [];

  const selected = new Set<string>();
  const preferredRoles = inferPreferredItemRoles(lockedHero, role);
  return buildSlots.flatMap((slot) => {
    const item = pickBuildItem(slot, comp, lockedHero, role, preferredRoles, selectedAugment, selected);
    if (!item) return [];
    selected.add(item.item.id);
    return [item];
  });
}

function pickBuildItem(
  slot: BuildSlot,
  comp: ReturnType<typeof analyze>,
  lockedHero: Hero,
  role: Role | "flex",
  preferredRoles: Set<ItemRole>,
  selectedAugment: AugmentAdvice | undefined,
  selected: Set<string>,
) {
  const sourceBackedItems = items.filter((item) => item.verification.status === "source-backed" && !selected.has(item.id));
  const preferredItems = sourceBackedItems.filter((item) => preferredRoles.has(item.role));
  const pool = preferredItems.length ? preferredItems : sourceBackedItems;

  return pool
    .map((item) => scoreBuildItem(item, slot, comp, lockedHero, role, preferredRoles, selectedAugment))
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))[0];
}

function scoreBuildItem(
  item: Item,
  slot: BuildSlot,
  comp: ReturnType<typeof analyze>,
  lockedHero: Hero,
  role: Role | "flex",
  preferredRoles: Set<ItemRole>,
  selectedAugment?: AugmentAdvice,
): BuildItemAdvice {
  let score = preferredRoles.has(item.role) ? 14 : 0;
  const reasons = new Set<string>();
  const tags = collectItemTags(item);

  if (preferredRoles.has(item.role)) reasons.add(`${item.role} item fit`);

  if (slot.purpose === "augment-synergy") {
    const augmentMatches = selectedAugment ? selectedAugment.tags.filter((tag) => tags.includes(tag)) : [];
    if (augmentMatches.length) {
      score += 28 + augmentMatches.length * 6;
      reasons.add("early augment synergy");
    }
    score += scoreRoleIdentity(tags, preferredRoles, reasons, 4);
  }

  if (slot.purpose === "lane-counter") {
    const laneScore = scoreLaneCounter(tags, comp, role, reasons);
    score += laneScore || scoreTeamCounter(tags, comp, reasons, 0.6);
  }

  if (slot.purpose === "role-identity") {
    score += scoreRoleIdentity(tags, preferredRoles, reasons, 8);
    if (preferredRoles.has("support") && tags.some((tag) => ["healing", "shielding", "heal-shield-power"].includes(tag))) {
      score += 12;
      reasons.add("support sustain focus");
    }
    if (preferredRoles.has("fighter") && tags.some((tag) => ["sustain", "omnivamp", "dueling", "sustained-fighting"].includes(tag))) {
      score += 12;
      reasons.add("fighter sustain focus");
    }
    if (preferredRoles.has("tank") && tags.some((tag) => ["defense", "durability", "armor", "damage-mitigation"].includes(tag))) {
      score += 12;
      reasons.add("tank defense focus");
    }
    if (["carry", "mage", "assassin"].some((itemRole) => preferredRoles.has(itemRole as ItemRole)) && tags.some((tag) => ["damage-amplification", "crit-amplification", "magical-damage-amp", "physical-shred"].includes(tag))) {
      score += 12;
      reasons.add("damage amplification");
    }
  }

  if (slot.purpose === "team-counter") {
    score += scoreTeamCounter(tags, comp, reasons, 1);
  }

  score += scoreDefensiveDamageProfile(tags, comp, reasons);
  score += scoreHeroItemSynergy(tags, lockedHero, reasons);

  if (!reasons.size) reasons.add(`${slot.phase} game fit`);

  return {
    slot,
    item,
    score,
    reasons: [...reasons].slice(0, 3),
    tags: tags.slice(0, 5),
  };
}

function scoreLaneCounter(tags: string[], comp: ReturnType<typeof analyze>, role: Role | "flex", reasons: Set<string>) {
  if (role === "flex") return 0;

  const targetRoles = laneMatchupTargets[role] ?? [];
  let score = 0;
  comp.verifiedEnemies
    .filter((enemy) => targetRoles.includes(enemy.role))
    .forEach(({ hero: enemyHero, role: enemyRole }) => {
      const traits = [...enemyHero.threats, ...enemyHero.weaknesses];
      score += scoreTagsAgainstTraits(tags, traits, reasons, `${formatRole(enemyRole)} counter`, 9);
    });

  return score;
}

function scoreTeamCounter(tags: string[], comp: ReturnType<typeof analyze>, reasons: Set<string>, multiplier: number) {
  let score = 0;

  buildThreatAnswers.forEach((counter) => {
    const threatCount = comp.counts.get(counter.threat) ?? 0;
    if (!threatCount || !counter.tags.some((tag) => tags.includes(tag))) return;
    score += Math.round(threatCount * 9 * multiplier);
    reasons.add(counter.reason);
  });

  return score;
}

function scoreTagsAgainstTraits(tags: string[], traits: string[], reasons: Set<string>, reason: string, weight: number) {
  let score = 0;

  counterRules.forEach((counter) => {
    if (!traits.includes(counter.threat)) return;
    const matchingAnswers = counter.answers.filter((answer) => tags.includes(answer));
    if (!matchingAnswers.length) return;
    score += matchingAnswers.length * weight;
    reasons.add(reason);
  });

  buildThreatAnswers.forEach((counter) => {
    if (!traits.includes(counter.threat) || !counter.tags.some((tag) => tags.includes(tag))) return;
    score += weight;
    reasons.add(reason);
  });

  return score;
}

function scoreRoleIdentity(tags: string[], preferredRoles: Set<ItemRole>, reasons: Set<string>, weight: number) {
  let score = 0;
  preferredRoles.forEach((itemRole) => {
    const matches = roleIdentityTags[itemRole].filter((tag) => tags.includes(tag));
    if (!matches.length) return;
    score += matches.length * weight;
    reasons.add(`${itemRole} identity`);
  });
  return score;
}

function scoreDefensiveDamageProfile(tags: string[], comp: ReturnType<typeof analyze>, reasons: Set<string>) {
  let score = 0;

  if (comp.damage.physical >= 3 && tags.some((tag) => ["physical-armor", "physical-mitigation", "anti-basic-attack", "anti-crit"].includes(tag))) {
    score += 10;
    reasons.add("physical damage counter");
  }
  if (comp.damage.magical >= 3 && tags.some((tag) => ["magical-armor", "anti-magic", "spell-shield"].includes(tag))) {
    score += 10;
    reasons.add("magical damage counter");
  }

  return score;
}

function scoreHeroItemSynergy(tags: string[], lockedHero: Hero, reasons: Set<string>) {
  const synergyTags = tags.filter((tag) => lockedHero.threats.includes(tag) || lockedHero.answers.includes(tag));
  if (!synergyTags.length) return 0;
  reasons.add(`${lockedHero.name} kit synergy`);
  return Math.min(synergyTags.length * 3, 9);
}

function inferPreferredItemRoles(hero: Hero, role: Role | "flex") {
  const preferred = new Set<ItemRole>();

  hero.classes?.forEach((className) => {
    const itemRole = itemRoleByClass[className.toLowerCase()];
    if (itemRole) preferred.add(itemRole);
  });

  if (role !== "flex") {
    const laneRole = laneFallbackItemRole[role];
    if (laneRole) preferred.add(laneRole);
  }

  return preferred;
}

function collectItemTags(item: Item) {
  return [...new Set([item.purpose.toLowerCase().replaceAll(" ", "-"), ...item.tags, ...item.answers, ...item.passives.flatMap((passive) => passive.effects), ...(item.restrictions?.flatMap((restriction) => restriction.effects) ?? [])])];
}

function recommendEternals(enemyPicks: EnemyPick[], lockedHero?: Hero, role: Role | "flex" = "flex"): EternalAdvice[] {
  if (!hasSourceBackedKit(lockedHero)) return [];

  const comp = analyze(enemyPicks);
  const preferredRoles = inferPreferredEternalRoles(lockedHero, role);

  return eternals
    .filter((eternal) => eternal.verification.status === "source-backed")
    .map((eternal) => scoreEternal(eternal, comp, lockedHero, preferredRoles))
    .sort((a, b) => b.score - a.score || a.eternal.name.localeCompare(b.eternal.name))
    .slice(0, 6);
}

function scoreEternal(eternal: Eternal, comp: ReturnType<typeof analyze>, lockedHero: Hero, preferredRoles: Set<EternalRole>): EternalAdvice {
  let score = preferredRoles.has(eternal.role) ? 22 : 0;
  const reasons = new Set<string>();
  const tags = collectEternalTags(eternal);

  if (preferredRoles.has(eternal.role)) reasons.add(`${eternal.role} Eternal fit`);

  buildThreatAnswers.forEach((counter) => {
    const threatCount = comp.counts.get(counter.threat) ?? 0;
    if (!threatCount || !counter.tags.some((tag) => tags.includes(tag))) return;
    score += threatCount * 7;
    reasons.add(counter.reason);
  });

  const kitMatches = tags.filter((tag) => lockedHero.threats.includes(tag) || lockedHero.answers.includes(tag));
  if (kitMatches.length) {
    score += Math.min(kitMatches.length * 4, 12);
    reasons.add(`${lockedHero.name} kit synergy`);
  }

  if (!reasons.size) reasons.add("general matchup fit");

  return {
    eternal,
    score,
    reasons: [...reasons].slice(0, 3),
    tags: tags.slice(0, 5),
  };
}

function inferPreferredEternalRoles(hero: Hero, role: Role | "flex") {
  const preferred = new Set<EternalRole>();

  hero.classes?.forEach((className) => {
    const eternalRole = eternalRoleByClass[className.toLowerCase()];
    if (eternalRole) preferred.add(eternalRole);
  });

  if (role !== "flex") {
    const laneRole = laneFallbackEternalRole[role];
    if (laneRole) preferred.add(laneRole);
  }

  return preferred;
}

function collectEternalTags(eternal: Eternal) {
  const blessingTags = [...eternal.minorBlessing1, ...eternal.minorBlessing2].flatMap((blessing) => [...blessing.tags, ...blessing.effects]);
  return [...new Set([eternal.category, eternal.role, ...eternal.tags, ...eternal.answers, ...eternal.mainTrait.tags, ...eternal.mainTrait.effects, ...blessingTags])];
}

function recommendAugments(enemyPicks: EnemyPick[], lockedHero?: Hero, role: Role | "flex" = "flex"): AugmentAdvice[] {
  if (!lockedHero?.augments?.length || lockedHero.verification.augmentStatus !== "source-backed") return [];

  const comp = analyze(enemyPicks);
  return lockedHero.augments
    .map((augment) => scoreAugment(augment, comp, lockedHero, role))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function scoreAugment(augment: HeroAugment, comp: ReturnType<typeof analyze>, lockedHero: Hero, role: Role | "flex"): AugmentAdvice {
  let score = 0;
  const reasons = new Set<string>();
  const augmentTags = inferAugmentTags(augment);

  counterRules.forEach((counter) => {
    const threatCount = comp.counts.get(counter.threat) ?? 0;
    if (!threatCount) return;

    if (augmentTags.includes(counter.threat)) {
      score += threatCount * 5;
      reasons.add(`leans into ${counter.threat.replaceAll("-", " ")}`);
    }

    const matchingAnswers = counter.answers.filter((answer) => augmentTags.includes(answer));
    if (matchingAnswers.length) {
      score += threatCount * (matchingAnswers.length > 1 ? 11 : 7);
      reasons.add(counter.reason);
    }
  });

  comp.verifiedEnemies.forEach(({ hero: enemyHero, role: enemyRole }) => {
    const matchupWeight = role === "flex" ? 0.75 : (roleMatchupWeights[role][enemyRole] ?? 0.45);
    const enemyTraits = [...enemyHero.threats, ...enemyHero.weaknesses];

    counterRules.forEach((counter) => {
      if (!enemyTraits.includes(counter.threat)) return;

      const matchingAnswers = counter.answers.filter((answer) => augmentTags.includes(answer));
      if (!matchingAnswers.length) return;

      score += Math.round(matchupWeight * (matchingAnswers.length > 1 ? 10 : 7));
      reasons.add(`${formatRole(enemyRole)} matchup answer`);
    });

    lockedHero.threats.forEach((threat) => {
      if (!augmentTags.includes(threat) || !enemyHero.weaknesses.includes(threat)) return;
      score += Math.round(matchupWeight * 6);
      reasons.add(`${formatRole(enemyRole)} pressure`);
    });
  });

  const heroSynergyTags = augmentTags.filter((tag) => lockedHero.answers.includes(tag) || lockedHero.threats.includes(tag));
  if (heroSynergyTags.length) {
    score += Math.min(heroSynergyTags.length * 2, 6);
    reasons.add(`${lockedHero.name} kit synergy`);
  }

  if (score === 0) {
    score = augment.tags.includes("kit-modifier") ? 1 : 0;
    reasons.add("hero-specific option");
  }

  return {
    name: augment.name,
    category: augment.category,
    description: augment.description,
    score,
    reasons: [...reasons].slice(0, 3),
    tags: augmentTags,
  };
}

function inferAugmentTags(augment: HeroAugment) {
  const tags = new Set(augment.tags.filter((tag) => tag !== "kit-modifier"));
  const text = `${augment.name} ${augment.category} ${augment.description} ${augment.tags.join(" ")}`.toLowerCase();

  augmentTextSignals.forEach((signal) => {
    if (!signal.words.some((word) => text.includes(word))) return;
    signal.tags.forEach((tag) => tags.add(tag));
  });

  if (!tags.size) tags.add("hero-specific");
  return [...tags];
}

function formatAugmentCategory(category: string) {
  return category === "kit-modifier" ? "" : category.replaceAll("-", " ");
}

function isPlaceholderAugmentDescription(description: string) {
  return /^User-verified text entry for .+ augment\.$/.test(description);
}

function formatRole(role: EnemyRole) {
  return role === "unknown" ? "enemy" : role;
}

function formatBuildPurpose(purpose: BuildSlot["purpose"]) {
  return purpose.replaceAll("-", " ");
}

export default function Home() {
  const [role, setRole] = useState<Role>("carry");
  const [enemyPicks, setEnemyPicks] = useState<EnemyPick[]>(defaultEnemyPicks);
  const [lockedHero, setLockedHero] = useState("");
  const [search, setSearch] = useState("");
  const [selectedAugmentName, setSelectedAugmentName] = useState("");
  const [selectedEternalId, setSelectedEternalId] = useState("");
  const [selectedMinorBlessing1Id, setSelectedMinorBlessing1Id] = useState("");
  const [selectedMinorBlessing2Id, setSelectedMinorBlessing2Id] = useState("");

  const enemyNames = enemyPicks.map((pick) => pick.name).filter(Boolean);
  const comp = useMemo(() => analyze(enemyPicks), [enemyPicks]);
  const locked = heroes.find((hero) => hero.name === lockedHero);
  const sourceBackedKitHeroes = useMemo(() => heroes.filter(hasSourceBackedKit), []);

  const recommendations = useMemo(
    () =>
      sourceBackedKitHeroes
        .map((hero) => scoreHero(hero, enemyPicks, role, lockedHero))
        .filter((advice) => advice.score > 0 && advice.reasons.length)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .slice(0, 8),
    [enemyPicks, role, lockedHero, sourceBackedKitHeroes],
  );

  const augmentOptions = useMemo(() => recommendAugments(enemyPicks, locked, role), [enemyPicks, locked, role]);
  const selectedAugment = augmentOptions.find((augment) => augment.name === selectedAugmentName);
  const eternalOptions = useMemo(() => recommendEternals(enemyPicks, locked, role), [enemyPicks, locked, role]);
  const selectedEternalAdvice = eternalOptions.find((advice) => advice.eternal.id === selectedEternalId);
  const selectedEternal = selectedEternalAdvice?.eternal;
  const selectedMinorBlessing1 = selectedEternal?.minorBlessing1.find((blessing) => blessing.id === selectedMinorBlessing1Id);
  const selectedMinorBlessing2 = selectedEternal?.minorBlessing2.find((blessing) => blessing.id === selectedMinorBlessing2Id);
  const buildReady = Boolean(locked && selectedAugment && selectedEternal && selectedMinorBlessing1 && selectedMinorBlessing2);
  const builds = useMemo(
    () => (buildReady ? recommendBuild(enemyPicks, locked, role, selectedAugment) : []),
    [buildReady, enemyPicks, locked, role, selectedAugment],
  );
  const availableHeroes = heroes.filter((hero) => !enemyNames.includes(hero.name));
  const filteredHeroes = availableHeroes.filter((hero) => hero.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#191712]">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col">
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
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              <section className="rounded-lg border border-[#2b29231a] bg-white p-3 shadow-sm">
                <label className="mb-2 block text-sm font-black uppercase tracking-[0.12em]" htmlFor="my-role">
                  My role
                </label>
                <select
                  id="my-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as Role)}
                  className="h-11 w-full rounded-md border border-[#2b29231a] bg-[#faf8f3] px-3 text-sm font-semibold capitalize"
                >
                  {roles.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </section>

              <section className="rounded-lg border border-[#2b29231a] bg-white p-3 shadow-sm">
                <label className="mb-2 block text-sm font-black uppercase tracking-[0.12em]" htmlFor="locked-hero">
                  My hero
                </label>
                <select
                  id="locked-hero"
                  value={lockedHero}
                  onChange={(event) => {
                    setLockedHero(event.target.value);
                    setSelectedAugmentName("");
                    setSelectedEternalId("");
                    setSelectedMinorBlessing1Id("");
                    setSelectedMinorBlessing2Id("");
                  }}
                  className="h-11 w-full rounded-md border border-[#2b29231a] bg-[#faf8f3] px-3 text-sm font-semibold"
                >
                  <option value="">Choose during draft</option>
                  {availableHeroes.map((hero) => (
                    <option key={hero.name} value={hero.name}>
                      {hero.name} ({hero.roles.join("/")})
                    </option>
                  ))}
                </select>
              </section>

              {!lockedHero && (
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
                  {(search
                    ? filteredHeroes
                        .filter(hasSourceBackedKit)
                        .map((hero) => scoreHero(hero, enemyPicks, role, lockedHero))
                        .filter((advice) => advice.score > -50)
                    : recommendations
                  ).map((advice) => (
                    <Recommendation key={advice.name} advice={advice} />
                  ))}
                  {!recommendations.length && <EmptyState text="Add at least one enemy pick with text-sourced kit data to get verified counter recommendations." />}
                </section>
              )}
            </div>

            <div className="space-y-5">
              <section className="rounded-lg border border-[#2b29231a] bg-[#191712] p-3 text-white shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-black uppercase tracking-[0.12em]">Enemy read</h2>
                  <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-bold">{comp.verifiedEnemies.length ? "Live" : "Waiting"}</span>
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
                  <p className="text-sm text-[#e9dfcf]">Add text-sourced enemy kits to reveal draft pressure.</p>
                )}
                {comp.unverifiedEnemies.length > 0 && (
                  <p className="mt-3 rounded-md bg-white/10 px-3 py-2 text-xs font-bold text-[#f4dfb0]">
                    {comp.unverifiedEnemies.length} selected enemy {comp.unverifiedEnemies.length === 1 ? "kit is" : "kits are"} quarantined until text-sourced.
                  </p>
                )}
              </section>

              <section className="rounded-lg border border-[#2b29231a] bg-white p-3 shadow-sm">
                <h2 className="mb-3 text-sm font-black uppercase tracking-[0.12em]">Enemy team</h2>
                <div className="grid gap-2">
                  {enemyPicks.map((pick, index) => (
                    <select
                      key={index}
                      value={pick.name}
                      onChange={(event) => {
                        const next = [...enemyPicks];
                        next[index] = { role: "unknown", name: event.target.value };
                        setEnemyPicks(next);
                      }}
                      className="h-11 rounded-md border border-[#2b29231a] bg-[#faf8f3] px-3 text-sm font-semibold"
                      aria-label={`Enemy pick ${index + 1}`}
                    >
                      <option value="">Enemy pick {index + 1}</option>
                      {heroes.map((hero) => (
                        <option key={hero.name} value={hero.name} disabled={enemyNames.includes(hero.name) && pick.name !== hero.name}>
                          {hero.name}
                        </option>
                      ))}
                    </select>
                  ))}
                </div>
              </section>
            </div>
          </div>

          {lockedHero && (
            <section className="space-y-5">
              <div className="space-y-2">
                <h2 className="text-sm font-black uppercase tracking-[0.12em]">Recommended augments</h2>
                {augmentOptions.length ? (
                  <div className="grid gap-3 lg:grid-cols-3">
                    {augmentOptions.map((augment) => {
                      const category = formatAugmentCategory(augment.category);
                      const showDescription = !isPlaceholderAugmentDescription(augment.description);
                      const selected = selectedAugmentName === augment.name;

                      return (
                        <button
                          key={augment.name}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setSelectedAugmentName(augment.name)}
                          className={`rounded-lg border bg-white p-4 text-left shadow-sm transition ${
                            selected ? "border-[#8a3524] ring-2 ring-[#8a3524]" : "border-[#2b29231a]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-black">{augment.name}</h3>
                              {category && <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[#8a3524]">{category}</p>}
                            </div>
                            <span className="rounded-md bg-[#191712] px-2 py-1 text-xs font-black text-white">fit {augment.score}</span>
                          </div>
                          {showDescription && <p className="mt-3 text-sm text-[#665f52]">{augment.description}</p>}
                          <TagList tags={augment.reasons} tone="reason" />
                          <TagList tags={augment.tags} />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState text={`${locked?.name ?? "This hero"} needs verified augment data before the app can show actual augment choices.`} />
                )}
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-black uppercase tracking-[0.12em]">Recommended Eternals</h2>
                {eternalOptions.length ? (
                  <>
                    <div className="grid gap-3 lg:grid-cols-3">
                      {eternalOptions.map((advice) => {
                        const selected = selectedEternalId === advice.eternal.id;

                        return (
                          <button
                            key={advice.eternal.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => {
                              setSelectedEternalId(advice.eternal.id);
                              setSelectedMinorBlessing1Id("");
                              setSelectedMinorBlessing2Id("");
                            }}
                            className={`rounded-lg border bg-white p-4 text-left shadow-sm transition ${
                              selected ? "border-[#8a3524] ring-2 ring-[#8a3524]" : "border-[#2b29231a]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="text-lg font-black">{advice.eternal.name}</h3>
                                <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[#8a3524]">
                                  {advice.eternal.category} / {advice.eternal.role}
                                </p>
                              </div>
                              <span className="rounded-md bg-[#191712] px-2 py-1 text-xs font-black text-white">fit {advice.score}</span>
                            </div>
                            <p className="mt-3 text-sm text-[#665f52]">{advice.eternal.mainTrait.name}</p>
                            <TagList tags={advice.reasons} tone="reason" />
                            <TagList tags={advice.tags} />
                          </button>
                        );
                      })}
                    </div>

                    {selectedEternal && (
                      <div className="grid gap-3 lg:grid-cols-2">
                        <BlessingGroup
                          title="Minor blessing 1"
                          blessings={selectedEternal.minorBlessing1}
                          selectedId={selectedMinorBlessing1Id}
                          onSelect={setSelectedMinorBlessing1Id}
                        />
                        <BlessingGroup
                          title="Minor blessing 2"
                          blessings={selectedEternal.minorBlessing2}
                          selectedId={selectedMinorBlessing2Id}
                          onSelect={setSelectedMinorBlessing2Id}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState text={`${locked?.name ?? "This hero"} needs a verified kit before the app can recommend Eternals.`} />
                )}
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-black uppercase tracking-[0.12em]">Phased match build</h2>
                {buildReady ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {builds.map((build) => (
                      <article key={`${build.slot.position}-${build.item.id}`} className="rounded-lg border border-[#2b29231a] bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#665f52]">
                              {build.slot.phase} game / {build.slot.title}
                            </p>
                            <h3 className="mt-1 text-lg font-black">{build.item.name}</h3>
                            <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[#8a3524]">
                              {formatBuildPurpose(build.slot.purpose)} / {build.item.purpose}
                            </p>
                          </div>
                          <span className="rounded-md bg-[#8a3524] px-2 py-1 text-xs font-black text-white">fit {build.score}</span>
                        </div>
                        <TagList tags={build.reasons} tone="reason" />
                        <TagList tags={build.tags} />
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="Choose my role, hero, augment, Eternal, and both minor blessings to unlock the item build." />
                )}
              </div>
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

function BlessingGroup({
  title,
  blessings,
  selectedId,
  onSelect,
}: {
  title: string;
  blessings: EternalBlessing[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-lg border border-[#2b29231a] bg-white p-4 shadow-sm">
      <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[#665f52]">{title}</h3>
      <div className="mt-3 space-y-2">
        {blessings.map((blessing) => {
          const selected = selectedId === blessing.id;

          return (
            <button
              key={blessing.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(blessing.id)}
              className={`w-full rounded-md border p-3 text-left transition ${
                selected ? "border-[#8a3524] bg-[#fff5cf] ring-2 ring-[#8a3524]" : "border-[#2b29231a] bg-[#faf8f3]"
              }`}
            >
              <p className="font-black">{blessing.name}</p>
              <p className="mt-1 text-sm text-[#665f52]">{blessing.description}</p>
              <TagList tags={[...blessing.tags, ...blessing.effects].slice(0, 5)} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TagList({ tags, tone = "tag" }: { tags: string[]; tone?: "tag" | "reason" }) {
  if (!tags.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className={`rounded-md px-2 py-1 text-xs font-black ${
            tone === "reason" ? "bg-[#e9f0dd] text-[#273713]" : "bg-[#f4e0d9] text-[#8a3524]"
          }`}
        >
          {tag.replaceAll("-", " ")}
        </span>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-[#2b29214d] bg-white px-4 py-6 text-center text-sm font-semibold text-[#665f52]">{text}</p>;
}
