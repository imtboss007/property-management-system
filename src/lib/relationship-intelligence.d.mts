export type RelationshipContact = {
  id: string;
  name?: string;
  role?: string;
  roles?: string[];
  customRoles?: string;
};
export type RelationshipRecord = {
  id?: string;
  title?: string;
  name?: string;
  type?: string;
  reference?: string;
  module?: string;\n  propertyId?: string;
  primaryContactId?: string;
  contactId?: string;
  followUpContactIds?: string[];
  moduleData?: Record<string, unknown>;
};
export function buildRelationshipIntelligence(input?: {
  contacts?: RelationshipContact[];
  properties?: RelationshipRecord[];
  tasks?: RelationshipRecord[];
  financials?: RelationshipRecord[];
  risks?: RelationshipRecord[];
  approvals?: RelationshipRecord[];
  documents?: RelationshipRecord[];
}): {
  contacts: Array<{
    id: string; name: string; role: string; roles: string[];
    records: Array<{key:string;kind:string;title:string;workspace:string;recordId:string;relations:string[]}>;
    workspaces: string[]; recordCount: number;
  }>;
  linkedContacts: number;
  linkedRecords: number;
  unlinkedContacts: number;
  unresolvedReferences: number;
};
