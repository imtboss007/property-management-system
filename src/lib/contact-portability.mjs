const unescapeVCard = value => String(value || "").replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
const unfoldVCard = text => String(text || "").replace(/\r?\n[ \t]/g, "");
function parseVCard(text) {
  const cards = String(text || "").split(/BEGIN:VCARD/i).slice(1);
  return cards.map(card => {
    const fields = {};
    for (const line of unfoldVCard(card).split(/\r?\n/)) {
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      const key = line.slice(0, colon).split(";")[0].toUpperCase();
      const value = unescapeVCard(line.slice(colon + 1).trim());
      (fields[key] ||= []).push(value);
    }
    const name = fields.FN?.[0] || [fields.N?.[0]?.split(";").reverse().join(" ")].filter(Boolean).join("");
    const phone = fields.TEL?.[0] || "";
    const email = fields.EMAIL?.[0] || "";
    const address = fields.ADR?.[0]?.split(";").filter(Boolean).join(", ") || "";
    if (!name && !phone && !email) return null;
    return { name: name || phone || email, phone, email, address, role: "Contact", notes: "" };
  }).filter(Boolean);
}
function parseCsv(text) {
  const rows=[]; let row=[], cell="", quoted=false;
  const source=String(text || "").replace(/^\uFEFF/,"");
  for(let i=0;i<source.length;i++){
    const ch=source[i], next=source[i+1];
    if(ch==='"' && quoted && next==='"'){cell+='"';i++;}
    else if(ch==='"') quoted=!quoted;
    else if(ch==="," && !quoted){row.push(cell);cell="";}
    else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&next==="\n")i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell="";}
    else cell+=ch;
  }
  row.push(cell); if(row.some(v=>v.trim())) rows.push(row);
  if(rows.length<2) return [];
  const headers=rows.shift().map(v=>v.trim().toLowerCase().replace(/[ _-]+/g,""));
  const pick=(record,...keys)=>{for(const key of keys){const i=headers.indexOf(key);if(i>=0&&record[i]?.trim())return record[i].trim();}return "";};
  return rows.map(record=>{
    const name=pick(record,"name","fullname","contactname") || [pick(record,"firstname","givenname"),pick(record,"lastname","familyname")].filter(Boolean).join(" ");
    const phone=pick(record,"phone","mobile","mobilenumber","primaryphone","businessphone");
    const email=pick(record,"email","emailaddress","primaryemail");
    const address=pick(record,"address","streetaddress","homeaddress","businessaddress");
    if(!name&&!phone&&!email)return null;
    return {name:name||phone||email,phone,email,address,role:"Contact",notes:""};
  }).filter(Boolean);
}
export function parseContactImport(text, fileName="") {
  const source=String(text || "");
  const extension=String(fileName).toLowerCase().split(".").pop();
  if(extension==="vcf"||/BEGIN:VCARD/i.test(source)) return parseVCard(source);
  if(extension==="csv"||source.includes(",")) return parseCsv(source);
  throw new Error("Unsupported contact file. Choose a .vcf or .csv file.");
}
const escapeVCard=value=>String(value||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
export function contactsToVCard(contacts) {
  return contacts.map(contact => {
    const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${escapeVCard(contact.name)}`];
    if (contact.phone) lines.push(`TEL;TYPE=CELL:${escapeVCard(contact.phone)}`);
    if (contact.email) lines.push(`EMAIL:${escapeVCard(contact.email)}`);
    if (contact.address) lines.push(`ADR;TYPE=HOME:;;${escapeVCard(contact.address)};;;;`);
    const profile = [contact.role, contact.customRoles, contact.profession, contact.designation, contact.employer, contact.associatedCompany].filter(Boolean).join(" · ");
    if (profile) lines.push(`NOTE:${escapeVCard(profile)}`);
    lines.push("END:VCARD");
    return lines.join("\r\n");
  }).join("\r\n");
}
