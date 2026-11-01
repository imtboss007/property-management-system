import { useMemo, useState } from "react";
import {
  Activity, Banknote, BriefcaseBusiness, Building2, CalendarDays, BarChart3,
  Check, CircleDollarSign, ClipboardCheck, FileText, FlaskConical,
  Handshake, House, Landmark, Layers3, Plus, Scale, ShieldCheck, Trash2,
  Users, Wallet, Wheat, X, type LucideIcon
} from "lucide-react";
import type { CustomModuleDefinition, CustomModuleField, CustomModuleFieldType } from "./lib/custom-modules";
import { customModuleFieldKey, validateCustomModule } from "./lib/custom-modules";

const ICONS: Array<{ id: string; label: string; Icon: LucideIcon }> = [
  { id: "Building2", label: "Building", Icon: Building2 }, { id: "Landmark", label: "Institution", Icon: Landmark },
  { id: "Wallet", label: "Wallet", Icon: Wallet }, { id: "Banknote", label: "Finance", Icon: Banknote },
  { id: "BarChart3", label: "Analytics", Icon: BarChart3 }, { id: "BriefcaseBusiness", label: "Business", Icon: BriefcaseBusiness },
  { id: "Scale", label: "Legal", Icon: Scale }, { id: "ShieldCheck", label: "Compliance", Icon: ShieldCheck },
  { id: "Users", label: "People", Icon: Users }, { id: "FileText", label: "Documents", Icon: FileText },
  { id: "Handshake", label: "Partnership", Icon: Handshake }, { id: "CalendarDays", label: "Calendar", Icon: CalendarDays },
  { id: "House", label: "Home", Icon: House }, { id: "Wheat", label: "Agriculture", Icon: Wheat },
  { id: "Layers3", label: "Layers", Icon: Layers3 }, { id: "Activity", label: "Operations", Icon: Activity },
  { id: "ClipboardCheck", label: "Workflow", Icon: ClipboardCheck }, { id: "FlaskConical", label: "Research", Icon: FlaskConical },
  { id: "CircleDollarSign", label: "Capital", Icon: CircleDollarSign }
];
const COLORS = [
  { id: "cyan", label: "Aqua" }, { id: "blue", label: "Electric blue" },
  { id: "violet", label: "Violet" }, { id: "mint", label: "Mint" },
  { id: "amber", label: "Amber" }, { id: "rose", label: "Rose" }, { id: "green", label: "Emerald" }
];
const FIELD_TYPES: Array<{ id: CustomModuleFieldType; label: string }> = [
  { id: "text", label: "Short text" }, { id: "textarea", label: "Long text" },
  { id: "number", label: "Number" }, { id: "currency", label: "Currency (₹)" },
  { id: "percent", label: "Percentage" }, { id: "date", label: "Date" },
  { id: "select", label: "Dropdown" }, { id: "email", label: "Email" },
  { id: "phone", label: "Phone" }, { id: "url", label: "Website / URL" },
  { id: "checkbox", label: "Yes / No" }
];
const DEFAULT_STATUSES = "Lead, Active, Under review, On hold, Completed, Closed";
const makeKey = (label: string, index: number) => customModuleFieldKey(label, index);

type Props = {
  existingNames: string[];
  onSave: (module: CustomModuleDefinition) => void;
  onClose: () => void;
};

