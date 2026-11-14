export type BackupRecord = Record<string, unknown> & { id: string };
export type WorkspaceBackupCollections = {
  properties: BackupRecord[];
  contacts: BackupRecord[];
  whatsappGroups: BackupRecord[];
  tasks: BackupRecord[];
  financials: BackupRecord[];
  riskRecords: BackupRecord[];
  approvalRequests: BackupRecord[];
  auditEvents: BackupRecord[];
  customModules?: BackupRecord[];
};
export type ParsedWorkspaceBackup = Partial<WorkspaceBackupCollections> & Pick<WorkspaceBackupCollections, "properties" | "contacts" | "tasks">;
export const WORKSPACE_BACKUP_FORMAT: "AXIVESTRA_WORKSPACE_BACKUP";
export const WORKSPACE_BACKUP_VERSION: 1;
export const WORKSPACE_BACKUP_KEYS: readonly string[];
export function createWorkspaceBackup(collections: Record<string, unknown[]>, exportedAt?: string): {
  format: "AXIVESTRA_WORKSPACE_BACKUP";
  schemaVersion: 1;
  exportedAt: string;
  collections: WorkspaceBackupCollections;
};
export function parseWorkspaceBackup(value: unknown): ParsedWorkspaceBackup;
