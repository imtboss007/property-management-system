import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarClock, CircleDollarSign, Clock3, Landmark, Users, Wallet } from "lucide-react";
import ThreeDHistogram from "./ThreeDHistogram";
import { calculateMonthlyInterest, formatINR, getLoanPrincipalValue, parseDealNumber } from "./lib/deal-structure";

type LoanRecord = {
  id:string; title:string; module:string; value:string; status:string; contact:string;
  primaryContactId?:string; followUpContactId?:string; moduleData:Record<string,string>;
};
type ContactFollowUp = { id:string; description:string; amount:string; promisedDate:string; promisedTime:string; status:string; linkedRecordId:string; };
type Contact = { id:string; name:string; phone:string; followUps?:ContactFollowUp[]; };
type Transaction = {
  id:string; propertyId?:string; contactId?:string; property:string; type:string;
  amount:string; date:string; party:string; reference:string; notes:string;
};
type Props = {
  properties:LoanRecord[]; contacts:Contact[]; financials:Transaction[];
  today:string; onOpenRecord:(id:string)=>void; onOpenContact:(id:string)=>void; onOpenTransaction:(id:string)=>void; onOpenFinancials:()=>void; onOpenTasks:()=>void; onOpenLoans:()=>void;
};
const LOAN_MODULES=new Set(["Property Loans","Unsecured Company Loan","Personal Loan","Housing Loan"]);
const INFLOW=new Set(["Sale","Advance","Loan Disbursal","Receipt"]);
const OUTFLOW=new Set(["Purchase","Loan Repayment","Interest","Instalment","Brokerage","Expense","Settlement"]);
const loansOnly=(rows:LoanRecord[])=>rows.filter(row=>LOAN_MODULES.has(row.module)||row.moduleData?.__transactionType==="Loan");
const principalOf=(row:LoanRecord)=>parseDealNumber(getLoanPrincipalValue(row.moduleData,row.value));
const rateOf=(row:LoanRecord)=>parseDealNumber(row.moduleData?.__loanInterestRate||row.moduleData?.interestRate||row.moduleData?.annualInterestRate||"0");
const interestOf=(row:LoanRecord)=>calculateMonthlyInterest(row.moduleData,parseDealNumber(row.value));
const linkedToRecord=(transaction:Transaction,row:LoanRecord)=>Boolean(transaction.propertyId&&transaction.propertyId===row.id);
const amount=(value:string)=>parseDealNumber(value);
const monthKey=(date:string)=>date.slice(0,7);
const monthLabel=(key:string)=>{const [y,m]=key.split("-").map(Number);return new Date(y,m-1,1).toLocaleDateString("en-IN",{month:"short"});};

