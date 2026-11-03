import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Search, X } from "lucide-react";

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
  whatsappJid?: string;
  whatsappGroupIds?: string[];
};
export type SearchableContactGroup = { id: string; name: string; jid?: string };

type Props = {
  label: string;
  contacts: SearchableContact[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  help?: string;
  groups?: SearchableContactGroup[];
};

const normalize = (value: unknown) => String(value ?? "").normalize("NFKC").toLocaleLowerCase().trim();

export default function SearchableContactPicker({
  label, contacts, value, onChange, multiple = false, placeholder, help, groups = []
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedIds = useMemo(() => Array.from(new Set(
    Array.isArray(value) ? value.filter(Boolean) : value ? [value] : []
  )), [value]);

  const groupById = useMemo(() => new Map(groups.map(group => [group.id, group])), [groups]);
  const contactsById = useMemo(() => new Map(contacts.map(contact => [contact.id, contact])), [contacts]);
  const indexedContacts = useMemo(() => contacts.map(contact => {
    const groupNames = (contact.whatsappGroupIds || [])
      .map(id => groupById.get(id)?.name || "")
      .filter(Boolean);
    const roles = Array.from(new Set([
      ...(contact.roles || []), contact.role,
      ...(contact.customRoles || "").split(",").map(role => role.trim())
    ].filter(Boolean)));
    const searchText = normalize([
      contact.name, contact.whatsappName, contact.phone, ...roles, contact.email,
      contact.address, contact.profession, contact.employer, contact.designation,
      contact.businessType, contact.associatedCompany, contact.whatsappJid,
      ...groupNames
    ].filter(Boolean).join(" "));
    return { contact, roles, groupNames, searchText };
  }).sort((a, b) => a.contact.name.localeCompare(b.contact.name)), [contacts, groupById]);

  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const matching = useMemo(() => terms.length
    ? indexedContacts.filter(item => terms.every(term => item.searchText.includes(term)))
    : indexedContacts, [indexedContacts, query]);
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

  const rolesFor = (contact: SearchableContact) => Array.from(new Set([
    ...(contact.roles || []), contact.role,
    ...(contact.customRoles || "").split(",").map(role => role.trim())
  ].filter(Boolean))).join(", ");

  const selectSingle = (id: string) => {
    onChange(id);
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
  };
  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(item => item !== id)
      : [...selectedIds, id];
    onChange(next);
    setQuery("");
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

  return <div ref={rootRef} className={"searchable-contact-picker" + (multiple ? " searchable-contact-picker--multiple" : "")}>
    <span className="searchable-contact-picker__label">{label}</span>
    {selected.length > 0 && <div className="searchable-contact-picker__selected">
      {selected.map(contact => <span className="searchable-contact-picker__chip" key={contact.id}>
        <span><strong>{contact.name}</strong><small>{rolesFor(contact) || "Contact"}{contact.phone ? " · " + contact.phone : ""}</small></span>
        <button type="button" onPointerDown={event => event.preventDefault()} onClick={() => remove(contact.id)} aria-label={"Remove " + contact.name + " from " + label}><X size={12}/></button>
      </span>)}
    </div>}
    <div className="searchable-contact-picker__search">
      <Search size={15}/>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={event => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Type a name, role, phone or group…"}
        aria-label={"Type to search contacts for " + label}
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {query && <button type="button" className="searchable-contact-picker__clear" onPointerDown={event => event.preventDefault()} onClick={() => { setQuery(""); setOpen(true); inputRef.current?.focus(); }} aria-label={"Clear search for " + label}>×</button>}
    </div>
    {open && <div className="searchable-contact-picker__options" role="listbox" aria-label={label + " search results"} aria-multiselectable={multiple}>
      {visible.length === 0
        ? <p className="searchable-contact-picker__empty">No saved contacts match this name, role, phone or group. Add the person in Contacts or check the group link.</p>
        : visible.map((item, index) => {
          const contact = item.contact;
          const isSelected = selectedIds.includes(contact.id);
          return <button
            type="button"
            role="option"
            aria-selected={isSelected}
            className={"searchable-contact-picker__option" + (isSelected ? " selected" : "") + (activeIndex === index ? " active" : "")}
            key={contact.id}
            onPointerDown={event => event.preventDefault()}
            onClick={() => multiple ? toggle(contact.id) : selectSingle(contact.id)}
          >
            <span className="searchable-contact-picker__option-mark">{isSelected ? <CheckCircle2 size={15}/> : <span/>}</span>
            <span>
              <strong>{contact.name}</strong>
              <small>{contact.whatsappName && contact.whatsappName !== contact.name ? "WhatsApp: " + contact.whatsappName + " · " : ""}{item.roles.join(", ") || "Contact"}{contact.phone ? " · " + contact.phone : ""}{contact.email ? " · " + contact.email : ""}</small>
              {item.groupNames.length > 0 && <small className="searchable-contact-picker__groups">Groups: {item.groupNames.join(", ")}</small>}
            </span>
          </button>;
        })}
      <small className="searchable-contact-picker__count">{visible.length} shown · {matching.length} matching contacts{matching.length > 40 ? " · refine your search" : ""}{groups.length ? " · group names included" : ""}</small>
      <button type="button" className="searchable-contact-picker__close" onPointerDown={event => event.preventDefault()} onClick={() => setOpen(false)}>Close results</button>
    </div>}
    {multiple && <small className="searchable-contact-picker__count">{selectedIds.length} selected · search and select more people</small>}
    {help && <small className="searchable-contact-picker__help">{help}</small>}
  </div>;
}
