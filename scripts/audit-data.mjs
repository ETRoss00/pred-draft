import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dataset = JSON.parse(await readFile(new URL("../data/predecessor/heroes.json", import.meta.url), "utf8"));
const crestDataset = JSON.parse(await readFile(new URL("../data/predecessor/crests.json", import.meta.url), "utf8"));
const errors = [];
const warnings = [];
const validRoles = new Set(dataset.validRoles);
const validDamage = new Set(dataset.validDamageTypes);
const validRange = new Set(dataset.validRangeTypes);
const validSlots = new Set(dataset.validAbilitySlots ?? []);
const seenIds = new Set();
const seenNames = new Set();
const roleCoverage = Object.fromEntries(dataset.validRoles.map((role) => [role, 0]));

for (const hero of dataset.heroes) {
  if (!hero.id) errors.push(`[id] ${hero.name ?? "Unknown"} is missing a stable id.`);
  if (!hero.name) errors.push(`[name] ${hero.id ?? "Unknown"} is missing a display name.`);

  if (seenIds.has(hero.id)) errors.push(`[id] duplicate id: ${hero.id}.`);
  if (seenNames.has(hero.name)) errors.push(`[name] duplicate hero name: ${hero.name}.`);
  seenIds.add(hero.id);
  seenNames.add(hero.name);

  if (!Array.isArray(hero.roles) || hero.roles.length === 0) errors.push(`[roles] ${hero.name} must have at least one role.`);
  for (const role of hero.roles ?? []) {
    if (!validRoles.has(role)) errors.push(`[roles] ${hero.name} has invalid role: ${role}.`);
    else roleCoverage[role] += 1;
  }
  for (const role of hero.flexRoles ?? []) {
    if (!validRoles.has(role)) errors.push(`[flexRoles] ${hero.name} has invalid flex role: ${role}.`);
  }

  if (!validDamage.has(hero.damage)) errors.push(`[damage] ${hero.name} has invalid damage type: ${hero.damage}.`);
  if (!validRange.has(hero.range)) errors.push(`[range] ${hero.name} has invalid range type: ${hero.range}.`);

  if (hero.ratings) {
    for (const [rating, value] of Object.entries(hero.ratings)) {
      if (!Number.isFinite(value) || value < 0 || value > 10) errors.push(`[ratings.${rating}] ${hero.name} rating must be a number from 0 to 10.`);
    }
  }

  if (hero.abilities) {
    const seenSlots = new Set();
    for (const ability of hero.abilities) {
      if (!validSlots.has(ability.slot)) errors.push(`[abilities] ${hero.name} has invalid ability slot: ${ability.slot}.`);
      if (seenSlots.has(ability.slot)) errors.push(`[abilities] ${hero.name} has duplicate ability slot: ${ability.slot}.`);
      seenSlots.add(ability.slot);
      if (!ability.name) errors.push(`[abilities] ${hero.name} has an ability missing a name.`);
      if (!ability.description) errors.push(`[abilities] ${hero.name} ${ability.name || ability.slot} is missing description text.`);
      if (!Array.isArray(ability.effects) || ability.effects.length === 0) warnings.push(`[abilities] ${hero.name} ${ability.name || ability.slot} has no effects tags.`);
      if (!ability.sourceRef) errors.push(`[abilities] ${hero.name} ${ability.name || ability.slot} is missing sourceRef.`);
    }
    for (const slot of validSlots) {
      if (!seenSlots.has(slot)) errors.push(`[abilities] ${hero.name} source-backed hero is missing ${slot} ability.`);
    }
  }

  if (hero.augments) {
    const seenAugments = new Set();
    for (const augment of hero.augments) {
      if (seenAugments.has(augment.name)) errors.push(`[augments] ${hero.name} has duplicate augment: ${augment.name}.`);
      seenAugments.add(augment.name);
      if (!augment.name) errors.push(`[augments] ${hero.name} has an augment missing a name.`);
      if (!augment.description) errors.push(`[augments] ${hero.name} ${augment.name || "augment"} is missing description text.`);
      if (!Array.isArray(augment.tags) || augment.tags.length === 0) warnings.push(`[augments] ${hero.name} ${augment.name || "augment"} has no recommendation tags.`);
      if (!augment.sourceRef) errors.push(`[augments] ${hero.name} ${augment.name || "augment"} is missing sourceRef.`);
    }
  }

  for (const field of ["threats", "answers", "weaknesses"]) {
    if (!Array.isArray(hero[field]) || hero[field].length === 0) warnings.push(`[${field}] ${hero.name} has no ${field} tags.`);
  }

  if (hero.verification?.roleStatus !== "source-backed") warnings.push(`[roles] ${hero.name} roles need source review.`);
  if (hero.verification?.kitStatus !== "source-backed") warnings.push(`[kit] ${hero.name} kit tags are prototype taxonomy.`);
  if (hero.verification?.abilityStatus === "source-backed" && !hero.abilities) errors.push(`[abilities] ${hero.name} ability status is source-backed but no abilities are present.`);
  if (hero.verification?.augmentStatus === "source-backed" && !hero.augments) errors.push(`[augments] ${hero.name} augment status is source-backed but no augments are present.`);
}

