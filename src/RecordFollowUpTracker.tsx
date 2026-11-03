import { useEffect, useMemo, useState } from "react";
import { saveBlobForUser } from "./lib/mobile-export";
import { ClipboardList, Download, ExternalLink, Plus, Search, Trash2, Users } from "lucide-react";
import SearchableContactPicker, { type SearchableContactGroup } from "./SearchableContactPicker";
import {
  buildRecordFollowUpCsv,
  type RecordFollowUpContact,
  type RecordFollowUpEntry,
  type RecordFollowUpRecord
} from "./lib/record-follow-up";

type RecordRow = RecordFollowUpRecord & {
  followUpContactId?: string;
  primaryContactId?: string;
  contact?: string;
  moduleData?: Record<string,string>;
};
type ContactRow = RecordFollowUpContact & {
  role?: string;
  roles?: string[];
  phone?: string;
  whatsappName?: string;
  whatsappJid?: string;
  whatsappGroupIds?: string[];
  email?: string;
  address?: string;
  profession?: string;
  employer?: string;
  designation?: string;
  businessType?: string;
  associatedCompany?: string;
  customRoles?: string;
};
type DraftRow = { recordId: string; entry: RecordFollowUpEntry; dirty: boolean };
type Props = {
  records: RecordRow[];
  contacts: ContactRow[];
  groups: SearchableContactGroup[];
  moduleNames: string[];
  readOnly?: boolean;
  onUpsertFollowUp: (recordId: string, entry: RecordFollowUpEntry) => void;
  onRemoveFollowUp: (recordId: string, entryId: string) => void;
  onUpdateRecordTitle: (recordId: string, title: string) => void;
  onOpenRecord: (record: RecordRow) => void;
  onOpenContact: (contactId: string) => void;
  onDownloadStatus: (message: string) => void;
};

const rowKey = (recordId: string, entryId: string) => recordId + "::" + entryId;
const buildDrafts = (records: RecordRow[]): Record<string, DraftRow> => Object.fromEntries(
  records.flatMap(record => (record.followUpEntries || []).map(entry => [
    rowKey(record.id, entry.id),
    { recordId: record.id, entry: { ...entry }, dirty: false }
  ]))
);
const newEntry = (contact?: ContactRow): RecordFollowUpEntry => {
  const now = new Date().toISOString();
  return {
    id: "record-followup-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9),
    followPersonId: contact?.id || "",
    followPersonName: contact?.name || "",
    followDate: "",
    followTime: "",
    remarks: "",
    nextFollowUpDate: "",
    nextFollowUpTime: "",
    createdAt: now,
    updatedAt: now
  };
};

