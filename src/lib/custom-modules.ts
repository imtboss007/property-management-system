export type CustomModuleFieldType = "text" | "textarea" | "number" | "date" | "select" | "contact" | "contacts";

export type CustomModuleFieldDefinition = {
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
  color: string;
  fields: CustomModuleFieldDefinition[];
};

export function normalizeCustomModules(value: unknown): CustomModuleDefinition[] {
  if (!Array.isArray(value)) return [];
  return value.filter(item => item && typeof item === "object").map((raw, index) => {
    const item = raw as Partial<CustomModuleDefinition>;
    const name = String(item.name || "").trim();
    const id = String(item.id || ("legacy-custom-module-" + index));
    const safeName = name || ("Custom workspace " + (index + 1));
    const fields = Array.isArray(item.fields) ? item.fields.filter(field => field && typeof field === "object").map((field, fieldIndex) => {
      const type = ["text","textarea","number","date","select","contact","contacts"].includes(String(field.type))
        ? field.type!
        : "text";
      return {
        key: String(field.key || ("legacy_custom_" + index + "_" + fieldIndex)),
        label: String(field.label || "Custom field"),
        placeholder: String(field.placeholder || ""),
        type,
        options: Array.isArray(field.options) ? field.options.map(option => String(option)) : [],
        required: Boolean(field.required)
      };
    }) : [];
    return {
      id,
      name: safeName,
      description: String(item.description || "Custom workspace for your records, contacts and follow-ups."),
      group: String(item.group || "Custom Modules"),
      color: String(item.color || "violet"),
      fields
    };
  }).filter(item => item.name.length > 0);
}

export function customModuleFieldKey(label: string, existing: string[] = []): string {
  const base = label.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
  let candidate = "custom_" + base;
  let suffix = 2;
  while (existing.includes(candidate)) candidate = "custom_" + base + "_" + suffix++;
  return candidate;
}
