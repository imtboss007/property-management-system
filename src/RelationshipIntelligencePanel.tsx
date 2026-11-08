import { useMemo, useState } from "react";
import { ArrowUpRight, Search, Users, Link2, AlertTriangle, Unlink2 } from "lucide-react";
import { buildRelationshipIntelligence } from "./lib/relationship-intelligence.mjs";

type Contact = { id: string; name: string; role?: string; roles?: string[]; customRoles?: string };
type WorkspaceRecord = { id: string; title: string; module: string; primaryContactId?: string; moduleData?: Record<string, string> };
type Task = { id: string; title: string; contactId?: string; followUpContactIds?: string[] };
type Financial = { id: string; reference?: string; type?: string; contactId?: string };
type Risk = { id: string; title: string; contactId?: string };
type Approval = { id: string; title: string; contactId?: string };
type Document = { id: string; name: string; contactId?: string };

type Props = {
  contacts: Contact[];
  properties: WorkspaceRecord[];
  tasks: Task[];
  financials: Financial[];
  risks: Risk[];
  approvals: Approval[];
  documents: Document[];
  onOpenWorkspace: (name: string) => void;
};

export default function RelationshipIntelligencePanel(props: Props) {
  const [query, setQuery] = useState("");
  const result = useMemo(() => buildRelationshipIntelligence(props), [
    props.contacts, props.properties, props.tasks, props.financials,
    props.risks, props.approvals, props.documents
  ]);
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    if (!search) return result.contacts;
    return result.contacts.filter(person =>
      [person.name, person.role, ...person.roles, ...person.workspaces,
        ...person.records.flatMap(record => [record.title, record.workspace, ...record.relations])]
        .join(" ").toLocaleLowerCase().includes(search)
    );
  }, [query, result]);

  return (
    <section className="data-panel ax-relationship-intelligence" aria-label="Cross-workspace relationship intelligence">
      <div className="section-heading">
        <div>
          <span className="section-kicker">CROSS-WORKSPACE RELATIONSHIP GRAPH</span>
          <h2>Who is connected to what?</h2>
          <p>Resolved from saved contact IDs across workspaces and operating records. Same-name contacts remain separate.</p>
        </div>
        <label className="search-box ax-relationship-search">
          <Search size={15} />
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search people, roles or records…" aria-label="Search relationship intelligence" />
        </label>
      </div>
      <div className="ax-relationship-metrics">
        <article><Users size={17}/><strong>{result.linkedContacts}</strong><span>Linked contacts</span></article>
        <article><Link2 size={17}/><strong>{result.linkedRecords}</strong><span>Linked source records</span></article>
        <article><Unlink2 size={17}/><strong>{result.unlinkedContacts}</strong><span>Contacts without ID links</span></article>
        <article><AlertTriangle size={17}/><strong>{result.unresolvedReferences}</strong><span>Unresolved contact IDs</span></article>
      </div>
      <div className="ax-relationship-list">
        {filtered.map(person => (
          <details className="ax-relationship-person" key={person.id}>
            <summary>
              <span className="ax-relationship-avatar"><Users size={16}/></span>
              <span className="ax-relationship-person-main">
                <strong>{person.name}</strong>
                <small>{[...person.roles].join(" · ") || "Role not specified"} · ID {person.id}</small>
              </span>
              <span className="ax-relationship-person-count">{person.recordCount} linked</span>
            </summary>
            {person.records.length ? (
              <div className="ax-relationship-records">
                {person.records.map(record => (
                  <article key={record.key}>
                    <div>
                      <strong>{record.title}</strong>
                      <small>{record.workspace || record.kind} · {record.relations.join(" · ")}</small>
                      <small>Source ID: {record.recordId}</small>
                    </div>
                    {record.workspace && <button type="button" className="text-button" onClick={() => props.onOpenWorkspace(record.workspace)}>
                      Open workspace <ArrowUpRight size={14}/>
                    </button>}
                  </article>
                ))}
              </div>
            ) : <p className="ax-relationship-unlinked">No explicit record links are saved for this contact yet.</p>}
          </details>
        ))}
        {filtered.length === 0 && <p className="ax-relationship-unlinked">No contacts match this search.</p>}
      </div>
      <p className="ax-relationship-footnote">Evidence boundary: this view only reports explicit saved IDs. It does not infer relationships from matching names or text, and it does not yet represent a complete person–organisation–deal graph.</p>
    </section>
  );
}
