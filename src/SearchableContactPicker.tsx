import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Search, Users, X } from "lucide-react";

export type SearchableContact = {
  id: string;
  name: string;
  phone?: string;
  role?: string;
  roles?: string[];
  customRoles?: string;
  email?: string;
  address?: string;
  profession?: string;
  employer?: string;
  designation?: string;
  businessType?: string;
  associatedCompany?: string;
  whatsappName?: string;
  verifiedName?: string;
  notify?: string;
  whatsappJid?: string;
  whatsappGroupIds?: string[];
  notes?: string;
};
export type SearchableContactGroup = { id: string; name: string; jid?: string; subject?: string; description?: string };

type Props = {
  label: string;
  contacts: SearchableContact[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  help?: string;
  groups?: SearchableContactGroup[];
  onSelectGroup?: (groupId: string, memberIds: string[]) => void;
};

const normalize = (value: unknown) => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/[\s\u00a0]+/g, " ").trim();
const normalizePhone = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const phoneMatches = (phone: string, query: string) => {
  const digits = normalizePhone(phone);
  const term = normalizePhone(query);
  if (term.length < 4 || !digits) return false;
  const localDigits = digits.length > 10 && digits.startsWith("91") ? digits.slice(2) : digits;
  const localTerm = term.length > 10 && term.startsWith("91") ? term.slice(2) : term;
  return digits.includes(term) || localDigits.includes(localTerm) || digits.endsWith(term) || localDigits.endsWith(localTerm);
};

