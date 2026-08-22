import eternalData from "./eternals.json";

import type { VerificationStatus } from "./audit";

export type EternalCategory = "harbinger" | "primarch" | "dreadnought" | "sovereign" | "divine" | "anomaly";
export type EternalRole = "carry" | "support" | "mage" | "tank" | "fighter" | "assassin";

export type EternalTrait = {
  name: string;
  description: string;
  cooldown?: number;
  scaling?: Record<string, number>;
  effects: string[];
  tags: string[];
};

export type EternalBlessing = EternalTrait & {
  id: string;
};

export type Eternal = {
  id: string;
  name: string;
  category: EternalCategory;
  role: EternalRole;
  mainTrait: EternalTrait;
  minorBlessing1: EternalBlessing[];
  minorBlessing2: EternalBlessing[];
  tags: string[];
  answers: string[];
  sourceRef: string;
  verification: {
    status: VerificationStatus;
    notes: string;
  };
};

export type EternalDataSet = typeof eternalData & { eternals: Eternal[] };

export type EternalAuditIssue = {
  severity: "error" | "warning";
  eternal?: string;
  field: string;
  message: string;
};

export type EternalAuditReport = {
  eternalCount: number;
  sourceBackedEternals: number;
  warnings: EternalAuditIssue[];
  errors: EternalAuditIssue[];
  categoryCoverage: Record<EternalCategory, number>;
  roleCoverage: Record<EternalRole, number>;
};

const data = eternalData as EternalDataSet;

export const predecessorEternalData = data;
export const eternals = data.eternals;

export function auditEternalData(dataset: EternalDataSet = data): EternalAuditReport {
  const validCategories = new Set(dataset.validEternalCategories);
  const validRoles = new Set(dataset.validEternalRoles);
  const validStatuses = new Set(dataset.validVerificationStatuses);
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const warnings: EternalAuditIssue[] = [];
  const errors: EternalAuditIssue[] = [];
  const categoryCoverage = Object.fromEntries(dataset.validEternalCategories.map((category) => [category, 0])) as Record<EternalCategory, number>;
  const roleCoverage = Object.fromEntries(dataset.validEternalRoles.map((role) => [role, 0])) as Record<EternalRole, number>;

  dataset.eternals.forEach((eternal) => {
    if (!eternal.id) errors.push(issue("error", eternal.name, "id", "Eternal is missing a stable id."));
    if (!eternal.name) errors.push(issue("error", eternal.id, "name", "Eternal is missing a display name."));

    if (seenIds.has(eternal.id)) errors.push(issue("error", eternal.name, "id", `Duplicate id: ${eternal.id}.`));
    if (seenNames.has(eternal.name)) errors.push(issue("error", eternal.name, "name", `Duplicate Eternal name: ${eternal.name}.`));
    seenIds.add(eternal.id);
    seenNames.add(eternal.name);

    if (!validCategories.has(eternal.category)) errors.push(issue("error", eternal.name, "category", `Invalid Eternal category: ${eternal.category}.`));
    else categoryCoverage[eternal.category] += 1;

    if (!validRoles.has(eternal.role)) errors.push(issue("error", eternal.name, "role", `Invalid Eternal role: ${eternal.role}.`));
    else roleCoverage[eternal.role] += 1;

    validateTrait(errors, warnings, eternal.name, "mainTrait", eternal.mainTrait);
    validateBlessingGroup(errors, warnings, eternal.name, "minorBlessing1", eternal.minorBlessing1);
    validateBlessingGroup(errors, warnings, eternal.name, "minorBlessing2", eternal.minorBlessing2);

    if (!Array.isArray(eternal.tags) || !eternal.tags.length) warnings.push(issue("warning", eternal.name, "tags", "Eternal has no recommendation tags."));
    if (!Array.isArray(eternal.answers) || !eternal.answers.length) warnings.push(issue("warning", eternal.name, "answers", "Eternal has no draft answer tags."));
    if (!eternal.sourceRef) errors.push(issue("error", eternal.name, "sourceRef", "Eternal is missing sourceRef."));
    if (!validStatuses.has(eternal.verification?.status)) {
      errors.push(issue("error", eternal.name, "verification.status", `Invalid verification status: ${eternal.verification?.status}.`));
    }
  });

  return {
    eternalCount: dataset.eternals.length,
    sourceBackedEternals: dataset.eternals.filter((eternal) => eternal.verification.status === "source-backed").length,
    warnings,
    errors,
    categoryCoverage,
    roleCoverage,
  };
}

function validateBlessingGroup(
  errors: EternalAuditIssue[],
  warnings: EternalAuditIssue[],
  eternal: string,
  field: "minorBlessing1" | "minorBlessing2",
  blessings: EternalBlessing[],
) {
  if (!Array.isArray(blessings)) {
    errors.push(issue("error", eternal, field, "Eternal blessing group must be an array."));
    return;
  }
  if (blessings.length !== 3) errors.push(issue("error", eternal, field, "Eternal blessing group must contain exactly 3 options."));

  const seenBlessings = new Set<string>();
  blessings.forEach((blessing) => {
    if (!blessing.id) errors.push(issue("error", eternal, field, "Eternal blessing is missing a stable id."));
    if (seenBlessings.has(blessing.id)) errors.push(issue("error", eternal, field, `Duplicate blessing id: ${blessing.id}.`));
    seenBlessings.add(blessing.id);
    validateTrait(errors, warnings, eternal, field, blessing);
  });
}

function validateTrait(
  errors: EternalAuditIssue[],
  warnings: EternalAuditIssue[],
  eternal: string | undefined,
  field: string,
  trait?: EternalTrait,
) {
  if (!trait) {
    errors.push(issue("error", eternal, field, "Eternal trait is missing."));
    return;
  }
  if (!trait.name) errors.push(issue("error", eternal, field, "Eternal trait is missing a name."));
  if (!trait.description) errors.push(issue("error", eternal, field, `${trait.name || "Trait"} is missing description text.`));
  if (trait.cooldown !== undefined && (!Number.isFinite(trait.cooldown) || trait.cooldown <= 0)) {
    errors.push(issue("error", eternal, `${field}.cooldown`, `${trait.name || "Trait"} cooldown must be a positive number.`));
  }
  Object.entries(trait.scaling ?? {}).forEach(([scale, value]) => {
    if (!Number.isFinite(value) || value < 0) {
      errors.push(issue("error", eternal, `${field}.scaling.${scale}`, "Eternal scaling values must be non-negative numbers."));
    }
  });
  if (!Array.isArray(trait.effects) || !trait.effects.length) warnings.push(issue("warning", eternal, field, `${trait.name || "Trait"} has no effect tags.`));
  if (!Array.isArray(trait.tags) || !trait.tags.length) warnings.push(issue("warning", eternal, field, `${trait.name || "Trait"} has no recommendation tags.`));
}

function issue(severity: EternalAuditIssue["severity"], eternal: string | undefined, field: string, message: string): EternalAuditIssue {
  return { severity, eternal, field, message };
}
