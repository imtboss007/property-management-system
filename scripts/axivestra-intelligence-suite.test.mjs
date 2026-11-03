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

import {
  buildIntelligenceConflictSignals,buildIntelligenceOwnershipChains,buildIntelligencePropertyCashflow,
  buildIntelligenceLoanPropertyExposure,buildIntelligenceDocumentSearch,buildIntelligenceDecisionSupport
} from "../src/lib/intelligence-engine.mjs";
const chainRecords=[
 {id:"s1",title:"Survey 123 land",module:"Property Sale",location:"Srirampuram",value:"1cr",status:"Registered",surveyNumber:"123",ownershipDetails:"Owner A",createdAt:"2020-01-01",moduleData:{__marketValue:"1.5cr",__transactionType:"Sale",seller:"Owner A",buyer:"Owner B"}},
 {id:"s2",title:"Survey 123 loan",module:"Property Loans",location:"Srirampuram",value:"40L",status:"Open",surveyNumber:"123",ownershipDetails:"Owner C",moduleData:{__marketValue:"1.7cr",__transactionType:"Loan",__linkedPropertyId:"s1",outstandingBalance:"35L"}}
];
assert.ok(buildIntelligenceConflictSignals(chainRecords).some(item=>item.kind==="amount-conflict"));
assert.ok(buildIntelligenceConflictSignals(chainRecords).some(item=>item.kind==="ownership-conflict"));
assert.equal(buildIntelligenceOwnershipChains(chainRecords).length,1);
assert.equal(buildIntelligenceOwnershipChains(chainRecords)[0].entries.length,2);
const rentSummary=buildIntelligencePropertyCashflow([{id:"r1",title:"Rental building",module:"Property",location:"Bengaluru",value:"",status:"Active",moduleData:{}}],[{id:"f1",propertyId:"r1",property:"Rental building",type:"Rent",amount:"50k"},{id:"f2",propertyId:"r1",property:"Rental building",type:"Tenant Advance",amount:"1L"},{id:"f3",propertyId:"r1",property:"Rental building",type:"Maintenance",amount:"5k"}]);
assert.equal(rentSummary[0].rentReceived,50000);
assert.equal(rentSummary[0].tenantAdvances,100000);
assert.equal(rentSummary[0].operatingCosts,5000);
assert.equal(rentSummary[0].recordedNet,45000);
const linkedLoan=buildIntelligenceLoanPropertyExposure([...chainRecords,{id:"p-other",title:"Other plot",module:"Property",location:"Bengaluru",value:"2cr",status:"Active",moduleData:{}}]);
assert.equal(linkedLoan[0].linked,true);
assert.equal(linkedLoan[0].knownOutstanding,3500000);
assert.equal(buildIntelligenceDocumentSearch([{id:"doc1",name:"Sale Deed",category:"Legal",property:"Survey 123 land"}],"sale deed").length,1);
const readiness=buildIntelligenceDecisionSupport([{...chainRecords[0],primaryContactId:"c1"}],[{id:"c1",name:"Owner A",phone:"9999999999",role:"Owner"}],[{id:"d1",propertyId:"s1",name:"Sale Deed"}],[],[]]);
assert.ok(readiness[0].missing.includes("primary follow-up owner"));
