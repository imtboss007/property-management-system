export const WORKSPACE_BACKUP_FORMAT = "AXIVESTRA_WORKSPACE_BACKUP";
export const WORKSPACE_BACKUP_VERSION = 1;

export const WORKSPACE_BACKUP_KEYS = [
  "properties",
  "contacts",
  "whatsappGroups",
  "tasks",
  "financials",
  "riskRecords",
  "approvalRequests",
  "auditEvents"
];

const REQUIRED_LEGACY_KEYS = ["properties", "contacts", "tasks"];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateCollection(key, value) {
  if (!Array.isArray(value)) {
    throw new Error("Backup collection '" + key + "' must be an array.");
  }
  for (let index = 0; index < value.length; index += 1) {
    const row = value[index];
    if (!isRecord(row) || typeof row.id !== "string" || !row.id.trim()) {
      throw new Error("Backup collection '" + key + "' contains an invalid record at row " + (index + 1) + ".");
    }
  }
  return value;
}

export function createWorkspaceBackup(collections, exportedAt = new Date().toISOString()) {
  if (!isRecord(collections)) throw new Error("Workspace records are required.");
  const normalized = {};
  for (const key of WORKSPACE_BACKUP_KEYS) {
    normalized[key] = validateCollection(key, collections[key]);
  }
  return {
    format: WORKSPACE_BACKUP_FORMAT,
    schemaVersion: WORKSPACE_BACKUP_VERSION,
    exportedAt,
    collections: normalized
  };
}

/**
 * Parse both the current versioned backup and older flat estateflow backups.
 * Missing optional arrays in legacy files are deliberately omitted so callers
 * can preserve their existing values rather than replacing them with empties.
 */
export function parseWorkspaceBackup(value) {
  if (!isRecord(value)) throw new Error("The selected file is not a JSON object.");

  let collections;
  if (value.format !== undefined) {
    if (value.format !== WORKSPACE_BACKUP_FORMAT || value.schemaVersion !== WORKSPACE_BACKUP_VERSION) {
      throw new Error("This AXIVESTRA backup version is not supported.");
    }
    if (!isRecord(value.collections)) throw new Error("The backup collections are missing.");
    collections = value.collections;
    for (const key of WORKSPACE_BACKUP_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(collections, key)) {
        throw new Error("The backup is incomplete: missing '" + key + "'.");
      }
    }
  } else {
    collections = value;
    for (const key of REQUIRED_LEGACY_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(collections, key)) {
        throw new Error("The legacy backup is incomplete: missing '" + key + "'.");
      }
    }
  }

  const parsed = {};
  for (const key of WORKSPACE_BACKUP_KEYS) {
    if (Object.prototype.hasOwnProperty.call(collections, key)) {
      parsed[key] = validateCollection(key, collections[key]);
    }
  }
  return parsed;
}