export default function VestraFinance({properties,contacts,financials,today,onOpenRecord,onOpenContact,onOpenTransaction,onOpenFinancials,onOpenTasks,onOpenLoans}:Props){
  const loans=useMemo(()=>loansOnly(properties),[properties]);
  const [selectedLoanId,setSelectedLoanId]=useState("");
  const [selectedMonth,setSelectedMonth]=useState("");
  const [selectedInterestMonth,setSelectedInterestMonth]=useState("");
  const [projectionMonths,setProjectionMonths]=useState<3|6|12>(6);
  const [showPortfolioBreakdown,setShowPortfolioBreakdown]=useState(false);
  const selectedLoan=loans.find(row=>row.id===selectedLoanId)||loans[0];
  const loanTransactions=useMemo(()=>selectedLoan?financials.filter(item=>linkedToRecord(item,selectedLoan)).sort((a,b)=>b.date.localeCompare(a.date)):[],[financials,selectedLoan]);
  const recentMonths=useMemo(()=>{
    const [year,month]=today.split("-").map(Number);
    return Array.from({length:6},(_,index)=>{const date=new Date(year,month-1-(5-index),1);return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0");});
  },[today]);
  const cashflow=useMemo(()=>recentMonths.map(key=>{
    const rows=financials.filter(item=>monthKey(item.date)===key);
    return {id:key,name:monthLabel(key),fullName:new Date(Number(key.slice(0,4)),Number(key.slice(5,7))-1,1).toLocaleDateString("en-IN",{month:"long",year:"numeric"}),value:rows.filter(item=>INFLOW.has(item.type)).reduce((sum,item)=>sum+amount(item.amount),0),secondaryValue:rows.filter(item=>OUTFLOW.has(item.type)).reduce((sum,item)=>sum+amount(item.amount),0)};
  }),[recentMonths,financials]);
  const visibleMonth=selectedMonth||recentMonths[recentMonths.length-1];
  const monthTransactions=financials.filter(item=>monthKey(item.date)===visibleMonth).sort((a,b)=>b.date.localeCompare(a.date));
  const totalInflow=financials.filter(item=>INFLOW.has(item.type)).reduce((sum,item)=>sum+amount(item.amount),0);
  const totalOutflow=financials.filter(item=>OUTFLOW.has(item.type)).reduce((sum,item)=>sum+amount(item.amount),0);
  const portfolioInterest=loans.reduce((sum,row)=>sum+interestOf(row),0);
  const monthlyInterest=selectedLoan?interestOf(selectedLoan):0;
  const principal=selectedLoan?principalOf(selectedLoan):0;
  const outstanding=selectedLoan?.moduleData?.outstandingPrincipal||selectedLoan?.moduleData?.outstandingAmount||"";
  const loanContact=selectedLoan?contacts.find(person=>person.id===(selectedLoan.followUpContactId||selectedLoan.primaryContactId)):undefined;
  const followUps=(loanContact?.followUps||[]).filter(item=>selectedLoan&&item.linkedRecordId===selectedLoan.id&&!["completed","closed","settled","rejected","cancelled"].includes(String(item.status||"").toLowerCase()));
  const received=loanTransactions.filter(item=>INFLOW.has(item.type)).reduce((sum,item)=>sum+amount(item.amount),0);
  const paid=loanTransactions.filter(item=>OUTFLOW.has(item.type)).reduce((sum,item)=>sum+amount(item.amount),0);
  const method=selectedLoan?.moduleData?.__loanInterestMethod||(selectedLoan?.moduleData?.annualInterestRate?"Percentage per year":"Percentage per month");
  const interestStartDate=selectedLoan?.moduleData?.targetDisbursementDate||selectedLoan?.moduleData?.firstEmiDate||"";
  const interestEndDate=selectedLoan?.moduleData?.maturityDate||today;
  const monthWiseInterest=useMemo(()=>{
    if(!selectedLoan||!interestStartDate)return [];
    const start=new Date(interestStartDate+"T00:00:00");
    const end=new Date(interestEndDate+"T00:00:00");
    if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start>end)return [];
    const cursor=new Date(start.getFullYear(),start.getMonth(),1);
    const last=new Date(end.getFullYear(),end.getMonth(),1);
    const rows:Array<{id:string;name:string;fullName:string;value:number}>=[];
    while(cursor<=last&&rows.length<120){
      const key=cursor.getFullYear()+"-"+String(cursor.getMonth()+1).padStart(2,"0");
      rows.push({id:key,name:cursor.toLocaleDateString("en-IN",{month:"short"}),fullName:cursor.toLocaleDateString("en-IN",{month:"long",year:"numeric"}),value:monthlyInterest});
      cursor.setMonth(cursor.getMonth()+1);
    }
    return rows.slice(-12);
  },[selectedLoan?.id,interestStartDate,interestEndDate,monthlyInterest]);
  const selectedInterestRow=monthWiseInterest.find(row=>row.id===selectedInterestMonth);
  const isInterestReceivable=selectedLoan?.moduleData?.__loanDirection==="Loan I am giving / interest receivable";
  const projectedCollection=isInterestReceivable?monthlyInterest*projectionMonths:0;
  const trendItems=loans.slice(0,8).map(row=>({id:row.id,name:(row.title||row.module).slice(0,13),fullName:row.title||row.module,value:principalOf(row),secondaryValue:interestOf(row),color:"#c49370",secondaryColor:"#39d6a2"}));
  return <section className="vs-finance-space">
    <header className="vs-space-page-header"><div><span className="vs-eyebrow">FINANCIAL INTELLIGENCE ENGINE</span><h3>Capital, interest and recorded movement</h3><p>Every amount below comes from saved loan terms or financial transactions. A missing balance remains unreported instead of being inferred.</p></div><Landmark size={23}/></header>
    <div className="vs-finance-metrics">
      <button type="button" onClick={onOpenLoans}><span>Loans tracked</span><strong>{loans.length}</strong><small>Existing loan modules</small></button>
      <button type="button" aria-expanded={showPortfolioBreakdown} onClick={()=>setShowPortfolioBreakdown(value=>!value)}><span>Current monthly loan interest</span><strong>{formatINR(portfolioInterest)}</strong><small>{showPortfolioBreakdown?"Hide loan-by-loan calculation":"Click to inspect each saved loan"}</small></button>
      <button type="button" onClick={onOpenFinancials}><span>Recorded inflows</span><strong>{formatINR(totalInflow)}</strong><small>All saved inflow categories</small></button>
      <button type="button" onClick={onOpenFinancials}><span>Recorded outflows</span><strong>{formatINR(totalOutflow)}</strong><small>All saved outflow categories</small></button>
    </div>
    {showPortfolioBreakdown&&<section className="vs-finance-panel vs-finance-breakdown"><header><div><span className="vs-eyebrow">TRACEABLE CALCULATION BREAKDOWN</span><h4>Monthly interest by source loan</h4><p>Each row uses the current saved principal, interest method and rate. Select a row to open its source record.</p></div></header><div className="vs-finance-transactions">{loans.map(row=><button type="button" key={row.id} onClick={()=>onOpenRecord(row.id)}><span className="vs-finance-up"><Landmark size={13}/></span><span><strong>{row.title||row.module}</strong><small>{row.module} · Principal {formatINR(principalOf(row))} · Rate {rateOf(row)}%</small></span><em>{formatINR(interestOf(row))} / month</em><ArrowUpRight size={13}/></button>)}</div></section>}
    <section className="vs-finance-panel">
      <header><div><span className="vs-eyebrow">KINETIC CASHFLOW</span><h4>Recorded monthly movement</h4><p>Blue-green bars are saved inflows; coral bars are saved outflows. Empty months show no matching transaction in the register.</p></div><CircleDollarSign size={20}/></header>
      <ThreeDHistogram items={cashflow} selected={visibleMonth} onSelect={setSelectedMonth} showLabels={false} formatValue={value=>value>=10000000?"₹"+(value/10000000).toFixed(1)+"Cr":value>=100000?"₹"+(value/100000).toFixed(1)+"L":"₹"+Math.round(value).toLocaleString("en-IN")}/>
      <div className="vs-finance-legend"><span><i className="inflow"/> Recorded inflows</span><span><i className="outflow"/> Recorded outflows</span><strong>{new Date(Number(visibleMonth.slice(0,4)),Number(visibleMonth.slice(5,7))-1,1).toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</strong></div>
      <div className="vs-finance-transactions">{monthTransactions.map(item=><button type="button" key={item.id} onClick={()=>onOpenTransaction(item.id)}><span className={INFLOW.has(item.type)?"vs-finance-up":"vs-finance-down"}>{INFLOW.has(item.type)?<ArrowUpRight size={15}/>:<ArrowDownRight size={15}/>}</span><span><strong>{item.type} · {item.party||item.property||"Transaction"}</strong><small>{item.date} · {item.property||"No linked property"} · {item.reference||"No reference"}</small></span><em>{formatINR(amount(item.amount))}</em></button>)}{!monthTransactions.length&&<div className="vs-empty-state"><Wallet size={22}/><strong>No transactions recorded for this month.</strong><small>This is a true empty result, not a generated placeholder.</small></div>}</div>
    </section>
    <section className="vs-finance-panel">
      <header><div><span className="vs-eyebrow">LOAN INTELLIGENCE</span><h4>Loan-wise interest exposure</h4><p>Choose a saved loan to inspect its principal, interest convention, payment entries and assigned follow-up owner.</p></div><Wallet size={20}/></header>
      {loans.length?<div className="vs-finance-loan-layout">
        <div className="vs-finance-loan-list">{loans.map(row=><button type="button" key={row.id} className={(selectedLoan?.id===row.id?"active":"")} onClick={()=>setSelectedLoanId(row.id)}><span>{row.module}</span><strong>{row.title||"Untitled loan"}</strong><small>{formatINR(interestOf(row))} / month</small></button>)}</div>
        {selectedLoan&&<div className="vs-finance-loan-detail">
          <div className="vs-finance-loan-title"><div><span className="vs-eyebrow">SELECTED LOAN</span><h4>{selectedLoan.title||selectedLoan.module}</h4><small>{selectedLoan.module} · {selectedLoan.status||"Status not entered"}</small></div><button type="button" onClick={()=>onOpenRecord(selectedLoan.id)}>Open source record <ArrowUpRight size={14}/></button></div>
          <div className="vs-finance-loan-facts">
            <article><span>Principal</span><strong>{formatINR(principal)}</strong><small>Source: saved loan principal</small></article>
            <article><span>Rate</span><strong>{rateOf(selectedLoan)}{method==="Fixed amount per month"?" ₹":" %"}</strong><small>{method}</small></article>
            <article><span>Monthly interest</span><strong>{formatINR(monthlyInterest)}</strong><small>Existing AXIVESTRA formula</small></article>
            <button type="button" className="vs-finance-fact-button" onClick={()=>onOpenRecord(selectedLoan.id)}><span>Outstanding balance</span><strong>{outstanding?formatINR(amount(outstanding)):"Not entered"}</strong><small>{outstanding?"Open source record · saved outstanding field":"Open source record · no supported outstanding figure saved"}</small></button>
            <article><span>Recorded receipts</span><strong>{formatINR(received)}</strong><small>Directly linked inflow transactions</small></article>
            <article><span>Recorded payments</span><strong>{formatINR(paid)}</strong><small>Directly linked outflow transactions</small></article>
          </div>
          <div className="vs-finance-loan-meta"><span><Clock3 size={14}/> Interest period start: {interestStartDate||"Not entered"}</span><span><CalendarClock size={14}/> Interest period end / maturity: {selectedLoan.moduleData?.maturityDate||"Not entered"}</span><span><Users size={14}/> Follow-up owner: {loanContact?.name||"Not assigned"}</span><span>Tenure: {selectedLoan.moduleData?.tenureMonths||"Not entered"} month(s)</span></div>
          <div className="vs-finance-followups"><strong>Open follow-up assignments</strong>{followUps.map(item=><button type="button" key={item.id} onClick={()=>loanContact?onOpenContact(loanContact.id):onOpenTasks()}><span>{item.description||"Follow-up"}</span><small>{item.promisedDate||"No date"} {item.promisedTime||""} · {item.status}</small><em>{item.amount?formatINR(amount(item.amount)):"No amount"}</em></button>)}{!followUps.length&&<small>No open Contact 360 commitment is linked to this loan's assigned contact.</small>}</div>
          <div className="vs-finance-history"><strong>Payment history (linked transactions only)</strong>{loanTransactions.map(item=><button type="button" key={item.id} onClick={()=>onOpenTransaction(item.id)}><span>{item.date} · {item.type}</span><em>{formatINR(amount(item.amount))}</em></button>)}{!loanTransactions.length&&<small>No financial transaction with this loan's record ID is linked.</small>}</div>
        </div>}
      </div>:<div className="vs-empty-state"><Wallet size={22}/><strong>No saved loan records yet.</strong><small>Existing property/personal/company/housing loan modules populate this panel.</small><button type="button" onClick={onOpenLoans}>Open loan module</button></div>}
    </section>
    {trendItems.length>0&&<section className="vs-finance-panel"><header><div><span className="vs-eyebrow">PRINCIPAL VS INTEREST</span><h4>Principal and monthly interest by loan</h4><p>Both bars use saved INR figures. Interest is calculated with AXIVESTRA’s current saved method; no missing historical payment allocation is invented.</p></div><ArrowUpRight size={20}/></header><ThreeDHistogram items={trendItems} selected={selectedLoan?.id||""} onSelect={setSelectedLoanId} primaryLabel="Saved principal" secondaryLabel="Monthly interest" formatValue={value=>formatINR(value)}/></section>}
    {selectedLoan&&<section className="vs-finance-panel"><header><div><span className="vs-eyebrow">MONTH-WISE INTEREST</span><h4>{selectedLoan.title||selectedLoan.module}</h4><p>Illustrative monthly run-rate from the saved interest period and current terms. It is not a reconstructed historical accrual ledger.</p></div><CalendarClock size={20}/></header>{monthWiseInterest.length?<><ThreeDHistogram items={monthWiseInterest} selected={selectedInterestMonth} onSelect={setSelectedInterestMonth} primaryLabel="Monthly interest run-rate" showLabels={false} formatValue={value=>formatINR(value)}/><div className="vs-finance-legend"><span>Saved start: {interestStartDate}</span><span>End / maturity: {selectedLoan.moduleData?.maturityDate||today}</span><strong>{selectedInterestRow?selectedInterestRow.fullName+" · "+formatINR(selectedInterestRow.value):"Select a month"}</strong></div></>:<div className="vs-empty-state"><CalendarClock size={22}/><strong>Interest period dates are incomplete.</strong><small>Enter a disbursement or first-EMI date in the source loan module to show a month-wise run-rate preview. No date is inferred.</small></div>}</section>}
    {selectedLoan&&<section className="vs-finance-panel"><header><div><span className="vs-eyebrow">COLLECTION SCENARIO</span><h4>Potential interest collections</h4><p>Available only for a loan marked “Loan I am giving / interest receivable”. This is a simple run-rate projection, not a promised collection.</p></div><CircleDollarSign size={20}/></header>{isInterestReceivable?<><div className="vs-projection-switch">{([3,6,12] as const).map(months=><button type="button" className={projectionMonths===months?"active":""} key={months} onClick={()=>setProjectionMonths(months)}>{months} months</button>)}</div><div className="vs-projection-result"><span>Potential interest over {projectionMonths} months</span><strong>{formatINR(projectedCollection)}</strong><small>{formatINR(monthlyInterest)} monthly run-rate × {projectionMonths}. Assumes unchanged principal and rate.</small></div></>:<div className="vs-empty-state"><Wallet size={22}/><strong>Collection projection is not enabled for this loan direction.</strong><small>Set the source record’s direction to “Loan I am giving / interest receivable” to show a collection run-rate.</small></div>}</section>}
    <small className="vs-data-truth">Simple-interest/compound-interest history is not reconstructed from missing dates or payment allocation. This view separates saved balances, calculated monthly interest and recorded payments.</small>
  </section>;
}
