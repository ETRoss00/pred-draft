import heroData from "./heroes.json";

export type Role = "offlane" | "jungle" | "midlane" | "carry" | "support";
export type Damage = "physical" | "magical" | "mixed";
export type RangeType = "melee" | "ranged";
export type VerificationStatus = "source-backed" | "needs-review" | "prototype";
export type AbilitySlot = "passive" | "basic" | "primary" | "secondary" | "alternate" | "ultimate";

export type HeroAbility = {
  slot: AbilitySlot;
  name: string;
  kind: string;
  damageType?: Damage;
  description: string;
  scaling?: Record<string, number | number[]>;
  cooldown?: number[];
  cost?: number[];
  effects: string[];
  sourceRef: string;
};

export type HeroAugment = {
  name: string;
  category: string;
  description: string;
  tags: string[];
  sourceRef: string;
};

export type Hero = {
  id: string;
  name: string;
  roles: Role[];
  flexRoles?: Role[];
  classes?: string[];
  damage: Damage;
  range: RangeType;
  ratings?: {
    basicAttack: number;
    durability: number;
    mobility: number;
    abilityPower: number;
  };
  abilities?: HeroAbility[];
  augments?: HeroAugment[];
  threats: string[];
  answers: string[];
  weaknesses: string[];
  sourceRefs: Record<string, string> & {
    roster: string;
    roles: string;
    kit: string;
  };
  verification: {
    rosterStatus: VerificationStatus;
    roleStatus: VerificationStatus;
    classStatus?: VerificationStatus;
    ratingStatus?: VerificationStatus;
    abilityStatus?: VerificationStatus;
    augmentStatus?: VerificationStatus;
    kitStatus: VerificationStatus;
    notes: string;
  };
};

export type HeroDataSet = typeof heroData & { heroes: Hero[] };

export type AuditIssue = {
  severity: "error" | "warning";
  hero?: string;
  field: string;
  message: string;
};

export type AuditReport = {
  heroCount: number;
  sourceBackedRoles: number;
  fullyVerifiedHeroes: number;
  prototypeKits: number;
  warnings: AuditIssue[];
  errors: AuditIssue[];
  roleCoverage: Record<Role, number>;
};

const data = heroData as HeroDataSet;

export const predecessorHeroData = data;
export const heroes = data.heroes;
export const roles = data.validRoles as Role[];