export default function SearchableContactPicker({
  label, contacts, value, onChange, multiple = false, placeholder, help, groups = [], onSelectGroup
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedIds = useMemo(() => Array.from(new Set(
    Array.isArray(value) ? value.filter(Boolean) : value ? [value] : []
  )), [value]);

  const groupById = useMemo(() => {
    const index = new Map<string, SearchableContactGroup>();
    groups.forEach(group => {
      [group.id, group.jid, group.name].filter(Boolean).forEach(alias => index.set(normalize(alias), group));
    });
    return index;
  }, [groups]);
  const contactsById = useMemo(() => new Map(contacts.map(contact => [contact.id, contact])), [contacts]);
  const indexedContacts = useMemo(() => contacts.map(contact => {
    const linkedGroups = (contact.whatsappGroupIds || []).map(id => groupById.get(normalize(id))).filter((group): group is SearchableContactGroup => Boolean(group));
    const groupNames = linkedGroups.map(group => group.name);
    const roles = Array.from(new Set([
      ...(contact.roles || []), contact.role,
      ...(contact.customRoles || "").split(",").map(role => role.trim())
    ].filter(Boolean)));
    const phoneDigits = normalizePhone(contact.phone);
    const searchText = normalize([
      contact.name, contact.whatsappName, contact.verifiedName, contact.notify,
      contact.phone, phoneDigits, ...roles, contact.email,
      contact.address, contact.profession, contact.employer, contact.designation,
      contact.businessType, contact.associatedCompany, contact.whatsappJid, contact.notes,
      ...groupNames
    ].filter(Boolean).join(" "));
    return { contact, roles, groupNames, searchText, phoneDigits };
  }).sort((a, b) => a.contact.name.localeCompare(b.contact.name)), [contacts, groupById]);

  // Build the group-to-contact index in one pass. This avoids scanning the full
  // contact directory once per group when the workspace has large WhatsApp lists.
  const contactsByGroup = useMemo(() => {
    const result = new Map<string, typeof indexedContacts>();
    indexedContacts.forEach(item => (item.contact.whatsappGroupIds || []).forEach(groupAlias => {
      const group = groupById.get(normalize(groupAlias));
      if (!group) return;
      const members = result.get(group.id) || [];
      if (!members.some(existing => existing.contact.id === item.contact.id)) members.push(item);
      result.set(group.id, members);
    }));
    return result;
  }, [indexedContacts, groupById]);
  const indexedGroups = useMemo(() => groups.map(group => ({
    group,
    searchText: normalize([group.name, group.subject, group.description, group.jid].filter(Boolean).join(" ")),
    memberCount: contactsByGroup.get(group.id)?.length || 0
  })).sort((a, b) => a.group.name.localeCompare(b.group.name)), [groups, contactsByGroup]);

  const deferredQuery = useDeferredValue(query);
  const terms = useMemo(() => normalize(deferredQuery).split(/\s+/).filter(Boolean), [deferredQuery]);
  const matchingGroups = useMemo(() => terms.length
    ? indexedGroups.filter(item => terms.every(term => item.searchText.includes(term))).slice(0, 20)
    : [], [indexedGroups, terms]);
  const matching = useMemo(() => {
    const source = activeGroupId ? (contactsByGroup.get(activeGroupId) || []) : indexedContacts;
    return terms.length
      ? source.filter(item => terms.every(term => item.searchText.includes(term) || item.searchText.split(" ").some(token => token.startsWith(term))) || phoneMatches(item.contact.phone || "", deferredQuery))
      : source;
  }, [indexedContacts, contactsByGroup, activeGroupId, terms]);
  const visible = matching.slice(0, 40);
  const selected = selectedIds.map(id => contactsById.get(id)).filter((item): item is SearchableContact => Boolean(item));

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current && !rootRef.current.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  }, [open]);

  useEffect(() => {
    if (activeIndex >= visible.length) setActiveIndex(0);
  }, [activeIndex, visible.length]);

  const rolesFor = (contact: SearchableContact) => Array.from(new Set([
    ...(contact.roles || []), contact.role,
    ...(contact.customRoles || "").split(",").map(role => role.trim())
  ].filter(Boolean))).join(", ");

  const selectSingle = (id: string) => {
    onChange(id);
    setQuery("");
    setActiveGroupId(null);
    setOpen(false);
    setActiveIndex(0);
  };
  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(item => item !== id)
      : [...selectedIds, id];
    onChange(next);
    setQuery("");
    setActiveGroupId(null);
    setOpen(true);
    setActiveIndex(0);
    inputRef.current?.focus();
  };
  const selectGroup = (groupId: string) => {
    const group = groupById.get(groupId);
    if (!group) return;
    const members = contactsByGroup.get(groupId) || [];
    onSelectGroup?.(groupId, members.map(item => item.contact.id));
    // A group is not fabricated into a person/contact ID. Instead, show its
    // linked master contacts so the user can choose the actual follow-up people.
    setActiveGroupId(groupId);
    setQuery(group.name);
    setOpen(true);
    setActiveIndex(0);
    inputRef.current?.focus();
  };
  const remove = (id: string) => {
    const next = selectedIds.filter(item => item !== id);
    onChange(multiple ? next : "");
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
      setActiveGroupId(null);
      return;
    }
    if (event.key === "ArrowDown" && visible.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(index => (index + 1) % visible.length);
      return;
    }
    if (event.key === "ArrowUp" && visible.length) {
      event.preventDefault();
      setActiveIndex(index => (index - 1 + visible.length) % visible.length);
      return;
    }
    if (event.key === "Enter" && visible[activeIndex]) {
      event.preventDefault();
      if (multiple) toggle(visible[activeIndex].contact.id);
      else selectSingle(visible[activeIndex].contact.id);
    }
  };

  return <div ref={rootRef} className={"searchable-contact-picker" + (multiple ? " searchable-contact-picker--multiple" : "") + (open ? " searchable-contact-picker--open" : "")}>
    <span className="searchable-contact-picker__label">{label}</span>
    {selected.length > 0 && <div className="searchable-contact-picker__selected">
      {selected.map(contact => <span className="searchable-contact-picker__chip" key={contact.id}>
        <span><strong>{contact.name}</strong><small>{rolesFor(contact) || "Contact"}{contact.phone ? " · " + contact.phone : ""}</small></span>
        <button type="button" onClick={() => remove(contact.id)} aria-label={"Remove " + contact.name + " from " + label}><X size={12}/></button>
      </span>)}
    </div>}
    <div className="searchable-contact-picker__search">
      <Search size={15}/>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={event => { setQuery(event.target.value); setActiveGroupId(null); setOpen(true); setActiveIndex(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Type a name, role, phone or group…"}
        aria-label={"Type to search contacts for " + label}
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {query && <button type="button" className="searchable-contact-picker__clear" onClick={() => { setQuery(""); setActiveGroupId(null); setOpen(true); inputRef.current?.focus(); }} aria-label={"Clear search for " + label}>×</button>}
    </div>
    {open && <div className="searchable-contact-picker__options" role="listbox" aria-label={label + " search results"} aria-multiselectable={multiple}>
      {matchingGroups.length > 0 && <div className="searchable-contact-picker__group-results">
        <small className="searchable-contact-picker__section-label">WhatsApp groups</small>
        {matchingGroups.map(item => <button
          type="button"
          role="option"
          aria-selected={activeGroupId === item.group.id}
          className={"searchable-contact-picker__group-option" + (activeGroupId === item.group.id ? " selected" : "")}
          key={item.group.id}
          onClick={() => selectGroup(item.group.id)}
        >
          <span className="searchable-contact-picker__group-icon"><Users size={14}/></span>
          <span><strong>{item.group.name}</strong><small>{item.memberCount} saved contact{item.memberCount === 1 ? "" : "s"} linked · select to view people in this group</small></span>
          <span className="searchable-contact-picker__group-action">View</span>
        </button>)}
      </div>}
      {visible.length === 0
        ? <p className="searchable-contact-picker__empty">{activeGroupId
          ? "This WhatsApp group has no saved master contacts linked yet. Link people to the group in Contact 360, then search the group again."
          : matchingGroups.length
            ? "Select a WhatsApp group above to see the saved contacts linked to it."
            : "No saved contacts match this name, role, phone or group. Add the person in Contacts or check the group link."}</p>
        : <>
          {activeGroupId && <small className="searchable-contact-picker__section-label">People linked to {groupById.get(activeGroupId)?.name || "this group"}</small>}
          {visible.map((item, index) => {
            const contact = item.contact;
            const isSelected = selectedIds.includes(contact.id);
            return <button
              type="button"
              role="option"
              aria-selected={isSelected}
              className={"searchable-contact-picker__option" + (isSelected ? " selected" : "") + (activeIndex === index ? " active" : "")}
              key={contact.id}
              onClick={() => multiple ? toggle(contact.id) : selectSingle(contact.id)}
            >
              <span className="searchable-contact-picker__option-mark">{isSelected ? <CheckCircle2 size={15}/> : <span/>}</span>
              <span>
                <strong>{contact.name}</strong>
                <small>{contact.whatsappName && contact.whatsappName !== contact.name ? "WhatsApp: " + contact.whatsappName + " · " : contact.verifiedName ? "Verified: " + contact.verifiedName + " · " : ""}{item.roles.join(", ") || "Contact"}{contact.phone ? " · " + contact.phone : ""}{contact.email ? " · " + contact.email : ""}</small>
                {item.groupNames.length > 0 && <small className="searchable-contact-picker__groups">Groups: {item.groupNames.join(", ")}</small>}
              </span>
            </button>;
          })}
        </>}
      <small className="searchable-contact-picker__count">{visible.length} contacts shown · {matching.length} matching contacts{matching.length > 40 ? " · refine your search" : ""}{groups.length ? " · group names searchable" : ""}</small>
      <button type="button" className="searchable-contact-picker__close" onClick={() => setOpen(false)}>Close results</button>
    </div>}
    {multiple && <small className="searchable-contact-picker__count">{selectedIds.length} selected · search and select more people</small>}
    {help && <small className="searchable-contact-picker__help">{help}</small>}
  </div>;
}
