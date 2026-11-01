const fs = require("node:fs");
const assert = require("node:assert/strict");

const upgrades = fs.readFileSync("src/lib/axivestra-module-upgrades.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");
const localDb = fs.readFileSync("src/lib/local-db.ts", "utf8");
const workbench = fs.readFileSync("src/ModuleWorkbench.tsx", "utf8");
const deal = fs.readFileSync("src/lib/deal-structure.ts", "utf8");

const modules = [
  "Property Sale", "Property Loans", "JV / JDA / JD", "SR Rate Settlement",
  "Agricultural Land", "Commercial Land", "Startup", "Equity",
  "Unsecured Company Loan", "Personal Loan", "Housing Loan", "House Purchase",
  "Litigation", "Fund & Portfolio Management", "Investor Relations",
  "USDT Transaction Details"
];
for (const name of modules) {
  assert.ok(upgrades.includes(`"${name}": [`), `Missing requested module fields: ${name}`);
}
const repeatableGroups = [
  "loanCollateralProperties", "jvSettlementParties", "srSettlementParties",
  "srSettlementLocations", "agriConversionParcels", "agriSettlementParties",
  "commercialRentRoll", "startupFounders", "startupProjects", "startupCollateral",
  "equityShareholders", "equityFundingRounds", "equityEsop", "companyFinancialYears",
  "companyBounceHistory", "companyExistingLoans", "companyAssets", "personalExistingLoans",
  "personalLenderCriteria", "housingCollateralProperties", "housingLenderCriteria",
  "purchaseOwners", "purchasePayments", "litigationSettlementParties",
  "fundInvestors", "fundPortfolioInvestments", "fundTransactions",
  "fundPerformanceHistory", "investorPastInvestments", "investorCommunicationLog", "usdtPayments"
];
for (const key of repeatableGroups) {
  assert.ok(upgrades.includes(`key: "${key}"`), `Missing repeatable add/edit group: ${key}`);
}
assert.ok(app.includes("contactRoleFilter"), "Contacts role filter is not integrated");
assert.ok(app.includes("courtCaseAvailable"), "Litigation court decision gate is not integrated");
assert.ok(app.includes("hasEquityStructure"), "Equity must select entity structure before showing share-capital workflows");
assert.ok(app.includes("RepeatableModuleEditor"), "Repeatable editor must be integrated into the property record form");
assert.ok(app.includes("buildModuleSummary"), "Automatic module summaries must be integrated");
assert.ok(workbench.includes("Print / Save PDF"), "Module workbench must provide printable reports");
assert.ok(workbench.includes("onExportReport(filtered)"), "Reports must respect the current module filters");
assert.ok(localDb.includes('this.version(3).stores('), "IndexedDB sync-state migration is missing");
assert.ok(localDb.includes('syncState: "&key"'), "IndexedDB sync-state table is missing");
assert.ok(localDb.includes('delete("deviceSyncBaseline")'), "Device unlink must clear the sync baseline");
assert.ok(app.includes("await loadDeviceSyncBaseline()"), "PC/mobile sync must read the IndexedDB baseline");
assert.equal((app.match(/await saveDeviceSyncBaseline\(result\.baseline\)/g) || []).length, 2, "Both sync paths must persist the IndexedDB baseline");
assert.ok(!app.includes('localStorage.setItem("axivestra.deviceSyncBaseline"'), "Large sync baseline must not be written to localStorage");

console.log("AXIVESTRA module-upgrade coverage checks passed (" + modules.length + " modules and " + repeatableGroups.length + " repeatable groups).");

for (const token of [
  "DEAL / TRANSACTION STRUCTURE", "__transactionType", "What is this transaction?",
  "Sale", "Loan", "Sharing", "Settlement", "Gift", "10% gift + 90% balance sharing",
  "Percentage per month", "Percentage per year", "Fixed amount per month",
  "Monthly interest due day", "Monthly interest estimate", "transactionFilter",
  "Filter by transaction type", "All transactions", "updateTransactionAmountFields"
]) assert.ok(app.includes(token) || workbench.includes(token), "Missing universal deal / transaction form: " + token);
for (const token of [
  "calculateMonthlyInterest", "principal * rate / 100", "principal * rate / 1200",
  "getLoanPrincipalValue", "updateLoanPrincipalFields", "50:50", "60:40", "70:30",
  "10% gift + 90% balance sharing", "calculateSettlementBalance", "calculateSaleBalance"
]) assert.ok(deal.includes(token), "Missing deal structure / finance calculation: " + token);
assert.ok(workbench.includes("dealTransactionTypes") && workbench.includes("transactionFilter"), "Every module must have transaction-type filtering.");
console.log("AXIVESTRA universal transaction structure, loan interest, sharing presets, settlement and module filters passed.");
