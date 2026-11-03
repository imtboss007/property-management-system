import assert from "node:assert/strict";
import {parseIntelligenceAmount,matchIntelligenceLocation,filterIntelligenceRecords,buildIntelligenceDuplicateSignals,buildIntelligenceOpportunitySignals,buildIntelligenceExposure,buildIntelligenceStakeholderNetwork,buildIntelligenceLocationSummary,buildIntelligenceAlerts,buildIntelligenceActivityFeed} from "../src/lib/intelligence-engine.mjs";
assert.equal(parseIntelligenceAmount("75cr"),750000000);
assert.equal(parseIntelligenceAmount("₹1,23,456"),123456);
assert.equal(parseIntelligenceAmount("50 lakh"),5000000);
assert.equal(matchIntelligenceLocation("Srirampura",{location:"Srirampuram, Bengaluru"}).matched,true);
assert.equal(matchIntelligenceLocation("Srirampura",{location:"Electronic City, Bengaluru"}).matched,false);
const records=[
{id:"p1",title:"Residential plot",module:"Property Sale",location:"Srirampuram",value:"1cr",status:"Active",surveyNumber:"123",primaryContactId:"c1",createdAt:"2026-10-01",moduleData:{__transactionType:"Sale",__marketValue:"1.5cr",__settlementAmount:"80L",__followUpContactId:"c1"}},
{id:"p2",title:"Loan secured by plot",module:"Property Loans",location:"Bengaluru",value:"20L",status:"Open",contact:"Asha Rao",moduleData:{__transactionType:"Loan"}},
{id:"p3",title:"Unvalued land",module:"Agricultural Land",location:"Srirampuram",value:"",status:"Active",moduleData:{__transactionType:"Purchase"}}
];
const contacts=[
{id:"c1",name:"Asha Rao",phone:"+91 98765 43210",role:"Client",roles:["Buyer"],followUps:[{id:"f1",description:"Pay advance",status:"Awaiting response",promisedDate:"2026-10-30",linkedRecordId:"p1",updatedAt:"2026-10-30"}]},
{id:"c2",name:"Asha R.",phone:"9876543210",role:"Broker"}
];
const filters={query:"Asha 43210",location:"Srirampura",dealMax:"10000000",marketMax:"custom",marketCustom:"2cr",settlementMax:"",category:"All categories",module:"All modules",transactionType:"All transaction types",status:"Any status"};
const filtered=filterIntelligenceRecords(records,contacts,filters,[]);
assert.equal(filtered.length,1);
assert.equal(filtered[0].record.id,"p1");
assert.equal(filterIntelligenceRecords(records,contacts,{dealMax:"10000000"},[]).some(item=>item.record.id==="p3"),false);
assert.ok(buildIntelligenceDuplicateSignals(records,contacts).some(item=>item.kind==="contact"));
const opportunities=buildIntelligenceOpportunitySignals(records,contacts);
assert.ok(opportunities.some(item=>item.kind==="value-gap"));
assert.ok(opportunities.some(item=>item.kind==="loan"));
const exposure=buildIntelligenceExposure(records,[{type:"Receipt",amount:"10L"},{type:"Expense",amount:"2L"}]);
assert.equal(exposure.recordedNet,800000);
assert.equal(exposure.expectedSettlement,8000000);
assert.equal(buildIntelligenceStakeholderNetwork(records,contacts).find(item=>item.contact.id==="c1").recordCount,2);
assert.ok(buildIntelligenceLocationSummary(records).some(item=>item.location.includes("Srirampuram")));
const alerts=buildIntelligenceAlerts({today:"2026-11-03",tasks:[{id:"t1",title:"Call lender",date:"2026-11-02",done:false}],contacts,documents:[{id:"d1",name:"Sale deed",expiresOn:"2026-11-10"}]});
assert.ok(alerts.some(item=>item.kind==="task"));
assert.ok(alerts.some(item=>item.kind==="follow-up"));
assert.ok(alerts.some(item=>item.kind==="document"));
const feed=buildIntelligenceActivityFeed({record:records[0],tasks:[{id:"t2",title:"Site visit",date:"2026-11-01",propertyId:"p1",property:"Residential plot"}],financials:[{id:"m1",type:"Receipt",amount:"10L",date:"2026-11-02",propertyId:"p1"}]});
assert.ok(feed.some(item=>item.source==="Task"));
assert.ok(feed.some(item=>item.source==="Financial entry"));
console.log("AXIVESTRA Intelligence Suite engine tests passed.");
