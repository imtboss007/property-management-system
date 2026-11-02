export type RecordFollowUpEntry = {
  id: string;
  followPersonId: string;
  followPersonName: string;
  followDate: string;
  followTime: string;
  remarks: string;
  nextFollowUpDate: string;
  nextFollowUpTime: string;
  description?: string;
  amount?: string;
  priority?: string;
  status?: string;
  nextAction?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type RecordFollowUpRecord = {
  id: string;
  title: string;
  module: string;
  followUpEntries?: RecordFollowUpEntry[];
};

export type RecordFollowUpContact = { id: string; name: string };

/** Replace one entry without disturbing the other follow-ups for the same record. */
export function upsertRecordFollowUp(
  existing: RecordFollowUpEntry[] = [],
  entry: RecordFollowUpEntry
): RecordFollowUpEntry[] {
  if (!entry.id) throw new Error("A follow-up entry ID is required.");
  const index = existing.findIndex(row => row.id === entry.id);
  if (index < 0) return [...existing, entry];
  return existing.map((row, rowIndex) => rowIndex === index ? entry : row);
}

/** Remove exactly one follow-up row from a record. */
export function removeRecordFollowUp(
  existing: RecordFollowUpEntry[] = [],
  entryId: string
): RecordFollowUpEntry[] {
  return existing.filter(row => row.id !== entryId);
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

/** Export the currently visible record rows as an Excel-friendly CSV table. */
export function buildRecordFollowUpCsv(
  records: RecordFollowUpRecord[],
  contacts: RecordFollowUpContact[]
): string {
  const contactNames = new Map(contacts.map(contact => [contact.id, contact.name]));
  const rows: unknown[][] = [[
    "Record Name", "Module", "Follow Person", "Description", "Amount", "Assigned At", "Follow-up Date", "Follow-up Time",
    "Remarks", "Priority", "Status", "Next Action", "Next Follow-up Date", "Next Follow-up Time", "Notes"
  ]];
  for (const record of records) {
    for (const entry of record.followUpEntries || []) {
      rows.push([
        record.title, record.module,
        contactNames.get(entry.followPersonId) || entry.followPersonName || "",
        entry.description || "", entry.amount || "", entry.createdAt || "",
        entry.followDate, entry.followTime, entry.remarks, entry.priority || "Normal", entry.status || "Open",
        entry.nextAction || "", entry.nextFollowUpDate, entry.nextFollowUpTime, entry.notes || ""
      ]);
    }
  }
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}
