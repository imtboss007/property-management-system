export type ContactDirectoryRecord = {
  id: string;
  name?: string;
  phone?: string;
  whatsappName?: string;
  whatsappJid?: string;
  whatsappAliases?: string[];
  role?: string;
  roles?: string[];
  customRoles?: string;
  [key: string]: unknown;
};
export function canonicalContactPhone(value: string | null | undefined): string;
export function deduplicateMasterContacts(records: ContactDirectoryRecord[]): {
  contacts: ContactDirectoryRecord[];
  remap: Record<string, string>;
  removedIds: string[];
  duplicatesRemoved: number;
};
export function remapWorkspaceContactReferences<T extends {
  properties?: Array<Record<string, any>>;
  tasks?: Array<Record<string, any>>;
  financials?: Array<Record<string, any>>;
  riskRecords?: Array<Record<string, any>>;
  approvalRequests?: Array<Record<string, any>>;
}>(workspace: T, remap: Record<string, string>): {
  properties: Array<Record<string, any>>;
  tasks: Array<Record<string, any>>;
  financials: Array<Record<string, any>>;
  riskRecords: Array<Record<string, any>>;
  approvalRequests: Array<Record<string, any>>;
};