export default function RecordFollowUpTracker(props: Props) {
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>(() => buildDrafts(props.records));
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [showRecordsWithoutFollowUps, setShowRecordsWithoutFollowUps] = useState(false);
  const [query, setQuery] = useState("");
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>(() => Object.fromEntries(props.records.map(record => [record.id, record.title || ""])));
  const [dirtyTitleIds, setDirtyTitleIds] = useState<Record<string, boolean>>({});

  // Reconcile saved changes without replacing an actively edited local row.
  useEffect(() => {
    const saved = buildDrafts(props.records);
    setDrafts(current => {
      const next = { ...current };
      for (const [key, row] of Object.entries(current)) {
        if (saved[key]) {
          if (!row.dirty) next[key] = saved[key];
        } else if (!row.dirty) {
          delete next[key];
        }
      }
      for (const [key, row] of Object.entries(saved)) if (!next[key]) next[key] = row;
      return next;
    });
    setTitleDrafts(current => {
      const next = { ...current };
      const currentIds = new Set(props.records.map(record => record.id));
      for (const record of props.records) if (!dirtyTitleIds[record.id]) next[record.id] = record.title || "";
      for (const id of Object.keys(next)) if (!currentIds.has(id)) delete next[id];
      return next;
    });
  }, [props.records]);

  const moduleOptions = useMemo(() => Array.from(new Set([
    ...props.moduleNames,
    ...props.records.map(record => record.module).filter(Boolean)
  ])).sort((a, b) => a.localeCompare(b)), [props.moduleNames, props.records]);
  const moduleCounts = useMemo(() => {
    const counts = new Map<string,number>();
    props.records.forEach(record => counts.set(record.module,(counts.get(record.module)||0)+1));
    return new Map(moduleOptions.map(name => [name,counts.get(name)||0]));
  }, [moduleOptions, props.records]);
  const contactsById = useMemo(() => new Map(props.contacts.map(contact => [contact.id, contact])), [props.contacts]);
  const entriesByRecord = useMemo(() => {
    const grouped = new Map<string,RecordFollowUpEntry[]>();
    Object.values(drafts).forEach(row => {
      const rows = grouped.get(row.recordId) || [];
      rows.push(row.entry);
      grouped.set(row.recordId,rows);
    });
    grouped.forEach(rows => rows.sort((a,b) =>
      (a.nextFollowUpDate || "9999-12-31").localeCompare(b.nextFollowUpDate || "9999-12-31")
      || (a.nextFollowUpTime || "99:99").localeCompare(b.nextFollowUpTime || "99:99")
      || a.createdAt.localeCompare(b.createdAt)
    ));
    return grouped;
  },[drafts]);
  const entriesForRecord = (recordId: string) => entriesByRecord.get(recordId) || [];

  const visibleRecords = useMemo(() => {
    const term = query.trim().normalize("NFKC").toLocaleLowerCase();
    return props.records.filter(record => {
      if (selectedModules.length && !selectedModules.includes(record.module)) return false;
      const entries = entriesByRecord.get(record.id) || [];
      if (!selectedModules.length && !showRecordsWithoutFollowUps && entries.length === 0) return false;
      if (!term) return true;
      const entryText = entries.flatMap(entry => {
        const contact = contactsById.get(entry.followPersonId);
        return [entry.followPersonName, contact?.name, entry.followDate, entry.followTime,
          entry.remarks, entry.nextFollowUpDate, entry.nextFollowUpTime];
      });
      return [record.title, record.module, record.contact, ...entryText]
        .filter(Boolean).join(" ").normalize("NFKC").toLocaleLowerCase().includes(term);
    }).sort((a, b) => a.module.localeCompare(b.module) || a.title.localeCompare(b.title));
  }, [props.records, selectedModules, showRecordsWithoutFollowUps, query, entriesByRecord, contactsById]);

  const visibleEntryCount = visibleRecords.reduce((sum, record) => sum + entriesForRecord(record.id).length, 0);
  const overdueCount = visibleRecords.reduce((sum, record) => sum + entriesForRecord(record.id).filter(entry =>
    entry.nextFollowUpDate && entry.nextFollowUpDate < new Date().toISOString().slice(0, 10)
  ).length, 0);

  const patch = (recordId: string, entryId: string, field: keyof RecordFollowUpEntry, value: string) => {
    const key = rowKey(recordId, entryId);
    setDrafts(current => {
      const row = current[key];
      return row ? { ...current, [key]: { ...row, entry: { ...row.entry, [field]: value }, dirty: true } } : current;
    });
  };

  const patchRecordTitle = (recordId: string, value: string) => {
    setTitleDrafts(current => ({ ...current, [recordId]: value }));
    setDirtyTitleIds(current => ({ ...current, [recordId]: true }));
  };

  const saveRecordTitle = (record: RecordRow) => {
    if (props.readOnly) return;
    const value = (titleDrafts[record.id] ?? record.title ?? "").trim();
    if (!value) {
      setTitleDrafts(current => ({ ...current, [record.id]: record.title || "" }));
      setDirtyTitleIds(current => ({ ...current, [record.id]: false }));
      return;
    }
    if (value !== record.title) props.onUpdateRecordTitle(record.id, value);
    setTitleDrafts(current => ({ ...current, [record.id]: value }));
    setDirtyTitleIds(current => ({ ...current, [record.id]: false }));
  };

  const save = (recordId: string, entryId: string) => {
    const key = rowKey(recordId, entryId);
    const draft = drafts[key];
    if (!draft || props.readOnly) return;
    const contact = contactsById.get(draft.entry.followPersonId);
    const saved = {
      ...draft.entry,
      followPersonName: contact?.name || draft.entry.followPersonName || "",
      updatedAt: new Date().toISOString()
    };
    props.onUpsertFollowUp(recordId, saved);
    setDrafts(current => current[key]
      ? { ...current, [key]: { recordId, entry: saved, dirty: false } }
      : current);
  };

  const addForRecord = (record: RecordRow) => {
    if (props.readOnly) return;
    const assignedIds = Array.from(new Set([
      ...(record.moduleData?.__followUpContactIds || "").split(","),
      record.followUpContactId || "",
      record.primaryContactId || ""
    ].map(id => id.trim()).filter(Boolean)));
    const existingPersonIds = new Set((record.followUpEntries || []).map(entry => entry.followPersonId).filter(Boolean));
    // When a record has several assigned people, suggest the next person who
    // does not already have an individual follow-up row instead of always
    // defaulting every additional row to the first contact.
    const suggestedContactId = assignedIds.find(id => !existingPersonIds.has(id)) || "";
    const suggestedContact = suggestedContactId
      ? contactsById.get(suggestedContactId)
      : !assignedIds.length && !existingPersonIds.size
        ? props.contacts.find(contact => record.contact && contact.name.trim().toLocaleLowerCase() === record.contact.trim().toLocaleLowerCase())
        : undefined;
    const entry = newEntry(suggestedContact);
    props.onUpsertFollowUp(record.id, entry);
    setDrafts(current => ({ ...current, [rowKey(record.id, entry.id)]: { recordId: record.id, entry, dirty: false } }));
  };

  const remove = (recordId: string, entryId: string) => {
    if (props.readOnly) return;
    const record = props.records.find(item => item.id === recordId);
    if (!record?.followUpEntries?.some(entry => entry.id === entryId)) return;
    if (!window.confirm("Delete this follow-up entry? Other follow-ups for this record will remain.")) return;
    props.onRemoveFollowUp(recordId, entryId);
    setDrafts(current => {
      const next = { ...current };
      delete next[rowKey(recordId, entryId)];
      return next;
    });
  };

  const downloadTable = async () => {
    Object.values(drafts).filter(row => row.dirty).forEach(row => save(row.recordId, row.entry.id));
    for (const record of visibleRecords) if (dirtyTitleIds[record.id]) saveRecordTitle(record);
    const exportRecords = visibleRecords.map(record => ({ ...record, title: titleDrafts[record.id] ?? record.title, followUpEntries: entriesForRecord(record.id) }));
    const csv = buildRecordFollowUpCsv(exportRecords, props.contacts);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const filename = "AXIVESTRA-Follow-up-Tracker-" + new Date().toISOString().slice(0, 10) + ".csv";
    try {
      const delivery = await saveBlobForUser(blob, filename);
      props.onDownloadStatus(delivery === "shared"
        ? "Android share panel opened. Choose Files, Drive or another secure destination to save the CSV."
        : "CSV download started.");
    } catch (error) {
      props.onDownloadStatus("CSV export failed: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const toggleModule = (module: string, checked: boolean) => {
    setSelectedModules(current => checked
      ? [...new Set([...current, module])]
      : current.filter(value => value !== module));
  };

  return <section className="data-panel ax-record-followups">
    <header className="ax-record-followups__header">
      <div>
        <span className="section-kicker">RECORD-WISE FOLLOW-UP HISTORY</span>
        <h2>Record Follow-up Tracker</h2>
        <p>Each property or module record can have unlimited separate follow-up entries. Every follow person is linked to a saved Contact 360 contact.</p>
      </div>
      <div className="ax-record-followups__actions">
        <button type="button" className="secondary-button" onClick={downloadTable} disabled={!visibleEntryCount}><Download size={14}/> Download table (CSV)</button>
      </div>
    </header>

    <div className="ax-record-followups__metrics">
      <div><span>Records shown</span><strong>{visibleRecords.length}</strong></div>
      <div><span>Follow-up entries</span><strong>{visibleEntryCount}</strong></div>
      <div><span>Overdue next follow-ups</span><strong>{overdueCount}</strong></div>
    </div>

    <div className="ax-record-followups__toolbar">
      <label className="ax-record-followups__search"><Search size={15}/><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search record, follow person or remarks…"/></label>
      <details className="ax-record-followups__module-filter">
        <summary>Modules{selectedModules.length ? " · " + selectedModules.length + " selected" : " · Follow-up records"}</summary>
        <div className="ax-record-followups__module-options">
          <div className="ax-record-followups__module-actions">
            <button type="button" onClick={() => setSelectedModules(moduleOptions)}>Select all</button>
            <button type="button" onClick={() => setSelectedModules([])}>Clear</button>
          </div>
          {moduleOptions.map(module => <label key={module}>
            <input type="checkbox" checked={selectedModules.includes(module)} onChange={event => toggleModule(module, event.target.checked)}/>
            <span>{module}</span><small>{moduleCounts.get(module) || 0}</small>
          </label>)}
        </div>
      </details>
      <label className="ax-record-followups__empty-toggle"><input type="checkbox" checked={showRecordsWithoutFollowUps} onChange={event => setShowRecordsWithoutFollowUps(event.target.checked)} disabled={selectedModules.length > 0}/> <span>Show records without follow-ups</span></label>
      <span className="ax-record-followups__hint">Edits save when you leave a field or press Save.</span>
    </div>

    <div className="ax-record-followups__table-wrap">
      <table className="ax-record-followups__table">
        <thead><tr>
          <th>Record name</th><th>Follow person</th><th>Follow-up date</th><th>Follow-up time</th>
          <th>Remarks</th><th>Next follow-up date</th><th>Next follow-up time</th><th>Actions</th>
        </tr></thead>
        <tbody>
          {visibleRecords.flatMap(record => {
            const entries = entriesForRecord(record.id);
            if (!entries.length) return [<tr className="ax-record-followups__empty-row" key={record.id + "::empty"}>
              <td><input aria-label="Record name" type="text" className="ax-record-followups__name-input" value={titleDrafts[record.id] ?? record.title ?? ""} disabled={props.readOnly} onChange={event => patchRecordTitle(record.id, event.target.value)} onBlur={() => saveRecordTitle(record)}/><small>{record.module}</small><button type="button" className="ax-record-followups__open" onClick={() => props.onOpenRecord(record)}><ExternalLink size={11}/> Open record</button></td>
              <td colSpan={6}>No follow-up entries recorded for this data.</td>
              <td><button type="button" className="secondary-button" disabled={props.readOnly} onClick={() => addForRecord(record)}><Plus size={13}/> Add first follow-up</button></td>
            </tr>];
            return entries.map((entry, index) => {
              const key = rowKey(record.id, entry.id);
              const draft = drafts[key] || { recordId: record.id, entry, dirty: false };
              const contact = contactsById.get(draft.entry.followPersonId);
              return <tr key={key}>
                <td className="ax-record-followups__record-cell">
                  <input aria-label="Record name" type="text" className="ax-record-followups__name-input" value={titleDrafts[record.id] ?? record.title ?? ""} disabled={props.readOnly} onChange={event => patchRecordTitle(record.id, event.target.value)} onBlur={() => saveRecordTitle(record)}/><small>{record.module}</small>
                  <button type="button" className="ax-record-followups__open" onClick={() => props.onOpenRecord(record)}><ExternalLink size={11}/> Open record</button>
                  {index === 0 && <button type="button" className="ax-record-followups__add-another" disabled={props.readOnly} onClick={() => addForRecord(record)}><Plus size={12}/> Add another follow-up</button>}
                </td>
                <td>
                  <SearchableContactPicker
                    label={"Follow person for " + record.title}
                    contacts={props.contacts}
                    groups={props.groups}
                    value={draft.entry.followPersonId}
                    placeholder="Search person, Dr name, role, phone or group…"
                    help="Search includes saved contact names and linked WhatsApp group names."
                    onChange={value=>{
                      const id=String(value);
                      const person=contactsById.get(id);
                      const updated={...draft.entry,followPersonId:id,followPersonName:person?.name||draft.entry.followPersonName,updatedAt:new Date().toISOString()};
                      props.onUpsertFollowUp(record.id,updated);
                      setDrafts(current=>current[key]?{...current,[key]:{recordId:record.id,entry:updated,dirty:false}}:current);
                    }}
                  />
                  {contact && <button type="button" className="ax-record-followups__contact-link" onClick={() => props.onOpenContact(contact.id)}><Users size={11}/> Open contact</button>}
                </td>
                <td><input aria-label="Follow-up date" type="date" value={draft.entry.followDate} disabled={props.readOnly} onChange={event => patch(record.id, entry.id, "followDate", event.target.value)} onBlur={() => save(record.id, entry.id)}/></td>
                <td><input aria-label="Follow-up time" type="time" value={draft.entry.followTime} disabled={props.readOnly} onChange={event => patch(record.id, entry.id, "followTime", event.target.value)} onBlur={() => save(record.id, entry.id)}/></td>
                <td><textarea aria-label="Follow-up remarks" rows={2} value={draft.entry.remarks} disabled={props.readOnly} onChange={event => patch(record.id, entry.id, "remarks", event.target.value)} onBlur={() => save(record.id, entry.id)} placeholder="What happened / what was discussed…"/></td>
                <td><input aria-label="Next follow-up date" type="date" value={draft.entry.nextFollowUpDate} disabled={props.readOnly} onChange={event => patch(record.id, entry.id, "nextFollowUpDate", event.target.value)} onBlur={() => save(record.id, entry.id)}/></td>
                <td><input aria-label="Next follow-up time" type="time" value={draft.entry.nextFollowUpTime} disabled={props.readOnly} onChange={event => patch(record.id, entry.id, "nextFollowUpTime", event.target.value)} onBlur={() => save(record.id, entry.id)}/></td>
                <td className="ax-record-followups__row-actions">
                  <button type="button" className="secondary-button" disabled={props.readOnly || !draft.dirty} onClick={() => save(record.id, entry.id)}>Save</button>
                  <button type="button" className="secondary-button" disabled={props.readOnly} onClick={() => remove(record.id, entry.id)} title="Delete only this follow-up"><Trash2 size={13}/></button>
                </td>
              </tr>;
            });
          })}
        </tbody>
      </table>
    </div>
    {!visibleRecords.length && <div className="ax-record-followups__empty">
      <ClipboardList size={28}/><strong>No matching follow-up records</strong>
      <p>Select one or more modules to see all their records, or clear the search to show existing follow-up entries across modules.</p>
    </div>}
    <p className="ax-record-followups__footnote">Every follow-up is saved under its own module record. Adding another entry never replaces the previous one. The follow person is stored by contact ID, so changes to that contact remain linked across Contact 360, local storage, company cloud sync and PC ↔ mobile sync.</p>
  </section>;
}
