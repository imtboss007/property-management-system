type ContactFollowUp = {
  id:string; person:string; role:string; linkedRecordId:string; description:string; amount:string;
  promisedDate:string; promisedTime:string; responseType:string; status:string; notes:string;
  isPrimary:boolean; createdAt:string; updatedAt:string;
};
type Contact = {id:string;name:string;phone?:string;email?:string;role?:string;roles?:string[];whatsappGroupIds?:string[];followUps?:ContactFollowUp[]};
type RecordRow = {id:string;title:string;module:string;value:string;status:string;contact:string;primaryContactId?:string;followUpContactId?:string;moduleData:Record<string,string>};
type Group = {id:string;name:string;jid?:string;size?:number};
const esc=(value:unknown)=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]||char));
const dateTime=(date?:string,time?:string)=>date?[date,time].filter(Boolean).join(" · "):"Not scheduled";
const linkedTo=(contact:Contact,record:RecordRow)=>{
  const data=record.moduleData||{};
  const ids=[record.followUpContactId||"",record.primaryContactId||"",...(data.__linkedContactIds||"").split(","),...Object.entries(data).filter(([key,value])=>key.startsWith("__contact_")&&Boolean(value)).map(([,value])=>String(value))].filter(Boolean);
  return ids.includes(contact.id)||(record.contact||"").trim().toLowerCase()===contact.name.trim().toLowerCase();
};
export function buildContactFollowUpRegisterHtml(contacts:Contact[],records:RecordRow[],groups:Group[]=[]):string{
  const sections=contacts.map(contact=>{
    const items=contact.followUps||[];
    if(!items.length)return "";
    const linked=records.filter(record=>linkedTo(contact,record));
    const groupIds=new Set([...(contact.whatsappGroupIds||[]),...linked.flatMap(record=>(record.moduleData?.__linkedWhatsAppGroupIds||"").split(",").filter(Boolean))]);
    const groupNames=groups.filter(group=>groupIds.has(group.id)).map(group=>group.name);
    const rows=items.map(item=>{
      const record=records.find(record=>record.id===item.linkedRecordId);
      return "<tr>"+
        "<td>"+esc(item.person||contact.name)+"</td>"+
        "<td>"+esc(item.role)+"</td>"+
        "<td>"+esc(record?record.module:"Contact-level")+"</td>"+
        "<td>"+esc(record?record.title:"Not linked")+"</td>"+
        "<td>"+esc(item.description)+"</td>"+
        "<td>"+esc(item.amount?Number(item.amount).toLocaleString("en-IN"):"Not entered")+"</td>"+
        "<td>"+esc(dateTime(item.promisedDate,item.promisedTime))+"</td>"+
        "<td>"+esc(item.responseType)+"</td>"+
        "<td>"+esc(item.status)+"</td>"+
        "<td>"+esc(item.notes)+"</td>"+
        "<td>"+(item.isPrimary?"Yes":"No")+"</td></tr>";
    }).join("");
    return "<article class='contact-section'><h2>"+esc(contact.name)+"</h2><p>"+esc([contact.role,...(contact.roles||[]),contact.phone,contact.email].filter(Boolean).join(" · "))+"</p><p>WhatsApp groups: "+esc(groupNames.join(", ")||"None linked")+"</p><table><thead><tr><th>Person</th><th>Role</th><th>Module type</th><th>Linked record</th><th>Description</th><th>Amount (INR)</th><th>Will reach back</th><th>Channel</th><th>Status</th><th>Notes / outcome</th><th>Primary</th></tr></thead><tbody>"+rows+"</tbody></table></article>";
  }).join("");
  const count=contacts.reduce((total,contact)=>total+(contact.followUps||[]).length,0);
  return "<!doctype html><html><head><meta charset='utf-8'><title>AXIVESTRA Follow-up Register</title><style>*{box-sizing:border-box}body{font:12px/1.45 Arial,sans-serif;color:#172b3b;background:#fff;margin:0;padding:16px}header.brand{border-bottom:3px solid #126b83;padding:0 0 12px;margin-bottom:16px}header.brand strong{font-size:21px;letter-spacing:2px;color:#0c3148}h1{font-size:17px;margin:6px 0}p{font-size:9px;color:#536d80;margin:4px 0}.contact-section{margin:0 0 18px;padding:0 0 12px;border-bottom:1px solid #ccd8e1}h2{font-size:13px;margin:10px 0 4px;color:#12617b}table{width:100%;border-collapse:collapse;table-layout:fixed;margin:8px 0 12px}th,td{border:1px solid #d7e0e7;padding:5px;text-align:left;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap;font-size:8px}th{background:#e8f3f6;color:#234257;font-weight:700}footer{margin-top:16px;color:#607889;font-size:8px}@page{size:A4 landscape;margin:9mm}</style></head><body><header class='brand'><strong>AXIVESTRA</strong><h1>Contact 360 — Follow-up Register</h1><p>Generated "+esc(new Date().toLocaleString("en-IN"))+" · "+count+" follow-up line(s) · All linked contacts, workstreams, WhatsApp groups and saved commitments</p></header>"+(sections||"<p>No follow-up lines found.</p>")+"<footer>Confidential AXIVESTRA workspace export. Values are shown as saved in the application.</footer></body></html>";
}