const validCrestRoles = new Set(crestDataset.validCrestRoles);
const validCrestStatuses = new Set(crestDataset.validVerificationStatuses);
const seenCrestIds = new Set();
const seenCrestNames = new Set();
const crestRoleCoverage = Object.fromEntries(crestDataset.validCrestRoles.map((role) => [role, 0]));

for (const crest of crestDataset.crests) {
  if (!crest.id) errors.push(`[crests.id] ${crest.name ?? "Unknown"} is missing a stable id.`);
  if (!crest.name) errors.push(`[crests.name] ${crest.id ?? "Unknown"} is missing a display name.`);

  if (seenCrestIds.has(crest.id)) errors.push(`[crests.id] duplicate id: ${crest.id}.`);
  if (seenCrestNames.has(crest.name)) errors.push(`[crests.name] duplicate crest name: ${crest.name}.`);
  seenCrestIds.add(crest.id);
  seenCrestNames.add(crest.name);

  if (!validCrestRoles.has(crest.role)) errors.push(`[crests.role] ${crest.name} has invalid crest role: ${crest.role}.`);
  else crestRoleCoverage[crest.role] += 1;

  if (!crest.purpose) errors.push(`[crests.purpose] ${crest.name} is missing a purpose.`);
  if (!crest.stats || !Object.keys(crest.stats).length) warnings.push(`[crests.stats] ${crest.name} has no stat block.`);
  for (const [stat, value] of Object.entries(crest.stats ?? {})) {
    if (!Number.isFinite(value) || value < 0) errors.push(`[crests.stats.${stat}] ${crest.name} stat must be a non-negative number.`);
  }

  if (!crest.active?.name) errors.push(`[crests.active] ${crest.name} active is missing a name.`);
  if (!Number.isFinite(crest.active?.cooldown) || crest.active.cooldown <= 0) errors.push(`[crests.active.cooldown] ${crest.name} active cooldown must be a positive number.`);
  if (!crest.active?.description) errors.push(`[crests.active.description] ${crest.name} active is missing description text.`);
  if (!Array.isArray(crest.active?.effects) || crest.active.effects.length === 0) warnings.push(`[crests.active.effects] ${crest.name} active has no effect tags.`);
  if (!Array.isArray(crest.tags) || crest.tags.length === 0) warnings.push(`[crests.tags] ${crest.name} has no recommendation tags.`);
  if (!Array.isArray(crest.answers) || crest.answers.length === 0) warnings.push(`[crests.answers] ${crest.name} has no draft answer tags.`);
  if (!crest.sourceRef) errors.push(`[crests.sourceRef] ${crest.name} is missing sourceRef.`);
  if (!validCrestStatuses.has(crest.verification?.status)) errors.push(`[crests.verification.status] ${crest.name} has invalid verification status: ${crest.verification?.status}.`);
}

assert.equal(dataset.schemaVersion, 2, "heroes.json schemaVersion must be 2");
assert.ok(dataset.heroes.length > 0, "heroes.json must contain heroes");
assert.equal(crestDataset.schemaVersion, 1, "crests.json schemaVersion must be 1");
assert.ok(crestDataset.crests.length > 0, "crests.json must contain crests");

const fullyVerified = dataset.heroes.filter((hero) =>
  hero.verification?.roleStatus === "source-backed" &&
  hero.verification?.classStatus === "source-backed" &&
  hero.verification?.ratingStatus === "source-backed" &&
  hero.verification?.abilityStatus === "source-backed" &&
  hero.verification?.augmentStatus === "source-backed" &&
  hero.verification?.kitStatus === "source-backed"
);

console.log(`Predecessor hero data audit`);
console.log(`Heroes: ${dataset.heroes.length}`);
console.log(`Fully verified heroes: ${fullyVerified.length}`);
console.log(`Role coverage: ${Object.entries(roleCoverage).map(([role, count]) => `${role}=${count}`).join(", ")}`);
console.log(`Crests: ${crestDataset.crests.length}`);
console.log(`Crest role coverage: ${Object.entries(crestRoleCoverage).map(([role, count]) => `${role}=${count}`).join(", ")}`);
console.log(`Warnings: ${warnings.length}`);
console.log(`Errors: ${errors.length}`);

if (warnings.length) {
  console.log("\nWarnings");
  warnings.slice(0, 30).forEach((warning) => console.log(`- ${warning}`));
  if (warnings.length > 30) console.log(`- ...and ${warnings.length - 30} more warnings`);
}

if (errors.length) {
  console.error("\nErrors");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
