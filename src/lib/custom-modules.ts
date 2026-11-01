export type CustomModuleFieldType =
  | "text" | "number" | "currency" | "percent" | "date" | "select"
  | "textarea" | "email" | "phone" | "url" | "checkbox";

export type CustomModuleField = {
  key: string;
  label: string;
  placeholder: string;
  type?: CustomModuleFieldType;
  options?: string[];
  required?: boolean;
};

export type CustomModuleDefinition = {
  id: string;
  name: string;
  description: string;
  group: string;
  icon: string;
  color: string;
  fields: CustomModuleField[];
  statuses: string[];
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
};

export function normaliseCustomModuleName(value: string): string {
  return value.trim().replace(/\\s+/g, " ");
}

export function customModuleFieldKey(label: string, index: number): string {
  const slug = label.normalize("NFKD").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return (slug || "field_" + (index + 1)).slice(0, 48);
}

export function validateCustomModule(value: CustomModuleDefinition, existingNames: string[]): string[] {
  const errors: string[] = [];
  const name = normaliseCustomModuleName(value.name);
  if (!name) errors.push("Enter a module name.");
  if (name.length > 48) errors.push("Module names must be 48 characters or fewer.");
  if (existingNames.some(item => item.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
    errors.push("A module with this name already exists.");
  }
  if (!value.group.trim()) errors.push("Choose a module category.");
  if (value.fields.length > 40) errors.push("A module can contain up to 40 custom fields.");
  const keys = new Set<string>();
  for (const field of value.fields) {
    if (!field.label.trim()) errors.push("Every custom field needs a label.");
    if (field.key && keys.has(field.key)) errors.push("Custom field keys must be unique.");
    keys.add(field.key);
    if (field.type === "select" && !(field.options || []).some(option => option.trim())) {
      errors.push("Every dropdown field needs at least one option.");
    }
  }
  if (!value.statuses.some(status => status.trim())) errors.push("Add at least one workflow status.");
  return errors;
}
