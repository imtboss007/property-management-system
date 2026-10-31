function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

export function canonicalContactPhone(value) {
  let digits = digitsOnly(value);
  if (digits.startsWith("00")) digits = digits.slice(2);
  // AXIVESTRA's default market is India. Normalize a local 10-digit number
  // to the same identity as its +91 international representation.
  if (digits.length === 10) digits = "91" + digits;
  return digits;
}

function normalizedName(contact) {
  const name = String(contact?.whatsappName || contact?.name || contact?.notify || "").trim();
  return name.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function contactJid(contact) {
  return String(contact?.whatsappJid || contact?.jid || "").trim().toLowerCase();
}

function mergeText(values) {
  const unique = [];
  const seen = new Set();
  for (const raw of values) {
    const value = String(raw ?? "").trim();
    const key = value.toLocaleLowerCase();
    if (value && !seen.has(key)) {
      unique.push(value);
      seen.add(key);
    }
  }
  return unique.join(" · ");
}

function completeness(contact) {
  return Object.entries(contact || {}).reduce((score, [key, value]) => {
    if (key === "id") return score;
    if (Array.isArray(value)) return score + value.filter(Boolean).length;
    return score + (String(value ?? "").trim() ? 1 : 0);
  }, 0);
}

function mergeContactRecords(records) {
  const ordered = [...records].sort((a, b) => completeness(b) - completeness(a));
  const primary = ordered[0];
  const merged = { ...primary };
  const arrayFields = new Set(["roles", "whatsappAliases"]);
  const textFields = new Set([
    "name", "whatsappName", "notify", "verifiedName", "email", "address",
    "profession", "employer", "designation", "businessType", "incomeSources",
    "associatedCompany", "relationshipNotes", "notes", "customRoles"
  ]);

  for (const field of arrayFields) {
    const values = ordered.flatMap(item => Array.isArray(item[field]) ? item[field] : []);
    if (field === "roles") {
      const roleValues = [...ordered.map(item => item.role), ...values];
      merged.roles = [...new Map(roleValues.filter(Boolean).map(value => [String(value).toLowerCase(), String(value)])).values()];
      if (merged.roles.length) merged.role = merged.roles[0];
    } else {
      merged[field] = [...new Set(values.map(String).filter(Boolean))];
    }
  }
  for (const field of textFields) {
    const values = ordered.map(item => item[field]);
    if (field === "customRoles") {
      merged.customRoles = [...new Set(values.flatMap(value => String(value || "").split(",")).map(value => value.trim()).filter(Boolean))].join(", ");
    } else {
      merged[field] = mergeText(values);
    }
  }

  const phone = ordered.find(item => String(item.phone || "").trim())?.phone;
  if (phone) merged.phone = String(phone).trim();
  const jid = ordered.find(item => contactJid(item)) ;
  if (jid) merged.whatsappJid = contactJid(jid);
  merged.whatsappAliases = [...new Set([
    ...ordered.flatMap(item => Array.isArray(item.whatsappAliases) ? item.whatsappAliases : []),
    ...ordered.map(contactJid)
  ].filter(Boolean))];
  return merged;
}

/**
 * Merge duplicate AXIVESTRA contacts only when they share a WhatsApp JID,
 * or the same normalized phone AND the same normalized contact name.
 * A shared phone alone is not enough to merge two different people.
 */
export function deduplicateMasterContacts(records) {
  const contacts = [];
  const remap = {};
  const groups = [];
  for (const contact of Array.isArray(records) ? records : []) {
    if (!contact || typeof contact !== "object" || !contact.id) continue;
    const phone = canonicalContactPhone(contact.phone);
    const name = normalizedName(contact);
    const jid = contactJid(contact);
    let groupIndex = -1;
    if (jid) groupIndex = groups.findIndex(group => group.some(item => contactJid(item) === jid));
    if (groupIndex < 0 && phone && name) {
      groupIndex = groups.findIndex(group => group.some(item =>
        canonicalContactPhone(item.phone) === phone && normalizedName(item) === name
      ));
    }
    if (groupIndex < 0) groups.push([contact]);
    else groups[groupIndex].push(contact);
  }

  const removedIds = [];
  for (const group of groups) {
    const merged = mergeContactRecords(group);
    contacts.push(merged);
    for (const contact of group) {
      if (contact.id !== merged.id) {
        remap[contact.id] = merged.id;
        removedIds.push(contact.id);
      }
    }
  }
  return { contacts, remap, removedIds, duplicatesRemoved: removedIds.length };
}

function remapId(value, remap) {
  const id = String(value || "");
  return remap[id] || id;
}

/** Update all contact-ID links in AXIVESTRA workspace records after contact merges. */
export function remapWorkspaceContactReferences(workspace, remap) {
  const mapArray = (rows, mapper) => (Array.isArray(rows) ? rows : []).map(mapper);
  const properties = mapArray(workspace.properties, property => {
    const moduleData = { ...(property.moduleData || {}) };
    for (const [key, value] of Object.entries(moduleData)) {
      if (key.startsWith("__contact_")) moduleData[key] = remapId(value, remap);
      if (key === "__linkedContactIds") {
        moduleData[key] = [...new Set(String(value || "").split(",").map(id => remapId(id.trim(), remap)).filter(Boolean))].join(",");
      }
    }
    return {
      ...property,
      primaryContactId: remapId(property.primaryContactId, remap),
      moduleData
    };
  });
  const remapContactId = row => ({ ...row, contactId: remapId(row.contactId, remap) });
  return {
    properties,
    tasks: mapArray(workspace.tasks, remapContactId),
    financials: mapArray(workspace.financials, remapContactId),
    riskRecords: mapArray(workspace.riskRecords, remapContactId),
    approvalRequests: mapArray(workspace.approvalRequests, remapContactId)
  };
}
