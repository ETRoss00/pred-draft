// Original phased-build logic retained for later work; not called by the draft screen.
import { heroes, type Hero, type Role } from './audit';
import { items, type Item, type ItemRole } from './items';

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

function hasSourceBackedKit(hero?: Hero): hero is Hero {
    return hero?.verification.kitStatus === "source-backed";
}

const itemRoleByClass: Record<string, ItemRole> = {
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

const buildThreatAnswers: Array<{
    threat: string;
    tags: string[];
    reason: string;
}> = [
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
        .filter(Boolean) as Array<EnemyPick & {
        hero: Hero;
    }>;
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

export function recommendBuild(enemyPicks: EnemyPick[], lockedHero?: Hero, role: Role | "flex" = "flex", selectedAugment?: AugmentAdvice) {
    const comp = analyze(enemyPicks);
    if (!hasSourceBackedKit(lockedHero))
        return [];
    const selected = new Set<string>();
    const preferredRoles = inferPreferredItemRoles(lockedHero, role);
    return buildSlots.flatMap((slot) => {
        const item = pickBuildItem(slot, comp, lockedHero, role, preferredRoles, selectedAugment, selected);
        if (!item)
            return [];
        selected.add(item.item.id);
        return [item];
    });
}

function pickBuildItem(slot: BuildSlot, comp: ReturnType<typeof analyze>, lockedHero: Hero, role: Role | "flex", preferredRoles: Set<ItemRole>, selectedAugment: AugmentAdvice | undefined, selected: Set<string>) {
    const sourceBackedItems = items.filter((item) => item.verification.status === "source-backed" && !selected.has(item.id));
    const preferredItems = sourceBackedItems.filter((item) => preferredRoles.has(item.role));
    const pool = preferredItems.length ? preferredItems : sourceBackedItems;
    return pool
        .map((item) => scoreBuildItem(item, slot, comp, lockedHero, role, preferredRoles, selectedAugment))
        .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))[0];
}

function scoreBuildItem(item: Item, slot: BuildSlot, comp: ReturnType<typeof analyze>, lockedHero: Hero, role: Role | "flex", preferredRoles: Set<ItemRole>, selectedAugment?: AugmentAdvice): BuildItemAdvice {
    let score = preferredRoles.has(item.role) ? 14 : 0;
    const reasons = new Set<string>();
    const tags = collectItemTags(item);
    if (preferredRoles.has(item.role))
        reasons.add(`${item.role} item fit`);
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
    if (!reasons.size)
        reasons.add(`${slot.phase} game fit`);
    return {
        slot,
        item,
        score,
        reasons: [...reasons].slice(0, 3),
        tags: tags.slice(0, 5),
    };
}

function scoreLaneCounter(tags: string[], comp: ReturnType<typeof analyze>, role: Role | "flex", reasons: Set<string>) {
    if (role === "flex")
        return 0;
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
        if (!threatCount || !counter.tags.some((tag) => tags.includes(tag)))
            return;
        score += Math.round(threatCount * 9 * multiplier);
        reasons.add(counter.reason);
    });
    return score;
}

function scoreTagsAgainstTraits(tags: string[], traits: string[], reasons: Set<string>, reason: string, weight: number) {
    let score = 0;
    counterRules.forEach((counter) => {
        if (!traits.includes(counter.threat))
            return;
        const matchingAnswers = counter.answers.filter((answer) => tags.includes(answer));
        if (!matchingAnswers.length)
            return;
        score += matchingAnswers.length * weight;
        reasons.add(reason);
    });
    buildThreatAnswers.forEach((counter) => {
        if (!traits.includes(counter.threat) || !counter.tags.some((tag) => tags.includes(tag)))
            return;
        score += weight;
        reasons.add(reason);
    });
    return score;
}

function scoreRoleIdentity(tags: string[], preferredRoles: Set<ItemRole>, reasons: Set<string>, weight: number) {
    let score = 0;
    preferredRoles.forEach((itemRole) => {
        const matches = roleIdentityTags[itemRole].filter((tag) => tags.includes(tag));
        if (!matches.length)
            return;
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
    if (!synergyTags.length)
        return 0;
    reasons.add(`${lockedHero.name} kit synergy`);
    return Math.min(synergyTags.length * 3, 9);
}

function inferPreferredItemRoles(hero: Hero, role: Role | "flex") {
    const preferred = new Set<ItemRole>();
    hero.classes?.forEach((className) => {
        const itemRole = itemRoleByClass[className.toLowerCase()];
        if (itemRole)
            preferred.add(itemRole);
    });
    if (role !== "flex") {
        const laneRole = laneFallbackItemRole[role];
        if (laneRole)
            preferred.add(laneRole);
    }
    return preferred;
}

function collectItemTags(item: Item) {
    return [...new Set([item.purpose.toLowerCase().replaceAll(" ", "-"), ...item.tags, ...item.answers, ...item.passives.flatMap((passive) => passive.effects), ...(item.restrictions?.flatMap((restriction) => restriction.effects) ?? [])])];
}

function formatRole(role: EnemyRole) {
    return role === "unknown" ? "enemy" : role;
}
