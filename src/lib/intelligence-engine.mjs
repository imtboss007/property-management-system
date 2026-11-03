const text = value => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase().replace(/[\u00a0\s]+/g," ").trim();
const digits = value => String(value ?? "").replace(/\D/g,"");
const localPhone = value => { const n=digits(value); return n.length===12 && n.startsWith("91") ? n.slice(2) : n; };
const closedStatuses = new Set(["completed","closed","settled","rejected","cancelled","reached back","archived"]);
export const normalizeIntelligenceText = value => text(value).replace(/[^\p{L}\p{N}+]/gu," ").replace(/\s+/g," ").trim();

export function parseIntelligenceAmount(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  const raw = String(value).trim().toLowerCase().replace(/[₹,\s]/g,"");
  const match = raw.match(/(-?\d+(?:\.\d+)?)(cr|crore|crores|c|lakh|lakhs|lac|lacs|l|k|thousand)?/i);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = (match[2] || "").toLowerCase();
  const multiplier = ["cr","crore","crores","c"].includes(unit) ? 10000000 : ["lakh","lakhs","lac","lacs","l"].includes(unit) ? 100000 : ["k","thousand"].includes(unit) ? 1000 : 1;
  return n * multiplier;
}
const amountKeys = {
  market: ["marketvalue","marketamount","marketprice","currentmarketvalue","__marketvalue"],
  settlement: ["settlementamount","finalsettlementamount","settlementvalue","agreedsettlementamount","__settlementamount","expectedsettlementamount"]
};
function amountFromData(data, kind) {
  const entries = Object.entries(data || {});
  for (const key of amountKeys[kind] || []) {
    const found = entries.find(([name,value]) => name.toLowerCase() === key && parseIntelligenceAmount(value) !== null);
    if (found) return parseIntelligenceAmount(found[1]);
  }
  const pattern = kind === "market" ? /market.*(value|amount|price)|(value|amount|price).*market/i : /settle.*(amount|value)|(amount|value).*settle/i;
  const found = entries.find(([key,value]) => pattern.test(key) && parseIntelligenceAmount(value) !== null);
  return found ? parseIntelligenceAmount(found[1]) : null;
}
export const getIntelligenceRecordAmount = record => parseIntelligenceAmount(record?.value ?? record?.amount ?? record?.moduleData?.__dealAmount);
export const getIntelligenceMarketValue = record => amountFromData(record?.moduleData,"market");
export const getIntelligenceSettlementValue = record => amountFromData(record?.moduleData,"settlement");
export function getIntelligenceTransactionType(record) {
  const data = record?.moduleData || {};
  return String(data.__transactionType || data.transactionType || data.__dealType || data.dealType || data.transaction || data.__transactionCategory || "").trim();
}
const locationValues = record => [record?.location, ...Object.entries(record?.moduleData || {}).filter(([key,value]) => /location|address|city|area|locality|village|district|taluk|tehsil|pincode|postal|landmark|zone|state|ward|hobli|street|survey/i.test(key) && String(value ?? "").trim()).map(([,value]) => String(value))].filter(Boolean);
function editDistance(a,b) {
  if (Math.abs(a.length-b.length)>2) return 99;
  let prior = Array.from({length:b.length+1},(_,i)=>i);
  for (let i=1;i<=a.length;i++) {
    const next=[i];
    for(let j=1;j<=b.length;j++) next[j]=Math.min(next[j-1]+1,prior[j]+1,prior[j-1]+(a[i-1]===b[j-1]?0:1));
    prior=next;
  }
  return prior[b.length];
}
function similarWordMatch(query,candidate) {
  if (!query || !candidate) return false;
  if (candidate.includes(query) || query.includes(candidate)) return true;
  return query.length>=7 && candidate.length>=7 && Math.abs(query.length-candidate.length)<=2 && editDistance(query,candidate)<=2;
}
export function matchIntelligenceLocation(query, recordOrValue) {
  const q = normalizeIntelligenceText(query);
  if (!q) return {matched:true,kind:"all"};
  const values = Array.isArray(recordOrValue) ? recordOrValue : (typeof recordOrValue === "object" && recordOrValue !== null ? locationValues(recordOrValue) : [String(recordOrValue ?? "")]);
  const candidates = values.map(value=>normalizeIntelligenceText(value)).filter(Boolean);
  const terms = q.split(" ").filter(Boolean);
  let fuzzy = false;
  const matched = terms.every(term => {
    if (candidates.some(candidate => candidate.includes(term) || candidate.split(" ").some(word=>word===term || word.startsWith(term)))) return true;
    const similar = candidates.some(candidate => candidate.split(" ").some(word=>similarWordMatch(term,word)));
    if (similar) fuzzy = true;
    return similar;
  });
  return {matched,kind:matched?(fuzzy?"probable spelling match":"direct match"):"none"};
}
function collectContactIds(record) {
  const data = record?.moduleData || {};
  const ids = [
    record?.primaryContactId, record?.followUpContactId, data.__primaryFollowUpContactId, data.__followUpContactId,
    ...String(data.__linkedContactIds || "").split(","), ...String(data.__followUpContactIds || "").split(","),
    ...Object.entries(data).filter(([key,value])=>key.startsWith("__contact_") && String(value || "").trim()).map(([,value])=>String(value)),
    ...(Array.isArray(record?.followUpEntries)?record.followUpEntries.map(item=>item?.followPersonId || item?.contactId):[])
  ];
  return Array.from(new Set(ids.map(value=>String(value || "").trim()).filter(Boolean)));
}
export function getIntelligenceLinkedContacts(record, contacts=[]) {
  const ids = collectContactIds(record);
  const byId = new Map(contacts.map(contact=>[String(contact.id),contact]));
  const linked = ids.map(id=>byId.get(id)).filter(Boolean);
  const legacyName = text(record?.contact);
  if (legacyName) contacts.forEach(contact=>{ if (text(contact.name)===legacyName && !linked.some(item=>item.id===contact.id)) linked.push(contact); });
  return linked;
}
function contactSearchFields(contact) {
  return [contact.name,contact.phone,localPhone(contact.phone),contact.role,...(contact.roles||[]),contact.customRoles,contact.email,contact.address,contact.profession,contact.employer,contact.designation,contact.businessType,contact.associatedCompany,contact.whatsappName,contact.verifiedName,contact.notify,contact.whatsappJid].filter(Boolean).map(String);
}
function recordSearchFields(record, contacts) {
  return [record.title,record.module,record.location,record.value,record.status,record.contact,record.surveyNumber,record.ownershipDetails,getIntelligenceTransactionType(record),...Object.entries(record.moduleData||{}).flatMap(([key,value])=>[key,String(value ?? "")]),...getIntelligenceLinkedContacts(record,contacts).flatMap(contactSearchFields)].filter(Boolean).map(String);
}
const resolveLimit = (value,custom) => value === "custom" ? parseIntelligenceAmount(custom) : parseIntelligenceAmount(value);
export function filterIntelligenceRecords(records=[],contacts=[],filters={},modules=[]) {
  const query = normalizeIntelligenceText(filters.query || "");
  const terms = query.split(" ").filter(Boolean);
  const moduleGroups = new Map(modules.map(module=>[module.name,module.group || "Other"]));
  const dealLimit = resolveLimit(filters.dealMax,filters.dealCustom);
  const marketLimit = resolveLimit(filters.marketMax,filters.marketCustom);
  const settlementLimit = resolveLimit(filters.settlementMax,filters.settlementCustom);
  return records.map(record=>{
    const linked=getIntelligenceLinkedContacts(record,contacts);
    const searchText=normalizeIntelligenceText(recordSearchFields(record,contacts).join(" "));
    const locationMatch=matchIntelligenceLocation(filters.location || "",record);
    const amount=getIntelligenceRecordAmount(record);
    const market=getIntelligenceMarketValue(record);
    const settlement=getIntelligenceSettlementValue(record);
    const transactionType=getIntelligenceTransactionType(record);
    const group=moduleGroups.get(record.module) || record.group || "Other";
    return {record,linked,searchText,locationMatch,amount,market,settlement,transactionType,group};
  }).filter(item =>
    (!terms.length || terms.every(term=>item.searchText.includes(term)) || (digits(filters.query).length>=4 && item.linked.some(contact=>localPhone(contact.phone).includes(localPhone(filters.query))))) &&
    item.locationMatch.matched &&
    (!filters.category || filters.category==="All categories" || item.group===filters.category) &&
    (!filters.module || filters.module==="All modules" || item.record.module===filters.module) &&
    (!filters.transactionType || filters.transactionType==="All transaction types" || text(item.transactionType)===text(filters.transactionType)) &&
    (!filters.status || filters.status==="Any status" || (filters.status==="Open" ? !closedStatuses.has(text(item.record.status)) : closedStatuses.has(text(item.record.status)))) &&
    (dealLimit===null || (item.amount!==null && item.amount<=dealLimit)) &&
    (marketLimit===null || (item.market!==null && item.market<=marketLimit)) &&
    (settlementLimit===null || (item.settlement!==null && item.settlement<=settlementLimit))
  );
}
export function buildIntelligenceDuplicateSignals(records=[],contacts=[]) {
  const signals=[];
  const phones=new Map();
  for(const contact of contacts){
    const phone=localPhone(contact.phone);
    if(phone.length<10) continue;
    if(!phones.has(phone)) phones.set(phone,[]);
    phones.get(phone).push(contact);
  }
  for(const [phone,group] of phones){
    const names=new Set(group.map(item=>text(item.name)).filter(Boolean));
    if(group.length>1 && names.size>1) signals.push({kind:"contact",severity:"review",title:"Same phone under different names",detail:group.map(item=>item.name).join(" / ")+" · "+phone,items:group.map(item=>({id:item.id,name:item.name}))});
  }
  const surveys=new Map();
  const titles=new Map();
  for(const record of records){
    const data=record.moduleData||{};
    const survey=normalizeIntelligenceText(record.surveyNumber || data.surveyNumber || data.__surveyNumber || data.surveyNo || "");
    if(survey){if(!surveys.has(survey))surveys.set(survey,[]);surveys.get(survey).push(record);}
    const places=locationValues(record).map(normalizeIntelligenceText).join("|");
    const key=normalizeIntelligenceText(record.title)+"|"+places;
    if(record.title && places){if(!titles.has(key))titles.set(key,[]);titles.get(key).push(record);}
  }
  for(const [key,group] of surveys) if(group.length>1) signals.push({kind:"property",severity:"review",title:"Repeated survey / property identifier",detail:group.map(item=>item.title+" · "+item.module).join(" / "),items:group.map(item=>({id:item.id,name:item.title,module:item.module}))});
  for(const [key,group] of titles) if(group.length>1 && !signals.some(signal=>signal.kind==="property" && signal.items.some(item=>group.some(record=>record.id===item.id)))) signals.push({kind:"property",severity:"review",title:"Possible same property across records",detail:group.map(item=>item.title+" · "+item.module).join(" / "),items:group.map(item=>({id:item.id,name:item.title,module:item.module}))});
  return signals;
}
const isLoan = record => /loan/i.test(String(record.module||"")) || /loan/i.test(getIntelligenceTransactionType(record));
export function buildIntelligenceOpportunitySignals(records=[],contacts=[]) {
  const out=[];
  for(const record of records){
    const amount=getIntelligenceRecordAmount(record);
    const market=getIntelligenceMarketValue(record);
    const settlement=getIntelligenceSettlementValue(record);
    const linked=getIntelligenceLinkedContacts(record,contacts);
    const data=record.moduleData||{};
    const status=text(record.status);
    const primaryId=record.followUpContactId || data.__primaryFollowUpContactId || data.__followUpContactId || (record.followUpEntries||[]).find(item=>item.isPrimary)?.followPersonId;
    if(amount && market && market>=amount*1.1) out.push({kind:"value-gap",severity:"opportunity",title:"Potential below-market deal",detail:"Saved market value is at least 10% above saved deal amount. Verify figures and valuation date.",record});
    const buyerFields=Object.entries(data).filter(([key])=>/buyer/i.test(key)).map(([,value])=>value).join(" ");
    const buyerNeeded=/buyer|purchaser/i.test(status+" "+buyerFields);
    const buyerLinked=linked.some(contact=>/buyer|purchaser/i.test([contact.role,...(contact.roles||[]),contact.customRoles].join(" ")));
    if(buyerNeeded && !buyerLinked) out.push({kind:"buyer",severity:"attention",title:"Buyer confirmation needed",detail:"Buyer-related status or fields exist, but no buyer contact is linked.",record});
    if(isLoan(record) && !closedStatuses.has(status)){
      const balance=Object.entries(data).find(([key,value])=>/outstanding|balance.*(due|loan)|loan.*balance/i.test(key) && parseIntelligenceAmount(value)!==null);
      if(!balance) out.push({kind:"loan",severity:"attention",title:"Loan balance needs verification",detail:"Open loan record has no clearly identified outstanding balance.",record});
    }
    if(settlement!==null && settlement>0 && !closedStatuses.has(status)) out.push({kind:"settlement",severity:"attention",title:"Settlement may still be pending",detail:"Settlement value is saved while the record is open. Confirm payment and closure.",record});
    if(!primaryId) out.push({kind:"follow-up",severity:"attention",title:"Primary follow-up owner missing",detail:"No primary follow-up coordinator is linked to this record.",record});
  }
  return out;
}
export function buildIntelligenceExposure(records=[],financials=[]) {
  const open=records.filter(record=>!closedStatuses.has(text(record.status)));
  const dealValue=records.reduce((sum,record)=>sum+(getIntelligenceRecordAmount(record)||0),0);
  const marketValue=records.reduce((sum,record)=>sum+(getIntelligenceMarketValue(record)||0),0);
  const expectedSettlement=records.reduce((sum,record)=>sum+(getIntelligenceSettlementValue(record)||0),0);
  let knownLoanBalance=0,estimatedLoanExposure=0;
  for(const record of open.filter(isLoan)){
    const data=record.moduleData||{};
    const known=Object.entries(data).find(([key,value])=>/outstanding|balance.*(due|loan)|loan.*balance/i.test(key) && parseIntelligenceAmount(value)!==null);
    if(known) knownLoanBalance+=parseIntelligenceAmount(known[1]);
    else estimatedLoanExposure+=(getIntelligenceRecordAmount(record)||0);
  }
  const inflowTypes=new Set(["sale","advance","loan disbursal","receipt","collection","inflow","rental income","rent"]);
  const outflowTypes=new Set(["purchase","loan repayment","interest","instalment","brokerage","expense","settlement","outflow","maintenance"]);
  const recordedInflow=financials.reduce((sum,item)=>sum+(inflowTypes.has(text(item.type))?(parseIntelligenceAmount(item.amount)||0):0),0);
  const recordedOutflow=financials.reduce((sum,item)=>sum+(outflowTypes.has(text(item.type))?(parseIntelligenceAmount(item.amount)||0):0),0);
  return {recordCount:records.length,openCount:open.length,dealValue,marketValue,expectedSettlement,knownLoanBalance,estimatedLoanExposure,recordedInflow,recordedOutflow,recordedNet:recordedInflow-recordedOutflow};
}
export function buildIntelligenceStakeholderNetwork(records=[],contacts=[]) {
  return contacts.map(contact=>{
    const linked=records.filter(record=>getIntelligenceLinkedContacts(record,contacts).some(item=>item.id===contact.id));
    const roles=Array.from(new Set([contact.role,...(contact.roles||[]),...(contact.customRoles||"").split(",")].map(value=>String(value||"").trim()).filter(Boolean)));
    return {contact,records:linked,recordCount:linked.length,roles};
  }).filter(item=>item.recordCount>0).sort((a,b)=>b.recordCount-a.recordCount || String(a.contact.name).localeCompare(String(b.contact.name)));
}
export function buildIntelligenceLocationSummary(records=[]) {
  const map=new Map();
  for(const record of records){
    const location=locationValues(record).join(" · ") || "Location not recorded";
    const key=normalizeIntelligenceText(location);
    if(!map.has(key))map.set(key,{location,count:0,modules:new Set(),value:0});
    const item=map.get(key);item.count++;item.modules.add(record.module);item.value+=(getIntelligenceRecordAmount(record)||0);
  }
  return Array.from(map.values()).map(item=>({...item,modules:Array.from(item.modules)})).sort((a,b)=>b.count-a.count || b.value-a.value);
}
export function buildIntelligenceAlerts({tasks=[],contacts=[],documents=[],riskRecords=[],approvalRequests=[],today=""}={}) {
  const alerts=[];
  for(const task of tasks) if(!task.done && task.date && today && task.date<today) alerts.push({kind:"task",severity:"high",title:"Overdue task",detail:task.title+" · "+task.date,recordId:task.propertyId||""});
  for(const contact of contacts) for(const follow of contact.followUps||[]) if(follow.promisedDate && today && follow.promisedDate<today && !closedStatuses.has(text(follow.status))) alerts.push({kind:"follow-up",severity:"high",title:"Overdue commitment",detail:contact.name+" · "+(follow.description||"Follow-up")+" · "+follow.promisedDate,recordId:follow.linkedRecordId||""});
  const horizon=new Date(today+"T00:00:00");if(today)horizon.setDate(horizon.getDate()+30);
  const horizonDate=today ? horizon.getFullYear()+"-"+String(horizon.getMonth()+1).padStart(2,"0")+"-"+String(horizon.getDate()).padStart(2,"0") : "";
  for(const document of documents){
    const expires=document.expiresOn||document.expiryDate||"";
    if(expires && today && expires<today)alerts.push({kind:"document",severity:"high",title:"Expired document",detail:(document.name||"Document")+" · "+expires,recordId:document.propertyId||""});
    else if(expires && today && expires<=horizonDate)alerts.push({kind:"document",severity:"medium",title:"Document expiring soon",detail:(document.name||"Document")+" · "+expires,recordId:document.propertyId||""});
  }
  for(const risk of riskRecords)if(!closedStatuses.has(text(risk.status)) && (text(risk.severity)==="critical" || (risk.dueDate && today && risk.dueDate<today)))alerts.push({kind:"risk",severity:"high",title:"Open risk requires review",detail:(risk.title||risk.entity||"Risk")+" · "+(risk.dueDate||risk.severity||"Open"),recordId:risk.propertyId||""});
  for(const approval of approvalRequests)if(!closedStatuses.has(text(approval.status)))alerts.push({kind:"approval",severity:"medium",title:"Approval pending",detail:(approval.title||"Approval")+" · "+(approval.priority||"Review"),recordId:approval.propertyId||""});
  const rank={high:0,medium:1,low:2};return alerts.sort((a,b)=>(rank[a.severity]??3)-(rank[b.severity]??3)).slice(0,50);
}
export function buildIntelligenceActivityFeed({record,records=[],contacts=[],tasks=[],financials=[],documents=[],riskRecords=[],approvalRequests=[],auditEvents=[]}={}) {
  const events=[];
  const id=record?.id;
  const add=event=>{if(event && event.at && (!id || event.recordId===id || event.linkedRecordId===id))events.push(event);};
  if(record)add({id:"created-"+record.id,at:record.createdAt||record.updatedAt||"",title:"Record created / first recorded",detail:record.title+" · "+record.module,source:"Property record",recordId:id});
  for(const event of auditEvents||[])add({id:event.id,at:event.at,title:event.label||event.action||"Record activity",detail:event.description||event.entity||"",source:"Audit history",recordId:event.recordId});
  for(const task of tasks||[])if(!id || task.propertyId===id || task.property===record?.title)add({id:"task-"+task.id,at:task.date?task.date+"T"+(task.time||"00:00"):"",title:task.title,detail:task.notes||task.type||"Task",source:task.done?"Completed task":"Task",recordId:task.propertyId||id});
  for(const item of financials||[])if(!id || item.propertyId===id || item.property===record?.title)add({id:"money-"+item.id,at:item.date||"",title:item.type+" · "+(item.party||item.property||"Transaction"),detail:item.amount+" · "+(item.notes||""),source:"Financial entry",recordId:item.propertyId||id});
  for(const doc of documents||[])if(!id || doc.propertyId===id)add({id:"doc-"+doc.id,at:doc.createdAt||doc.expiresOn||"",title:doc.name||"Document",detail:doc.category||doc.notes||"",source:"Document vault",recordId:doc.propertyId||id});
  for(const risk of riskRecords||[])if(!id || risk.propertyId===id)add({id:"risk-"+risk.id,at:risk.createdAt||risk.dueDate||"",title:risk.title||"Risk",detail:risk.severity+" · "+risk.status,source:"Risk register",recordId:risk.propertyId||id});
  for(const approval of approvalRequests||[])if(!id || approval.propertyId===id)add({id:"approval-"+approval.id,at:approval.requestedAt||approval.decidedAt||"",title:approval.title||"Approval",detail:approval.status+" · "+approval.priority,source:"Approval workflow",recordId:approval.propertyId||id});
  for(const contact of contacts||[])for(const follow of contact.followUps||[])if(!id || follow.linkedRecordId===id)add({id:"follow-"+follow.id,at:follow.updatedAt||follow.createdAt||follow.promisedDate||"",title:contact.name+" · "+(follow.description||"Follow-up"),detail:follow.role+" · "+follow.status+" · "+follow.promisedDate,source:"Contact commitment",recordId:follow.linkedRecordId||id});
  return events.filter(item=>item.at).sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,100);
}


