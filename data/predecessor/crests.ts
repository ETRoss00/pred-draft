import crestData from "./crests.json";

import type { VerificationStatus } from "./audit";

export type CrestRole = "carry";

export type CrestActive = {
  name: string;
  cooldown: number;
  description: string;
  duration?: number;
  recastWindow?: number;
  scaling?: Record<string, number>;
  effects: string[];
};

export type Crest = {
  id: string;
  name: string;
  role: CrestRole;
  purpose: string;
  stats: {
    physicalPower?: number;
    magicalPower?: number;
    attackSpeed?: number;
    lifesteal?: number;
    omnivamp?: number;
  };
  active: CrestActive;
  tags: string[];
  answers: string[];
  sourceRef: string;
  verification: {
    status: VerificationStatus;
    notes: string;
  };
};

export type CrestDataSet = typeof crestData & { crests: Crest[] };

export type CrestAuditIssue = {
  severity: "error" | "warning";
  crest?: string;
  field: string;
  message: string;
};

export type CrestAuditReport = {
  crestCount: number;
  sourceBackedCrests: number;
  warnings: CrestAuditIssue[];
  errors: CrestAuditIssue[];
  roleCoverage: Record<CrestRole, number>;
};

const data = crestData as CrestDataSet;

export const predecessorCrestData = data;
export const crests = data.crests;

export function auditCrestData(dataset: CrestDataSet = data): CrestAuditReport {
  const validRoles = new Set(dataset.validCrestRoles);
  const validStatuses = new Set(dataset.validVerificationStatuses);
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const warnings: CrestAuditIssue[] = [];
  const errors: CrestAuditIssue[] = [];
  const roleCoverage = Object.fromEntries(dataset.validCrestRoles.map((role) => [role, 0])) as Record<CrestRole, number>;

  dataset.crests.forEach((crest) => {
    if (!crest.id) errors.push(issue("error", crest.name, "id", "Crest is missing a stable id."));
    if (!crest.name) errors.push(issue("error", crest.id, "name", "Crest is missing a display name."));

    if (seenIds.has(crest.id)) errors.push(issue("error", crest.name, "id", `Duplicate id: ${crest.id}.`));
    if (seenNames.has(crest.name)) errors.push(issue("error", crest.name, "name", `Duplicate crest name: ${crest.name}.`));
    seenIds.add(crest.id);
    seenNames.add(crest.name);

    if (!validRoles.has(crest.role)) errors.push(issue("error", crest.name, "role", `Invalid crest role: ${crest.role}.`));
    else roleCoverage[crest.role] += 1;

    if (!crest.purpose) errors.push(issue("error", crest.name, "purpose", "Crest is missing a purpose."));
    if (!Object.keys(crest.stats).length) warnings.push(issue("warning", crest.name, "stats", "Crest has no stat block."));
    Object.entries(crest.stats).forEach(([stat, value]) => {
      if (!Number.isFinite(value) || value < 0) {
        errors.push(issue("error", crest.name, `stats.${stat}`, "Crest stat must be a non-negative number."));
      }
    });

    if (!crest.active?.name) errors.push(issue("error", crest.name, "active", "Crest active is missing a name."));
    if (!Number.isFinite(crest.active?.cooldown) || crest.active.cooldown <= 0) {
      errors.push(issue("error", crest.name, "active.cooldown", "Crest active cooldown must be a positive number."));
    }
    if (!crest.active?.description) errors.push(issue("error", crest.name, "active.description", "Crest active is missing description text."));
    if (!Array.isArray(crest.active?.effects) || !crest.active.effects.length) {
      warnings.push(issue("warning", crest.name, "active.effects", "Crest active has no effect tags."));
    }

    if (!crest.tags.length) warnings.push(issue("warning", crest.name, "tags", "Crest has no recommendation tags."));
    if (!crest.answers.length) warnings.push(issue("warning", crest.name, "answers", "Crest has no draft answer tags."));
    if (!crest.sourceRef) errors.push(issue("error", crest.name, "sourceRef", "Crest is missing sourceRef."));
    if (!validStatuses.has(crest.verification?.status)) {
      errors.push(issue("error", crest.name, "verification.status", `Invalid verification status: ${crest.verification?.status}.`));
    }
  });

  return {
    crestCount: dataset.crests.length,
    sourceBackedCrests: dataset.crests.filter((crest) => crest.verification.status === "source-backed").length,
    warnings,
    errors,
    roleCoverage,
  };
}

function issue(severity: CrestAuditIssue["severity"], crest: string | undefined, field: string, message: string): CrestAuditIssue {
  return { severity, crest, field, message };
}
