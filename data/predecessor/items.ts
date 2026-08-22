import itemData from "./items.json";

import type { VerificationStatus } from "./audit";

export type ItemRole = "carry";

export type ItemPassive = {
  name: string;
  cooldown?: number;
  description: string;
  scaling?: Record<string, number>;
  effects: string[];
};

export type ItemRestriction = {
  description: string;
  effects: string[];
};

export type Item = {
  id: string;
  name: string;
  role: ItemRole;
  purpose: string;
  stats: {
    physicalPower?: number;
    magicalPower?: number;
    attackSpeed?: number;
    criticalChance?: number;
    abilityHaste?: number;
    lifesteal?: number;
    movementSpeed?: number;
    tenacity?: number;
    physicalPenetration?: number;
    maxMana?: number;
  };
  passives: ItemPassive[];
  restrictions?: ItemRestriction[];
  tags: string[];
  answers: string[];
  sourceRef: string;
  verification: {
    status: VerificationStatus;
    notes: string;
  };
};

export type ItemDataSet = typeof itemData & { items: Item[] };

export type ItemAuditIssue = {
  severity: "error" | "warning";
  item?: string;
  field: string;
  message: string;
};

export type ItemAuditReport = {
  itemCount: number;
  sourceBackedItems: number;
  warnings: ItemAuditIssue[];
  errors: ItemAuditIssue[];
  roleCoverage: Record<ItemRole, number>;
};

const data = itemData as ItemDataSet;

export const predecessorItemData = data;
export const items = data.items;

export function auditItemData(dataset: ItemDataSet = data): ItemAuditReport {
  const validRoles = new Set(dataset.validItemRoles);
  const validStatuses = new Set(dataset.validVerificationStatuses);
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const warnings: ItemAuditIssue[] = [];
  const errors: ItemAuditIssue[] = [];
  const roleCoverage = Object.fromEntries(dataset.validItemRoles.map((role) => [role, 0])) as Record<ItemRole, number>;

  dataset.items.forEach((item) => {
    if (!item.id) errors.push(issue("error", item.name, "id", "Item is missing a stable id."));
    if (!item.name) errors.push(issue("error", item.id, "name", "Item is missing a display name."));

    if (seenIds.has(item.id)) errors.push(issue("error", item.name, "id", `Duplicate id: ${item.id}.`));
    if (seenNames.has(item.name)) errors.push(issue("error", item.name, "name", `Duplicate item name: ${item.name}.`));
    seenIds.add(item.id);
    seenNames.add(item.name);

    if (!validRoles.has(item.role)) errors.push(issue("error", item.name, "role", `Invalid item role: ${item.role}.`));
    else roleCoverage[item.role] += 1;

    if (!item.purpose) errors.push(issue("error", item.name, "purpose", "Item is missing a purpose."));
    if (!Object.keys(item.stats).length) warnings.push(issue("warning", item.name, "stats", "Item has no stat block."));
    Object.entries(item.stats).forEach(([stat, value]) => {
      if (!Number.isFinite(value) || value < 0) {
        errors.push(issue("error", item.name, `stats.${stat}`, "Item stat must be a non-negative number."));
      }
    });

    if (!Array.isArray(item.passives) || !item.passives.length) {
      errors.push(issue("error", item.name, "passives", "Source-backed item is missing passive details."));
    }
    item.passives?.forEach((passive) => {
      if (!passive.name) errors.push(issue("error", item.name, "passives", "Item passive is missing a name."));
      if (!passive.description) errors.push(issue("error", item.name, "passives", `${passive.name || "Passive"} is missing description text.`));
      if (passive.cooldown !== undefined && (!Number.isFinite(passive.cooldown) || passive.cooldown <= 0)) {
        errors.push(issue("error", item.name, "passives.cooldown", `${passive.name || "Passive"} cooldown must be a positive number.`));
      }
      if (!Array.isArray(passive.effects) || !passive.effects.length) {
        warnings.push(issue("warning", item.name, "passives", `${passive.name || "Passive"} has no effect tags.`));
      }
    });

    item.restrictions?.forEach((restriction) => {
      if (!restriction.description) errors.push(issue("error", item.name, "restrictions", "Item restriction is missing description text."));
      if (!Array.isArray(restriction.effects) || !restriction.effects.length) {
        warnings.push(issue("warning", item.name, "restrictions", "Item restriction has no effect tags."));
      }
    });

    if (!item.tags.length) warnings.push(issue("warning", item.name, "tags", "Item has no recommendation tags."));
    if (!item.answers.length) warnings.push(issue("warning", item.name, "answers", "Item has no draft answer tags."));
    if (!item.sourceRef) errors.push(issue("error", item.name, "sourceRef", "Item is missing sourceRef."));
    if (!validStatuses.has(item.verification?.status)) {
      errors.push(issue("error", item.name, "verification.status", `Invalid verification status: ${item.verification?.status}.`));
    }
  });

  return {
    itemCount: dataset.items.length,
    sourceBackedItems: dataset.items.filter((item) => item.verification.status === "source-backed").length,
    warnings,
    errors,
    roleCoverage,
  };
}

function issue(severity: ItemAuditIssue["severity"], item: string | undefined, field: string, message: string): ItemAuditIssue {
  return { severity, item, field, message };
}
