/**
 * Centralized name validation for Projects, Tenants, Branches, and Timelines.
 *
 * Invariants:
 *   project.name == tenant.name
 *   branch.name  == timeline display name
 *
 * These rules are enforced at both the API and UI layers.
 */

const MAX_NAME_LENGTH = 63;
const MIN_NAME_LENGTH = 1;

// Names that should not be used as project or branch names
const RESERVED_NAMES = new Set([
  "postgres",
  "template0",
  "template1",
  "neondb",
  "admin",
  "root",
  "system",
  "infrastructure",
  "internal",
  "_no_name_",
]);

// Valid pattern: alphanumeric, hyphens, underscores, spaces, dots, slashes
// Must start with alphanumeric or underscore
const VALID_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_\-. ]*$/;

export interface NameValidationResult {
  valid: boolean;
  error?: string;
  trimmedName?: string;
}

/**
 * Validate a project or tenant name.
 * Enforces: project.name == tenant.name
 */
export function validateProjectName(name: string): NameValidationResult {
  if (typeof name !== "string") {
    return { valid: false, error: "Name must be a string" };
  }

  const trimmed = name.trim();

  if (trimmed.length < MIN_NAME_LENGTH) {
    return { valid: false, error: "Project name cannot be empty" };
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return {
      valid: false,
      error: `Project name cannot exceed ${MAX_NAME_LENGTH} characters (currently ${trimmed.length})`,
    };
  }

  if (!VALID_NAME_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error:
        "Project name can only contain letters, numbers, hyphens, underscores, dots, and spaces. Must start with a letter or number.",
    };
  }

  if (RESERVED_NAMES.has(trimmed.toLowerCase())) {
    return {
      valid: false,
      error: `"${trimmed}" is a reserved name and cannot be used as a project name`,
    };
  }

  return { valid: true, trimmedName: trimmed };
}

/**
 * Validate a branch or timeline name.
 * Enforces: branch.name == timeline display name
 */
export function validateBranchName(name: string): NameValidationResult {
  if (typeof name !== "string") {
    return { valid: false, error: "Name must be a string" };
  }

  const trimmed = name.trim();

  if (trimmed.length < MIN_NAME_LENGTH) {
    return { valid: false, error: "Branch name cannot be empty" };
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return {
      valid: false,
      error: `Branch name cannot exceed ${MAX_NAME_LENGTH} characters (currently ${trimmed.length})`,
    };
  }

  if (!VALID_NAME_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error:
        "Branch name can only contain letters, numbers, hyphens, underscores, dots, and spaces. Must start with a letter or number.",
    };
  }

  if (RESERVED_NAMES.has(trimmed.toLowerCase())) {
    return {
      valid: false,
      error: `"${trimmed}" is a reserved name and cannot be used as a branch name`,
    };
  }

  return { valid: true, trimmedName: trimmed };
}

/**
 * Check for duplicate names within a list of existing names.
 */
export function checkDuplicateName(
  newName: string,
  existingNames: string[],
  excludeId?: string,
  getId?: (item: any) => string
): NameValidationResult {
  const lower = newName.toLowerCase();
  const duplicate = existingNames.find(
    (existing, idx) =>
      existing.toLowerCase() === lower &&
      (excludeId ? (getId ? getId(existing) !== excludeId : true) : true)
  );

  if (duplicate) {
    return {
      valid: false,
      error: `A resource with the name "${newName}" already exists`,
    };
  }

  return { valid: true, trimmedName: newName };
}
