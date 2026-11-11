import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import type { CustomModuleDefinition, CustomModuleFieldDefinition, CustomModuleFieldType } from "./lib/custom-modules";

type Props = {
  initial?: CustomModuleDefinition | null;
  reservedNames: string[];
  onSave: (module: CustomModuleDefinition) => void;
  onCancel: () => void;
};

const makeField = (): CustomModuleFieldDefinition => ({
  key: "custom_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7),
  label: "",
  placeholder: "",
  type: "text",
  options: [],
  required: false
});

export default function CustomModuleBuilder({ initial, reservedNames, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [group, setGroup] = useState(initial?.group || "Custom Modules");
  const [fields, setFields] = useState<CustomModuleFieldDefinition[]>(() => (initial?.fields || []).map(field => ({
    ...field,
    type: field.type || "text",
    options: Array.isArray(field.options) ? field.options : []
  })));
  const [error, setError] = useState("");

  const normalizedName = name.trim().replace(/\s+/g, " ");
  const duplicateName = useMemo(
    () => reservedNames.some(item => item.trim().toLocaleLowerCase() === normalizedName.toLocaleLowerCase()),
    [reservedNames, normalizedName]
  );

  const updateField = (key: string, patch: Partial<CustomModuleFieldDefinition>) => {
    setFields(current => current.map(field => field.key === key ? { ...field, ...patch } : field));
    setError("");
  };

  const moveField = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    setFields(current => {
      const next = [...current];
      const [field] = next.splice(index, 1);
      next.splice(target, 0, field);
      return next;
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = normalizedName.slice(0, 60);
    if (!cleanName) { setError("Enter a workspace name."); return; }
    if (duplicateName) { setError("A workspace with that name already exists. Choose a different name."); return; }

    const cleanFields = fields.map(field => ({
      ...field,
      label: field.label.trim().slice(0, 80),
      placeholder: (field.placeholder || "").trim().slice(0, 140),
      options: field.type === "select"
        ? Array.from(new Set((field.options || []).map(option => option.trim()).filter(Boolean))).slice(0, 50)
        : []
    }));
    if (cleanFields.some(field => !field.label)) { setError("Give every custom field a label or remove the empty field."); return; }
    const duplicateLabels = cleanFields.map(field => field.label.toLocaleLowerCase()).filter((label, index, list) => list.indexOf(label) !== index);
    if (duplicateLabels.length) { setError("Custom field labels must be unique within this workspace."); return; }
    if (cleanFields.some(field => field.type === "select" && !field.options?.length)) { setError("Add at least one option to each dropdown field."); return; }

    onSave({
      id: initial?.id || "custom-module-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      name: cleanName,
      description: description.trim().slice(0, 180) || "Custom workspace for your records, contacts and follow-ups.",
      group: group.trim().slice(0, 50) || "Custom Modules",
      color: initial?.color || "violet",
      fields: cleanFields
    });
  };

  return <div className="ax-custom-module-builder">
    <form onSubmit={submit}>
      <div className="ax-custom-builder-intro">
        <span className="section-kicker">WORKSPACE CONFIGURATION</span>
        <h3>{initial ? "Edit custom workspace" : "Create a custom workspace"}</h3>
        <p>Define the information this workspace needs. Each record will also support linked properties, contacts, follow-ups, tasks, documents, transactions, risks and approvals.</p>
      </div>
      <div className="form-two">
        <label>Workspace name *<input autoFocus required maxLength={60} value={name} onChange={event => { setName(event.target.value); setError(""); }} placeholder="e.g. Vendor Contracts"/></label>
        <label>Workspace group<input maxLength={50} value={group} onChange={event => setGroup(event.target.value)} placeholder="Custom Modules"/></label>
      </div>
      <label>Description<textarea rows={2} maxLength={180} value={description} onChange={event => setDescription(event.target.value)} placeholder="What will this workspace manage?"/></label>

      <div className="ax-custom-builder-fields-head">
        <div><strong>Custom record fields</strong><small>Add the fields that every record in this workspace should capture.</small></div>
        <button type="button" className="secondary-button" onClick={() => setFields(current => [...current, makeField()])}><Plus size={14}/> Add field</button>
      </div>
      {fields.length === 0 && <div className="ax-custom-builder-empty">No custom fields yet. Add the first field; core record details and relationship links are already included.</div>}
      <div className="ax-custom-builder-fields">
        {fields.map((field, index) => <article className="ax-custom-builder-field" key={field.key}>
          <div className="ax-custom-builder-field-top"><strong>Field {index + 1}</strong><div>
            <button type="button" className="ax-builder-icon-button" disabled={index === 0} onClick={() => moveField(index, -1)} aria-label="Move field up"><ArrowUp size={14}/></button>
            <button type="button" className="ax-builder-icon-button" disabled={index === fields.length - 1} onClick={() => moveField(index, 1)} aria-label="Move field down"><ArrowDown size={14}/></button>
            <button type="button" className="ax-builder-icon-button danger" onClick={() => setFields(current => current.filter(item => item.key !== field.key))} aria-label="Remove field"><Trash2 size={14}/></button>
          </div></div>
          <div className="form-two">
            <label>Field label *<input required maxLength={80} value={field.label} onChange={event => updateField(field.key, { label: event.target.value })} placeholder="e.g. Contract reference"/></label>
            <label>Field type<select value={field.type || "text"} onChange={event => updateField(field.key, { type: event.target.value as CustomModuleFieldType, options: [] })}>
              <option value="text">Short text</option>
              <option value="textarea">Long text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Dropdown list</option>
              <option value="contact">Link one contact</option>
              <option value="contacts">Link multiple contacts</option>
            </select></label>
          </div>
          <label>Placeholder / help text<input maxLength={140} value={field.placeholder || ""} onChange={event => updateField(field.key, { placeholder: event.target.value })} placeholder="What should the user enter?"/></label>
          {field.type === "select" && <label>Dropdown options * (one per line)<textarea rows={3} value={(field.options || []).join("\n")} onChange={event => updateField(field.key, { options: event.target.value.split("\n").map(option => option.trim()).filter(Boolean) })} placeholder={"Draft\nUnder review\nApproved"}/></label>}
          <label className="ax-custom-builder-required"><input type="checkbox" checked={Boolean(field.required)} onChange={event => updateField(field.key, { required: event.target.checked })}/> Required when saving a record</label>
        </article>)}
      </div>
      {error && <p className="ax-custom-builder-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}><X size={14}/> Cancel</button><button type="submit" className="primary-button">{initial ? "Save workspace changes" : "Create workspace"}</button></div>
    </form>
  </div>;
}