function propertyIdentityKey(record) {
  const data=record?.moduleData||{};
  const survey=normalizeIntelligenceText(record?.surveyNumber||data.surveyNumber||data.__surveyNumber||data.surveyNo||"");
  if(survey) return "survey:"+survey;
  const title=normalizeIntelligenceText(record?.title||"");
  const location=normalizeIntelligenceText(record?.location||data.address||data.propertyAddress||"");
  return title && location ? "title-location:"+title+"|"+location : "";
}
function getOwnerDescriptor(record) {
  const data=record?.moduleData||{};
  const values=[record?.ownershipDetails,data.owner,data.ownerName,data.currentOwner,data.seller,data.transferor,data.landlord].filter(value=>String(value||"").trim());
  return Array.from(new Set(values.map(value=>String(value).trim())));
}
export function buildIntelligenceConflictSignals(records=[]) {
  const groups=new Map();
  for(const record of records){
    const key=propertyIdentityKey(record);
    if(!key)continue;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(record);
  }
  const signals=[];
  for(const [key,group] of groups){
    if(group.length<2)continue;
    const amountFields=[
      ["deal amount",group.map(getIntelligenceRecordAmount)],
      ["market value",group.map(getIntelligenceMarketValue)],
      ["settlement value",group.map(getIntelligenceSettlementValue)]
    ];
    for(const [label,values] of amountFields){
      const distinct=Array.from(new Set(values.filter(value=>value!==null).map(value=>Math.round(value))));
      if(distinct.length>1)signals.push({kind:"amount-conflict",severity:"review",title:"Different "+label+" values recorded",detail:group.map(record=>record.title+" · "+(getIntelligenceRecordAmount(record)===null?"amount missing":record.value||"")).join(" / "),items:group.map(record=>({id:record.id,name:record.title,module:record.module}))});
    }
    const owners=Array.from(new Set(group.flatMap(getOwnerDescriptor).map(normalizeIntelligenceText).filter(Boolean)));
    if(owners.length>1)signals.push({kind:"ownership-conflict",severity:"review",title:"Ownership details vary across records",detail:group.map(record=>record.title+" · "+getOwnerDescriptor(record).join(", ")).join(" / "),items:group.map(record=>({id:record.id,name:record.title,module:record.module}))});
    const addresses=Array.from(new Set(group.map(record=>normalizeIntelligenceText(record.location||record.moduleData?.address||record.moduleData?.propertyAddress||"")).filter(Boolean)));
    if(addresses.length>1)signals.push({kind:"address-conflict",severity:"review",title:"Property address varies across records",detail:group.map(record=>record.title+" · "+(record.location||record.moduleData?.address||record.moduleData?.propertyAddress||"")).join(" / "),items:group.map(record=>({id:record.id,name:record.title,module:record.module}))});
  }
  return signals;
}
export function buildIntelligenceOwnershipChains(records=[]) {
  const groups=new Map();
  for(const record of records){
    const key=propertyIdentityKey(record);
    if(!key)continue;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(record);
  }
  return Array.from(groups.entries()).filter(([,group])=>group.length>1).map(([key,group])=>({
    key,
    surveyNumber:group.find(record=>record.surveyNumber||record.moduleData?.__surveyNumber)?.surveyNumber||group.find(record=>record.moduleData?.__surveyNumber)?.moduleData?.__surveyNumber||"",
    title:group[0].title||"Property record group",
    entries:group.map(record=>{
      const data=record.moduleData||{};
      const date=data.transactionDate||data.saleDate||data.purchaseDate||data.registrationDate||record.createdAt||"";
      const transferFrom=data.seller||data.transferor||data.previousOwner||"";
      const transferTo=data.buyer||data.transferee||data.currentOwner||data.ownerName||"";
      return {id:record.id,title:record.title,module:record.module,date,transactionType:getIntelligenceTransactionType(record),ownershipDetails:record.ownershipDetails||"",transferFrom,transferTo,status:record.status};
    }).sort((a,b)=>String(a.date).localeCompare(String(b.date)))
  })).sort((a,b)=>a.title.localeCompare(b.title));
}
export function buildIntelligencePropertyCashflow(records=[],financials=[]) {
  const propertyRows=records.map(record=>{
    const linked=financials.filter(item=>(record.id && item.propertyId===record.id)||(!item.propertyId && item.property && normalizeIntelligenceText(item.property)===normalizeIntelligenceText(record.title)));
    let rentReceived=0,tenantAdvances=0,operatingCosts=0,otherInflows=0,otherOutflows=0;
    for(const item of linked){
      const kind=text(item.type);
      const amount=parseIntelligenceAmount(item.amount)||0;
      if(/tenant advance|rent advance|security deposit|lease deposit|rental deposit/.test(kind))tenantAdvances+=amount;
      else if(/rent|rental income|lease receipt/.test(kind))rentReceived+=amount;
      else if(/maintenance|repair|property tax|utility|property expense|operating expense/.test(kind))operatingCosts+=amount;
      else if(/receipt|collection|inflow|sale|advance/.test(kind))otherInflows+=amount;
      else if(/expense|outflow|payment|brokerage|tax|maintenance/.test(kind))otherOutflows+=amount;
    }
    return {record,rentReceived,tenantAdvances,operatingCosts,otherInflows,otherOutflows,recordedNet:rentReceived-operatingCosts-otherOutflows,entryCount:linked.length};
  }).filter(item=>item.entryCount>0 || item.rentReceived>0 || item.tenantAdvances>0 || item.operatingCosts>0);
  return propertyRows.sort((a,b)=>b.recordedNet-a.recordedNet);
}
export function buildIntelligenceLoanPropertyExposure(records=[]) {
  const loans=records.filter(isLoan);
  const properties=records.filter(record=>!isLoan(record));
  return loans.map(loan=>{
    const data=loan.moduleData||{};
    const explicitId=data.__linkedPropertyId||data.linkedPropertyId||data.propertyId||data.__propertyId||data.securedPropertyId||data.propertyRecordId||"";
    const explicitName=data.propertyName||data.securedProperty||data.linkedPropertyName||"";
    let linkedProperty=explicitId?properties.find(record=>String(record.id)===String(explicitId)):null;
    if(!linkedProperty && explicitName)linkedProperty=properties.find(record=>normalizeIntelligenceText(record.title)===normalizeIntelligenceText(explicitName));
    const outstanding=Object.entries(data).find(([key,value])=>/outstanding|balance.*(due|loan)|loan.*balance/i.test(key)&&parseIntelligenceAmount(value)!==null);
    return {loan,property:linkedProperty||null,reference:explicitName||explicitId||"",knownOutstanding:outstanding?parseIntelligenceAmount(outstanding[1]):null,principal:getIntelligenceRecordAmount(loan),linked:Boolean(linkedProperty)};
  });
}
export function buildIntelligenceDocumentSearch(documents=[],query="") {
  const q=normalizeIntelligenceText(query);
  if(!q)return documents.slice(0,30);
  return documents.filter(document=>normalizeIntelligenceText([document.name,document.category,document.property,document.notes,document.mimeType,document.storagePath,document.expiresOn].join(" ")).includes(q)).slice(0,30);
}
export function buildIntelligenceDecisionSupport(records=[],contacts=[],documents=[],riskRecords=[],tasks=[]) {
  return records.map(record=>{
    const linked=getIntelligenceLinkedContacts(record,contacts);
    const data=record.moduleData||{};
    const docCount=documents.filter(document=>document.propertyId===record.id || normalizeIntelligenceText(document.property)===normalizeIntelligenceText(record.title)).length;
    const openRisk=riskRecords.some(risk=>risk.propertyId===record.id && !closedStatuses.has(text(risk.status)));
    const overdue=tasks.some(task=>(task.propertyId===record.id || task.property===record.title)&&!task.done&&task.date);
    const missing=[];
    if(!record.location)missing.push("location");
    if(!record.surveyNumber && !data.__surveyNumber && !data.surveyNumber)missing.push("survey / property ID");
    if(!record.ownershipDetails && !data.ownerName && !data.currentOwner)missing.push("ownership evidence");
    if(!linked.length)missing.push("linked stakeholder");
    if(!docCount)missing.push("linked document");
    if(!record.followUpContactId && !record.primaryContactId && !data.__primaryFollowUpContactId && !data.__followUpContactId)missing.push("primary follow-up owner");
    return {record,missing,docCount,openRisk,overdue,status:openRisk||overdue?"Attention needed":missing.length?"Evidence gaps":"Ready for human review"};
  }).sort((a,b)=>Number(b.openRisk||b.overdue)-Number(a.openRisk||a.overdue)||b.missing.length-a.missing.length);
}
