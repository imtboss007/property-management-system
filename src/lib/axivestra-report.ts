import { axivestraRepeatableGroups, buildModuleSummary } from "./axivestra-module-upgrades";

type RecordRow = {
  id:string; title:string; module:string; location:string; value:string; status:string;
  contact:string; primaryContactId?:string; targetDeadline?:string; targetDeadlineTime?:string;
  nextFollowUpDate?:string; nextFollowUpTime?:string; nextAction?:string;
  nextResponseDate?:string; nextResponseTime?:string; nextResponseType?:string; nextResponseDescription?:string;
  notes:string; createdAt:string; surveyNumber?:string; ownershipDetails?:string;
  areaValue?:string; areaUnit?:string; dimensions?:string; ratePerUnit?:string;
  moduleData:Record<string,string>;
};
type ContactFollowUpRow={id:string;person:string;role:string;linkedRecordId:string;description:string;amount:string;promisedDate:string;promisedTime:string;responseType:string;status:string;notes:string;isPrimary:boolean};
type ContactRow={id:string;name:string;phone?:string;email?:string;role?:string;roles?:string[];followUps?:ContactFollowUpRow[]};
type GroupRow={id:string;name:string;jid?:string;description?:string;size?:number};
type Field={key:string;label:string;type?:string};
const escapeHtml=(value:unknown)=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]||char));
const labelFor=(key:string)=>key.replace(/^__/,"").replace(/([A-Z])/g," $1").replace(/[_-]+/g," ").replace(/^./,value=>value.toUpperCase());
const valueText=(value:unknown)=>{if(value===null||value===undefined||value==="")return "Not entered";if(typeof value==="string"){try{const parsed=JSON.parse(value);return typeof parsed==="object"?JSON.stringify(parsed,null,2):value;}catch{return value;}}return typeof value==="object"?JSON.stringify(value,null,2):String(value);};
const dateTime=(date?:string,time?:string)=>date?[date,time].filter(Boolean).join(" · "):"Not scheduled";
const row=(label:unknown,value:unknown)=>"<tr><th>"+escapeHtml(label)+"</th><td>"+escapeHtml(valueText(value))+"</td></tr>";