export default function CustomModuleStudio({ existingNames, onSave, onClose }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [group, setGroup] = useState("Custom workspace");
  const [icon, setIcon] = useState("Layers3");
  const [color, setColor] = useState("cyan");
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES);
  const [fields, setFields] = useState<CustomModuleField[]>([]);
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState<CustomModuleFieldType>("text");
  const [fieldPlaceholder, setFieldPlaceholder] = useState("");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldOptions, setFieldOptions] = useState("New, In progress, Completed");
  const [error, setError] = useState("");

  const duplicate = useMemo(() => existingNames.some(value => value.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase()), [existingNames, name]);
  const Icon = ICONS.find(item => item.id === icon)?.Icon || Layers3;
  const addField = () => {
    const label = fieldLabel.trim();
    if (!label) { setError("Enter a field label before adding it."); return; }
    if (fields.length >= 40) { setError("A module can contain up to 40 custom fields."); return; }
    const keyBase = makeKey(label, fields.length);
    const key = fields.some(field => field.key === keyBase) ? keyBase + "_" + (fields.length + 1) : keyBase;
    const options = fieldType === "select" ? fieldOptions.split(",").map(value => value.trim()).filter(Boolean) : undefined;
    if (fieldType === "select" && !options?.length) { setError("Enter comma-separated dropdown options."); return; }
    setFields(current => [...current, { key, label, placeholder: fieldPlaceholder.trim(), type: fieldType, options, required: fieldRequired }]);
    setFieldLabel(""); setFieldPlaceholder(""); setFieldRequired(false); setError("");
  };
  const save = () => {
    const now = new Date().toISOString();
    const definition: CustomModuleDefinition = {
      id: "custom-module-" + (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : now.replace(/\D/g, "").slice(0, 17) + Math.random().toString(36).slice(2, 7)),
      name: name.trim().replace(/\s+/g, " "), description: description.trim(), group: group.trim(),
      icon, color, fields, statuses: statuses.split(",").map(value => value.trim()).filter(Boolean),
      createdAt: now, updatedAt: now
    };
    const errors = validateCustomModule(definition, existingNames);
    if (errors.length) { setError(errors[0]); return; }
    onSave(definition);
  };

  return <section className="ax-module-studio">
    <div className="ax-studio-heading">
      <div><span className="ax-kicker">AXIVESTRA · MODULE STUDIO</span><h2>Design a new workspace</h2><p>Create a dedicated business module with its own identity, fields and workflow. It joins the same search, reports and sync system as your existing modules.</p></div>
      <button type="button" className="ax-studio-close" onClick={onClose} aria-label="Close module studio"><X size={18}/></button>
    </div>
    <div className="ax-studio-layout">
      <div className="ax-studio-builder">
        <div className="ax-studio-section"><div className="ax-studio-section-title"><span>01</span><div><strong>Module identity</strong><small>Name, purpose, category and visual identity.</small></div></div>
          <div className="ax-studio-form-grid">
            <label className="ax-studio-full">Module name *<input maxLength={48} value={name} onChange={event=>setName(event.target.value)} placeholder="e.g. Construction Projects" autoFocus/></label>
            <label className="ax-studio-full">Purpose / description<textarea rows={2} value={description} onChange={event=>setDescription(event.target.value)} placeholder="What will this workspace manage?"/></label>
            <label>Category<input value={group} onChange={event=>setGroup(event.target.value)} placeholder="e.g. Operations"/></label>
            <label>Icon<select value={icon} onChange={event=>setIcon(event.target.value)}>{ICONS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label>Accent colour<select value={color} onChange={event=>setColor(event.target.value)}>{COLORS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          </div>
          <div className="ax-studio-preview"><span className={"ax-studio-preview-icon " + color}><Icon size={22}/></span><span><strong>{name.trim() || "Your new module"}</strong><small>{group || "Custom workspace"} · {fields.length} custom fields</small></span><Check size={16}/></div>
          {duplicate && <p className="ax-studio-error">A module with this name already exists.</p>}
        </div>
        <div className="ax-studio-section"><div className="ax-studio-section-title"><span>02</span><div><strong>Build the data form</strong><small>Add the fields you need. Existing module fields remain untouched.</small></div></div>
          <div className="ax-studio-field-builder">
            <label>Field label<input value={fieldLabel} onChange={event=>setFieldLabel(event.target.value)} placeholder="e.g. Project budget"/></label>
            <label>Field type<select value={fieldType} onChange={event=>setFieldType(event.target.value as CustomModuleFieldType)}>{FIELD_TYPES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label className="ax-studio-field-placeholder">Placeholder / help text<input value={fieldPlaceholder} onChange={event=>setFieldPlaceholder(event.target.value)} placeholder="Optional guidance"/></label>
            {fieldType === "select" && <label className="ax-studio-field-placeholder">Dropdown options<input value={fieldOptions} onChange={event=>setFieldOptions(event.target.value)} placeholder="New, In progress, Completed"/></label>}
            <label className="ax-studio-checkbox"><input type="checkbox" checked={fieldRequired} onChange={event=>setFieldRequired(event.target.checked)}/> Required field</label>
            <button type="button" className="ax-studio-add-field" onClick={addField}><Plus size={15}/> Add field</button>
          </div>
          <div className="ax-studio-field-list">{fields.length ? fields.map((field,index)=><article key={field.key}><span className="ax-studio-field-index">{String(index+1).padStart(2,"0")}</span><div><strong>{field.label}{field.required ? " *" : ""}</strong><small>{FIELD_TYPES.find(item=>item.id===field.type)?.label || field.type}{field.options?.length ? " · " + field.options.join(", ") : ""}</small></div><button type="button" onClick={()=>setFields(current=>current.filter(item=>item.key!==field.key))} aria-label={"Remove "+field.label}><Trash2 size={15}/></button></article>) : <p className="ax-studio-empty-fields">No custom fields added yet. Start with the information you need to capture.</p>}</div>
        </div>
        <div className="ax-studio-section"><div className="ax-studio-section-title"><span>03</span><div><strong>Workflow stages</strong><small>Comma-separated statuses used by the module pipeline.</small></div></div>
          <label className="ax-studio-full">Statuses<input value={statuses} onChange={event=>setStatuses(event.target.value)} placeholder="Lead, Active, Under review, Completed"/></label>
        </div>
        {error && <p className="ax-studio-error" role="alert">{error}</p>}
        <div className="ax-studio-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="button" className="primary-button" onClick={save}><Plus size={16}/> Create module</button></div>
      </div>
      <aside className="ax-studio-aside"><span className="ax-kicker">BUILT FOR REAL WORK</span><h3>Your module will connect to the AXIVESTRA ecosystem.</h3>
        <ul><li><Check size={14}/> Dashboard and module directory</li><li><Check size={14}/> Universal and module-level search</li><li><Check size={14}/> Records, stakeholders and follow-ups</li><li><Check size={14}/> Cards, tables, pipelines and charts</li><li><Check size={14}/> Print and Save as PDF</li><li><Check size={14}/> Company cloud and PC–phone sync</li><li><Check size={14}/> Backup and restore</li></ul>
        <p>Custom module definitions are stored as workspace records. They sync through the same conflict-aware paths as the rest of your business data.</p>
      </aside>
    </div>
  </section>;
}
