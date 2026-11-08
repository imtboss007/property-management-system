const cleanId = value => String(value ?? "").trim();

function addReference(target, contactId, record, kind, relation, unresolved) {
  const id = cleanId(contactId);
  if (!id) return;
  const person = target.get(id);
  if (!person) {
    unresolved.add(id + "|" + kind + "|" + String(record?.id || ""));
    return;
  }
  const key = kind + ":" + String(record?.id || record?.title || "");
  const current = person.records.get(key) || {
    key,
    kind,
    title: String(record?.title || record?.name || record?.reference || record?.type || kind),
    workspace: String(record?.module || ""),
    recordId: String(record?.id || ""),
    relations: []
  };
  if (relation && !current.relations.includes(relation)) current.relations.push(relation);
  person.records.set(key, current);
}

function idsFromList(value) {
  return [...new Set(String(value || "").split(",").map(cleanId).filter(Boolean))];
}

/**
 * Build a read-only relationship summary from explicit, persisted contact IDs.
 * Display-name similarity is intentionally never used as a relationship key.
 */
export function buildRelationshipIntelligence(input = {}) {
  const contacts = Array.isArray(input.contacts) ? input.contacts : [];
  const people = new Map();
  for (const contact of contacts) {
    if (!contact?.id) continue;
    const id = cleanId(contact.id);
    if (!id || people.has(id)) continue;
    people.set(id, {
      id,
      name: String(contact.name || "Unnamed contact"),
      role: String(contact.role || ""),
      roles: [...new Set([
        ...(Array.isArray(contact.roles) ? contact.roles : []),
        String(contact.role || ""),
        ...String(contact.customRoles || "").split(",")
      ].map(value => String(value || "").trim()).filter(Boolean))],
      records: new Map()
    });
  }

  const unresolved = new Set();
  for (const record of Array.isArray(input.properties) ? input.properties : []) {
    const data = record?.moduleData && typeof record.moduleData === "object" ? record.moduleData : {};
    addReference(people, record?.primaryContactId, record, "workspace", "Primary contact", unresolved);
    for (const id of idsFromList(data.__linkedContactIds)) {
      addReference(people, id, record, "workspace", "Linked participant", unresolved);
    }
    for (const id of idsFromList(data.__followUpContactIds)) {
      addReference(people, id, record, "workspace", "Follow-up contact", unresolved);
    }
    for (const [key, value] of Object.entries(data)) {
      if (!key.startsWith("__contact_")) continue;
      const relation = key.slice("__contact_".length).replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").trim();
      addReference(people, value, record, "workspace", relation || "Related contact", unresolved);
    }
  }

  for (const task of Array.isArray(input.tasks) ? input.tasks : []) {
    addReference(people, task?.contactId, task, "task", "Task contact", unresolved);
    for (const id of Array.isArray(task?.followUpContactIds) ? task.followUpContactIds : []) {
      addReference(people, id, task, "task", "Task follow-up contact", unresolved);
    }
  }
  for (const [collection, kind, relation] of [
    [input.financials, "financial", "Transaction counterparty"],
    [input.risks, "risk", "Risk contact"],
    [input.approvals, "approval", "Approval contact"],
    [input.documents, "document", "Document contact"]
  ]) {
    for (const record of Array.isArray(collection) ? collection : []) {
      addReference(people, record?.contactId, record, kind, relation, unresolved);
    }
  }

  const summaries = [...people.values()].map(person => {
    const records = [...person.records.values()].map(item => ({
      ...item,
      relations: [...item.relations].sort()
    })).sort((a, b) => a.workspace.localeCompare(b.workspace) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
    const workspaces = [...new Set(records.map(item => item.workspace).filter(Boolean))].sort();
    return {
      id: person.id,
      name: person.name,
      role: person.role,
      roles: person.roles,
      records,
      workspaces,
      recordCount: records.length
    };
  }).sort((a, b) => b.recordCount - a.recordCount || a.name.localeCompare(b.name));

  const linkedContacts = summaries.filter(person => person.recordCount > 0).length;
  const linkedRecords = summaries.reduce((sum, person) => sum + person.recordCount, 0);
  return {
    contacts: summaries,
    linkedContacts,
    linkedRecords,
    unlinkedContacts: summaries.length - linkedContacts,
    unresolvedReferences: unresolved.size
  };
}