export function buildAxivestraReportHtml(moduleName:string,records:RecordRow[],fieldsByModule:Record<string,Field[]>,contacts:ContactRow[],savedGroups:GroupRow[]=[]):string{
  const recordSections=records.map((record,index)=>{
    const data=record.moduleData||{};
    const fields=fieldsByModule[record.module]||[];
    const knownKeys=new Set(fields.map(field=>field.key));
    const core=[
      ["Record ID",record.id],["Record / deal",record.title],["Business module",record.module],["Status",record.status],
      ["Location / jurisdiction",record.location],["Value / exposure",record.value? "₹ "+Number(record.value).toLocaleString("en-IN"):""],
      ["Area / unit",record.areaValue?(record.areaValue+" "+(record.areaUnit||"")):""],["Survey / property ID",record.surveyNumber],
      ["Ownership / parties",record.ownershipDetails],["Dimensions",record.dimensions],["Rate per unit",record.ratePerUnit],
      ["Target deadline",dateTime(record.targetDeadline,record.targetDeadlineTime)],
      ["Next follow-up",dateTime(record.nextFollowUpDate,record.nextFollowUpTime)],["Next action",record.nextAction],
      ["Expected response",dateTime(record.nextResponseDate,record.nextResponseTime)],["Response type",record.nextResponseType],
      ["Response description",record.nextResponseDescription],["Notes / evidence",record.notes],
      ["Created",record.createdAt?new Date(record.createdAt).toLocaleString("en-IN"):""]
    ];
    const linkedIds=[record.primaryContactId||"",...(data.__linkedContactIds||"").split(","),...Object.entries(data).filter(([key,val])=>key.startsWith("__contact_")&&Boolean(val)).map(([,val])=>String(val))].filter(Boolean);
    const linkedContacts=contacts.filter(contact=>linkedIds.includes(contact.id));
    if(!linkedContacts.length&&record.contact){const match=contacts.find(contact=>contact.name.trim().toLowerCase()===record.contact.trim().toLowerCase());if(match)linkedContacts.push(match);}
    if(linkedContacts.length)core.push(["Linked contacts",linkedContacts.map(contact=>[contact.name,contact.role||(contact.roles||[]).join(", "),contact.phone,contact.email].filter(Boolean).join(" · ")).join(" | ")]);
    const followUpRows=linkedContacts.flatMap(contact=>(contact.followUps||[])
      .filter(item=>!item.linkedRecordId||item.linkedRecordId===record.id)
      .map(item=>({...item,contactName:contact.name})));
    const followUpSection=followUpRows.length
      ? "<section class=\"followup-register pdf-avoid-break\"><h3>Contact follow-up register</h3><table><thead><tr><th>Person / contact</th><th>Role</th><th>Follow-up description</th><th>Amount (₹)</th><th>Will reach back</th><th>Channel</th><th>Status</th><th>Notes / outcome</th><th>Primary</th></tr></thead><tbody>"+
        followUpRows.map(item=>"<tr>"+
          "<td>"+escapeHtml(item.person||item.contactName)+"</td>"+
          "<td>"+escapeHtml(item.role)+"</td>"+
          "<td>"+escapeHtml(item.description)+"</td>"+
          "<td>"+escapeHtml(item.amount?Number(item.amount).toLocaleString("en-IN"):"Not entered")+"</td>"+
          "<td>"+escapeHtml(dateTime(item.promisedDate,item.promisedTime))+"</td>"+
          "<td>"+escapeHtml(item.responseType)+"</td>"+
          "<td>"+escapeHtml(item.status)+"</td>"+
          "<td>"+escapeHtml(item.notes)+"</td>"+
          "<td>"+(item.isPrimary?"Yes":"No")+"</td></tr>").join("")+
        "</tbody></table></section>"
      : "";
    const linkedGroupIds=(data.__linkedWhatsAppGroupIds||"").split(",").filter(Boolean);
    const linkedGroups=savedGroups.filter(group=>linkedGroupIds.includes(group.id));
    if(linkedGroups.length)core.push(["Linked WhatsApp groups",linkedGroups.map(group=>[group.name,group.size?group.size+" members":"",group.jid].filter(Boolean).join(" · ")).join(" | ")]);
    const moduleRows=fields.map(field=>{
      const raw=data[field.key]||"";
      const timed=field.type==="date"?dateTime(raw,data[field.key+"Time"]):raw;
      return [field.label,timed||"Not entered"];
    });
    const groups=(axivestraRepeatableGroups[record.module]||[]).map(group=>{
      let rows:any[]=[];try{const parsed=JSON.parse(data[group.key]||"[]");if(Array.isArray(parsed))rows=parsed;}catch{}
      if(!rows.length)return "";
      const headings=group.fields.map(field=>"<th>"+escapeHtml(field.label)+"</th>").join("");
      const body=rows.map(item=>"<tr>"+group.fields.map(field=>"<td>"+escapeHtml(valueText(field.type==="date"?[item?.[field.key],item?.[field.key+"Time"]].filter(Boolean).join(" · "):(item?.[field.key]||"")))+"</td>").join("")+"</tr>").join("");
      return "<section class='repeatable pdf-avoid-break'><h3>"+escapeHtml(group.title)+"</h3><table><thead><tr>"+headings+"</tr></thead><tbody>"+body+"</tbody></table></section>";
    }).join("");
    const groupKeys=new Set((axivestraRepeatableGroups[record.module]||[]).map(group=>group.key));
    const extra=Object.entries(data).filter(([key,value])=>!key.startsWith("__")&&!knownKeys.has(key)&&!key.endsWith("Time")&&!groupKeys.has(key)&&String(value??"").trim()).map(([key,value])=>[labelFor(key),valueText(value)]);
    const calculations=buildModuleSummary(record.module,data);
    const calc=calculations.length?"<section class='pdf-avoid-break'><h3>Calculated summaries</h3><table><tbody>"+calculations.map(item=>row(item.label,item.value)).join("")+"</tbody></table></section>":"";
    const tableRows=core.map(([label,value])=>row(label,value)).join("")+moduleRows.map(([label,value])=>row(label,value)).join("")+extra.map(([label,value])=>row(label,value)).join("");
    return "<article class='record pdf-avoid-break'><header class='record-heading'><span>RECORD "+(index+1)+" · "+escapeHtml(record.module)+"</span><h2>"+escapeHtml(record.title||"Untitled record")+"</h2><small>"+escapeHtml(record.status||"Status not set")+" · "+escapeHtml(record.id)+"</small></header><table><tbody>"+tableRows+"</tbody></table>"+followUpSection+groups+calc+"</article>";
  }).join("");
  return "<!doctype html><html><head><meta charset='utf-8'><title>"+escapeHtml(moduleName)+" — AXIVESTRA</title><style>*{box-sizing:border-box}body{font:12px/1.5 Arial,sans-serif;color:#172b3b;background:#fff;margin:0;padding:18px}header.brand{border-bottom:3px solid #126b83;padding:0 0 13px;margin-bottom:20px}header.brand strong{font-size:22px;letter-spacing:2px;color:#0c3148}header.brand h1{font-size:18px;margin:7px 0 3px}header.brand p{font-size:10px;color:#637889;margin:0}.record{margin:0 0 22px;padding:0 0 18px;border-bottom:1px solid #cbd8e1}.record-heading{margin-bottom:8px}.record-heading span{font-size:9px;font-weight:700;letter-spacing:1px;color:#28748c}.record-heading h2{font-size:16px;margin:4px 0}.record-heading small{font-size:9px;color:#698092}table{width:100%;border-collapse:collapse;margin:8px 0 14px;table-layout:fixed}th,td{border:1px solid #d7e0e7;padding:6px 8px;text-align:left;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}th{width:31%;background:#f0f5f8;font-weight:700;color:#234257}td{color:#233746}h3{font-size:12px;margin:13px 0 5px;color:#14647e}.repeatable{margin:12px 0}.repeatable table th{width:auto}.followup-register{margin:12px 0}.followup-register table{font-size:9px}.followup-register th{width:auto;background:#e8f3f6}.followup-register td{font-size:9px}.pdf-footer{font-size:9px;color:#6c8190;margin-top:18px}@media print{body{padding:0}.record{break-inside:auto}.record-heading,table tr{break-inside:avoid}}@page{size:A4;margin:12mm}</style></head><body><header class='brand'><strong>AXIVESTRA</strong><h1>"+escapeHtml(moduleName)+" — Complete Record Report</h1><p>Generated "+escapeHtml(new Date().toLocaleString("en-IN"))+" · "+records.length+" record(s) · Complete saved field and calculation detail</p></header>"+(recordSections||"<p>No records found in this export.</p>")+"<footer class='pdf-footer'>Confidential AXIVESTRA workspace export. Values and details are shown as saved in the application.</footer></body></html>";
}