export function auditHeroData(dataset: HeroDataSet = data): AuditReport {
  const validRoles = new Set(dataset.validRoles);
  const validDamage = new Set(dataset.validDamageTypes);
  const validRange = new Set(dataset.validRangeTypes);
  const validSlots = new Set(dataset.validAbilitySlots ?? []);
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const warnings: AuditIssue[] = [];
  const errors: AuditIssue[] = [];
  const roleCoverage = Object.fromEntries(dataset.validRoles.map((role) => [role, 0])) as Record<Role, number>;

  dataset.heroes.forEach((hero) => {
    if (!hero.id) errors.push(issue("error", hero.name, "id", "Hero is missing a stable id."));
    if (!hero.name) errors.push(issue("error", hero.id, "name", "Hero is missing a display name."));

    if (seenIds.has(hero.id)) errors.push(issue("error", hero.name, "id", `Duplicate id: ${hero.id}.`));
    if (seenNames.has(hero.name)) errors.push(issue("error", hero.name, "name", `Duplicate hero name: ${hero.name}.`));
    seenIds.add(hero.id);
    seenNames.add(hero.name);

    if (!hero.roles.length) errors.push(issue("error", hero.name, "roles", "Hero must have at least one role."));
    hero.roles.forEach((role) => {
      if (!validRoles.has(role)) errors.push(issue("error", hero.name, "roles", `Invalid role: ${role}.`));
      else roleCoverage[role as Role] += 1;
    });
    hero.flexRoles?.forEach((role) => {
      if (!validRoles.has(role)) errors.push(issue("error", hero.name, "flexRoles", `Invalid flex role: ${role}.`));
    });

    if (!validDamage.has(hero.damage)) errors.push(issue("error", hero.name, "damage", `Invalid damage type: ${hero.damage}.`));
    if (!validRange.has(hero.range)) errors.push(issue("error", hero.name, "range", `Invalid range type: ${hero.range}.`));

    if (hero.ratings) {
      Object.entries(hero.ratings).forEach(([rating, value]) => {
        if (!Number.isFinite(value) || value < 0 || value > 10) {
          errors.push(issue("error", hero.name, `ratings.${rating}`, "Hero rating must be a number from 0 to 10."));
        }
      });
    }

    if (hero.abilities) {
      const seenSlots = new Set<AbilitySlot>();
      hero.abilities.forEach((ability) => {
        if (!validSlots.has(ability.slot)) errors.push(issue("error", hero.name, "abilities", `Invalid ability slot: ${ability.slot}.`));
        if (seenSlots.has(ability.slot)) errors.push(issue("error", hero.name, "abilities", `Duplicate ability slot: ${ability.slot}.`));
        seenSlots.add(ability.slot);
        if (!ability.name) errors.push(issue("error", hero.name, "abilities", `Ability in ${ability.slot} is missing a name.`));
        if (!ability.description) errors.push(issue("error", hero.name, "abilities", `${ability.name || ability.slot} is missing description text.`));
        if (!ability.effects.length) warnings.push(issue("warning", hero.name, "abilities", `${ability.name || ability.slot} has no effects tags.`));
      });
      validSlots.forEach((slot) => {
        if (!seenSlots.has(slot as AbilitySlot)) errors.push(issue("error", hero.name, "abilities", `Source-backed hero is missing ${slot} ability.`));
      });
    }

    if (hero.augments) {
      const seenAugments = new Set<string>();
      hero.augments.forEach((augment) => {
        if (seenAugments.has(augment.name)) errors.push(issue("error", hero.name, "augments", `Duplicate augment: ${augment.name}.`));
        seenAugments.add(augment.name);
        if (!augment.name) errors.push(issue("error", hero.name, "augments", "Augment is missing a name."));
        if (!augment.description) errors.push(issue("error", hero.name, "augments", `${augment.name || "Augment"} is missing description text.`));
        if (!augment.tags.length) warnings.push(issue("warning", hero.name, "augments", `${augment.name || "Augment"} has no recommendation tags.`));
      });
    }

    ["threats", "answers", "weaknesses"].forEach((field) => {
      const tags = hero[field as "threats" | "answers" | "weaknesses"];
      if (!tags.length) warnings.push(issue("warning", hero.name, field, "Kit taxonomy field is empty."));
    });

    if (hero.verification.roleStatus !== "source-backed") {
      warnings.push(issue("warning", hero.name, "roles", "Roles need source review before recommendations should be trusted."));
    }
    if (hero.verification.kitStatus !== "source-backed") {
      warnings.push(issue("warning", hero.name, "kit", "Kit tags are still prototype taxonomy."));
    }
    if (hero.verification.abilityStatus === "source-backed" && !hero.abilities) {
      errors.push(issue("error", hero.name, "abilities", "Ability status is source-backed but no abilities are present."));
    }
    if (hero.verification.augmentStatus === "source-backed" && !hero.augments) {
      errors.push(issue("error", hero.name, "augments", "Augment status is source-backed but no augments are present."));
    }
  });

  return {
    heroCount: dataset.heroes.length,
    sourceBackedRoles: dataset.heroes.filter((hero) => hero.verification.roleStatus === "source-backed").length,
    fullyVerifiedHeroes: dataset.heroes.filter(isFullyVerified).length,
    prototypeKits: dataset.heroes.filter((hero) => hero.verification.kitStatus !== "source-backed").length,
    warnings,
    errors,
    roleCoverage,
  };
}

function issue(severity: AuditIssue["severity"], hero: string | undefined, field: string, message: string): AuditIssue {
  return { severity, hero, field, message };
}

function isFullyVerified(hero: Hero) {
  return (
    hero.verification.roleStatus === "source-backed" &&
    hero.verification.classStatus === "source-backed" &&
    hero.verification.ratingStatus === "source-backed" &&
    hero.verification.abilityStatus === "source-backed" &&
    hero.verification.augmentStatus === "source-backed" &&
    hero.verification.kitStatus === "source-backed"
  );
}
