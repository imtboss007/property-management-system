const fs = require("node:fs");
const assert = require("node:assert/strict");
const esbuild = require("esbuild");

async function main() {
  const source = fs.readFileSync("src/lib/axivestra-module-upgrades.tsx", "utf8");
  const compiled = await esbuild.transform(source, {
    loader: "tsx",
    format: "esm",
    target: "node22",
    jsx: "transform"
  });
  const moduleUrl = "data:text/javascript;base64," + Buffer.from(compiled.code).toString("base64");
  const { buildModuleSummary } = await import(moduleUrl);
  const summary = (moduleName, data) => Object.fromEntries(buildModuleSummary(moduleName, data).map(item => [item.label, item.value]));

  const sale = summary("Property Sale", {
    ownerSettlementAmount: "1000000",
    ownerAmountPaid: "250000",
    agreementHolderSettlementAmount: "2000000",
    agreementHolderAmountPaid: "500000",
    saleConversionParcels: JSON.stringify([
      { conversionType: "Commercial", extent: "1.5", conversionAmountNeeded: "100000" },
      { conversionType: "Industrial", extent: "0.5", conversionAmountNeeded: "80000" }
    ])
  });
  assert.equal(sale["Owner settlement balance"], "₹7,50,000");
  assert.equal(sale["Agreement holder settlement balance"], "₹15,00,000");
  assert.equal(sale["Conversion portion extent total"], "2");
  assert.equal(sale["Conversion amount required"], "₹1,80,000");

  const jv = summary("JV / JDA / JD", {
    jvSettlementParties: JSON.stringify([
      { partyName: "Owner", finalSettlement: "1000000", amountPaid: "250000" },
      { partyName: "Agreement holder", finalSettlement: "500000", amountPaid: "100000" }
    ])
  });
  assert.equal(jv["Party settlements total"], "₹15,00,000");
  assert.equal(jv["Party payments total"], "₹3,50,000");
  assert.equal(jv["Party settlement balances"], "₹11,50,000");

  const sr = summary("SR Rate Settlement", {
    srSettlementParties: JSON.stringify([
      { settlementAmount: "100000", amountPaid: "25000" },
      { settlementAmount: "50000", amountPaid: "10000" }
    ]),
    srSettlementLocations: JSON.stringify([
      { extent: "2", settlementRate: "10000" },
      { extent: "0.5", settlementRate: "20000" }
    ])
  });
  assert.equal(sr["Settlement parties total"], "₹1,50,000");
  assert.equal(sr["Settlement party balances"], "₹1,15,000");
  assert.equal(sr["Settlement locations total"], "₹30,000");

  const rent = summary("Commercial Land", {
    monthlyCurrentRent: "50000",
    monthlyProjectedRent: "60000",
    marketValue: "10000000"
  });
  assert.equal(rent["Annual current rent"], "₹6,00,000");
  assert.equal(rent["Annual projected rent"], "₹7,20,000");
  assert.equal(rent["Projected rental yield"], "7.20%");

  const housing = summary("Housing Loan", {
    lender: "Configured Bank",
    monthlyIncome: "300000",
    totalExistingMonthlyEmi: "50000",
    requiredLoanAmount: "5000000",
    cibilScore: "750",
    housingCollateralProperties: JSON.stringify([
      { marketValue: "10000000", mortgageOutstanding: "2000000" }
    ]),
    housingLenderCriteria: JSON.stringify([
      { lender: "Configured Bank", minimumCibil: "700", maximumFoir: "50", maximumLtv: "70", interestRate: "9", maximumTenureMonths: "240" }
    ])
  });
  assert.equal(housing["Total market value of listed properties"], "₹1,00,00,000");
  assert.equal(housing["Total existing mortgage outstanding"], "₹20,00,000");
  assert.equal(housing["Net available collateral value"], "₹80,00,000");
  assert.equal(housing["Estimated housing loan eligibility (configured lender)"], "₹56,00,000");
  assert.equal(housing["Requested loan LTV against net collateral"], "62.50%");

  const equity = summary("Equity", {
    equityLegalStructure: "Private Limited",
    preMoneyValuation: "100000000",
    equityFundingRequired: "20000000",
    totalSharesBefore: "1000",
    promoterSharesBefore: "800",
    newInvestorShares: "100",
    equityShareholders: JSON.stringify([
      { shareholderName: "Promoter", category: "Promoter", shares: "800" },
      { shareholderName: "Investor A", category: "Investor", shares: "200" }
    ]),
    fullyDilutedShares: "50"
  });
  assert.equal(equity["Promoter / founder holding"], "80.00%");
  assert.equal(equity["Investor holding"], "20.00%");
  assert.equal(equity["Calculated post-money valuation"], "₹12,00,00,000");
  assert.equal(equity["Promoter ownership after funding"], "72.73%");
  assert.equal(equity["Promoter dilution"], "7.27%");

  const usdt = summary("USDT Transaction Details", {
    usdtAmount: "1000",
    googleReferenceRate: "90",
    discountType: "Percentage",
    discountValue: "2",
    usdtPayments: JSON.stringify([
      { mode: "Cash", amount: "20000" },
      { mode: "RTGS", amount: "60000" },
      { mode: "NEFT", amount: "8200" }
    ])
  });
  assert.equal(usdt["Calculated final USDT rate"], "₹88.2");
  assert.equal(usdt["Calculated total transaction value"], "₹88,200");
  assert.equal(usdt["Cash payment total"], "₹20,000");
  assert.equal(usdt["RTGS payment total"], "₹60,000");
  assert.equal(usdt["NEFT / IMPS / UPI payment total"], "₹8,200");
  assert.equal(usdt["Payment difference / balance"], "₹0");

  const empty = summary("Property Loans", { loanCollateralProperties: JSON.stringify([{ propertyName: "No valuation entered" }]) });
  assert.equal(empty["Total market value of listed properties"], "N/A");
  assert.equal(empty["Net available collateral value"], "N/A");

  console.log("AXIVESTRA financial calculation tests passed (sale, JV, SR settlement, rent, lender eligibility, equity dilution, USDT and N/A handling).");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
