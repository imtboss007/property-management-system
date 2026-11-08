export type RelationshipSourceRecord = {
  key: string;
  kind: string;
  title: string;
  workspace: string;
  recordId: string;
  relations: string[];
};

export type RelationshipContactSummary = {
  id: string;
  name: string;
  role: string;
  roles: string[];
  records: RelationshipSourceRecord[];
  workspaces: string[];
  recordCount: number;
};

export type RelationshipIntelligenceResult = {
  contacts: RelationshipContactSummary[];
  linkedContacts: number;
  linkedRecords: number;
  unlinkedContacts: number;
  unresolvedReferences: number;
};

/** Read-only relationship summary resolved exclusively from persisted contact IDs. */
export function buildRelationshipIntelligence(input?: any): RelationshipIntelligenceResult;
