export type UpgradeField = {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "number" | "date" | "select" | "textarea";
  options?: string[];
};

export type RepeatableField = {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "number" | "date" | "select";
  options?: string[];
};

export type RepeatableGroup = {
  key: string;
  title: string;
  description: string;
  addLabel: string;
  fields: RepeatableField[];
};

const text = (key: string, label: string, placeholder = ""): UpgradeField => ({ key, label, placeholder, type: "text" });
const money = (key: string, label: string, placeholder = "Amount in ₹"): UpgradeField => ({ key, label, placeholder, type: "number" });
const number = (key: string, label: string, placeholder = "Enter value"): UpgradeField => ({ key, label, placeholder, type: "number" });
const date = (key: string, label: string): UpgradeField => ({ key, label, placeholder: "Select date", type: "date" });
const select = (key: string, label: string, options: string[], placeholder = "Select"): UpgradeField => ({ key, label, placeholder, type: "select", options });

const propertyValuation = [
  money("srValue", "SR / Sub-Registrar value (₹)"),
  money("guidelineValue", "Government guideline value (₹)"),
  money("marketValue", "Current market value (₹)")
];

export const axivestraModuleFields: Record<string, UpgradeField[]> = {
  "Property Sale": [
    text("saleTransactionType", "Transaction type", "Absolute sale / agreement / assignment"),
    money("ownerSettlementAmount", "Owner final settlement amount (₹)"),
    money("ownerAmountPaid", "Amount already paid to owner (₹)"),
    money("agreementHolderSettlementAmount", "Agreement holder settlement amount (₹)"),
    money("agreementHolderAmountPaid", "Amount already paid to agreement holder (₹)"),
    select("landConversionStatus", "Land conversion status", ["Converted", "Not converted", "Partly converted", "Not applicable"]),
    select("conversionType", "Conversion type", ["Agricultural", "Commercial", "Industrial", "Residential", "Multiple types", "Not applicable"]),
    number("convertedExtent", "Converted extent", "Extent already converted"),
    number("unconvertedExtent", "Unconverted extent", "Extent pending conversion"),
    ...propertyValuation
  ],
  "Property Loans": [
    text("facilityPurpose", "Loan purpose", "Purchase / LAP / business / construction / debt consolidation"),
    number("propertyCount", "Number of collateral properties", "Calculated from property list"),
    money("totalExistingMortgage", "Total existing mortgage / loan outstanding (₹)"),
    money("monthlyRentalIncome", "Monthly rental income from collateral (₹)"),
    money("totalMonthlyEmi", "Total existing monthly EMI (₹)"),
    number("cibilScore", "CIBIL score", "If available"),
    number("requestedLtv", "Expected LTV (%)"),
    ...propertyValuation
  ],
  "JV / JDA / JD": [
    select("settlementRequestedBy", "Who is asking settlement / goodwill?", ["Owner only", "Agreement holder only", "Both owner and agreement holder", "Other parties", "All parties"]),
    money("ownerGoodwillAsked", "Owner goodwill asked (₹)"),
    money("ownerAdvanceAsked", "Owner advance asked (₹)"),
    money("ownerFinalSettlement", "Owner final settlement (₹)"),
    money("ownerAlreadyPaid", "Owner amount already paid (₹)"),
    money("agreementHolderGoodwillAsked", "Agreement holder goodwill asked (₹)"),
    money("agreementHolderAdvanceAsked", "Agreement holder advance asked (₹)"),
    money("agreementHolderFinalSettlement", "Agreement holder final settlement (₹)"),
    money("agreementHolderAlreadyPaid", "Agreement holder amount already paid (₹)"),
    select("jvConversionStatus", "Land conversion status", ["Converted", "Not converted", "Partly converted", "Not applicable"]),
    select("jvConversionType", "Conversion type", ["Agricultural", "Commercial", "Industrial", "Residential", "Multiple types", "Not applicable"]),
    number("jvConvertedExtent", "Converted extent"),
    number("jvUnconvertedExtent", "Unconverted extent"),
    money("conversionCostEstimate", "Estimated conversion amount required (₹)"),
    date("expectedReturnDate", "Expected project return / settlement date")
  ],
  "SR Rate Settlement": [
    select("rateSettlementUnit", "Settlement area unit", ["sq ft", "sq yd", "sq m", "acre", "gunta", "hectare", "cent"]),
    money("srRatePerUnit", "SR rate per unit (₹)"),
    money("marketRatePerUnit", "Market rate per unit (₹)"),
    money("settlementRatePerUnit", "Settlement rate per unit (₹)"),
    number("settlementExtent", "Settlement extent / size"),
    money("totalSettlementDemand", "Total amount demanded by all parties (₹)"),
    money("totalSettlementPaid", "Total amount already paid (₹)")
  ],
  "Agricultural Land": [
    select("landConversionStatus", "Land conversion status", ["Converted", "Not converted", "Partly converted"]),
    select("conversionType", "Conversion type", ["Commercial", "Industrial", "Residential", "Multiple types", "Not applicable"]),
    number("convertedExtent", "Already converted extent"),
    number("unconvertedExtent", "Extent still requiring conversion"),
    money("conversionCostEstimate", "Estimated amount required for conversion (₹)"),
    money("ownerSettlementAmount", "Owner settlement amount (₹)"),
    money("ownerAmountPaid", "Owner amount already paid (₹)"),
    money("agreementHolderSettlementAmount", "Agreement holder settlement amount (₹)"),
    money("agreementHolderAmountPaid", "Agreement holder amount already paid (₹)"),
    ...propertyValuation
  ],
  "Commercial Land": [
    money("ownerSettlementAmount", "Owner settlement amount (₹)"),
    money("ownerAmountPaid", "Owner amount already paid (₹)"),
    money("monthlyCurrentRent", "Current monthly rent (₹)"),
    money("monthlyProjectedRent", "Projected monthly rent (₹)"),
    money("annualCurrentRent", "Annual current rent (₹)"),
    money("annualProjectedRent", "Annual projected rent (₹)"),
    text("rentStatus", "Rental status", "Vacant / occupied / leased"),
    date("rentAgreementExpiry", "Rent agreement expiry"),
    ...propertyValuation
  ],
  "Startup": [
    text("companyLegalName", "Registered company name"),
    select("registrationType", "Registration type", ["Private Limited", "Public Limited", "LLP", "Partnership", "Proprietorship", "Section 8", "Not yet registered"]),
    text("cinLlpin", "CIN / LLPIN"),
    text("companyPan", "Company PAN"),
    text("companyGst", "GST number"),
    date("incorporationDate", "Incorporation date"),
    text("registeredAddress", "Registered address"),
    text("businessModel", "Business model"),
    text("productsServices", "Products / services"),
    text("companyProfile", "Company profile / business description"),
    text("dpiitStatus", "DPIIT recognition status"),
    text("msmeStatus", "MSME / Udyam status"),
    text("isoLicences", "ISO / licences / certifications"),
    number("employeeCount", "Number of employees"),
    text("infrastructureMachinery", "Infrastructure / machinery"),
    number("manufacturingCapacity", "Manufacturing capacity"),
    money("annualTurnover", "Current annual turnover (₹)"),
    money("annualRevenue", "Annual revenue (₹)"),
    money("annualProfitLoss", "Profit / loss after tax (₹)"),
    money("operatingExpenses", "Operating expenses (₹)"),
    money("existingLiabilities", "Existing liabilities (₹)"),
    money("fundingRequired", "Funding required (₹)"),
    select("fundingType", "Funding type", ["Equity", "Debt", "Convertible", "Grant", "Project finance", "Working capital", "Collateral-backed loan", "Mixed"]),
    money("promoterContribution", "Promoter contribution (₹)"),
    money("companyValuation", "Current / proposed valuation (₹)"),
    text("fundUtilisation", "Use of funds"),
    money("projectCost", "Total project cost (₹)"),
    date("projectStartDate", "Project start date"),
    date("projectCompletionDate", "Expected project completion"),
    money("collateralExistingMortgage", "Existing collateral mortgage outstanding (₹)"),
    money("collateralNetAvailable", "Net available collateral value (₹)"),
    date("expectedFundingReturnDate", "Expected funding return / repayment date"),
    text("fundingRepaymentPlan", "Expected repayment / exit plan"),
    text("companyShareholdingSummary", "Shareholding summary"),
    text("companyDocumentStatus", "Document availability / missing documents")
  ],
  "Equity": [
    select("equityLegalStructure", "Entity legal structure", ["Private Limited", "Public Limited", "LLP", "Partnership", "Proprietorship", "Other"]),
    money("authorisedShareCapital", "Authorised share capital (₹)"),
    money("issuedShareCapital", "Issued share capital (₹)"),
    money("subscribedShareCapital", "Subscribed share capital (₹)"),
    money("paidUpShareCapital", "Paid-up share capital (₹)"),
    number("faceValuePerShare", "Face value per share (₹)"),
    number("currentSharePrice", "Current / proposed price per share (₹)"),
    number("totalSharesBefore", "Total shares before investment"),
    number("newInvestorShares", "New investor shares"),
    money("equityFundingRequired", "Equity funding requirement (₹)"),
    number("equityOfferedPercent", "Equity offered (%)"),
    money("preMoneyValuation", "Pre-money valuation (₹)"),
    money("postMoneyValuation", "Post-money valuation (₹)"),
    money("totalDebt", "Total company debt (₹)"),
    money("shareholdersEquity", "Shareholders' equity (₹)"),
    money("netProfitForRatios", "Net profit for ratios (₹)"),
    money("averageShareholdersEquity", "Average shareholders' equity (₹)"),
    money("earningsAvailableToEquity", "Earnings available to equity shareholders (₹)"),
    number("weightedAverageShares", "Weighted average shares"),
    number("marketPricePerShare", "Market price per share (₹)"),
    money("investmentGain", "Investment gain (₹)"),
    money("investmentCost", "Investment cost (₹)"),
    text("equityCompanyName", "Company / entity legal name"),
    text("equityRegistrationNumber", "CIN / LLPIN / registration number"),
    text("equityIndustry", "Industry / sector"),
    number("promoterSharesBefore", "Promoter shares before funding"),
    number("fullyDilutedShares", "Fully diluted additional shares (options / warrants / convertibles)"),
    number("esopPoolPercent", "ESOP pool (%)"),
    number("esopAllocatedPercent", "ESOP allocated (%)"),
    text("shareClasses", "Share classes / instruments", "Equity / preference / convertible / options / warrants")
  ],
  "Unsecured Company Loan": [
    select("businessType", "Business constitution", ["Proprietorship", "Partnership", "LLP", "Private Limited", "Public Limited", "Other"]),
    number("yearsInOperation", "Years in operation"),
    money("averageMonthlyTurnover", "Average monthly turnover (₹)"),
    money("currentMonthlyTurnover", "Current monthly turnover (₹)"),
    money("grossProfit", "Gross profit (₹)"),
    money("ebitda", "EBITDA (₹)"),
    money("profitAfterTax", "Profit / loss after tax (₹)"),
    money("totalExistingLoanOutstanding", "Total existing loan outstanding (₹)"),
    money("totalMonthlyEmi", "Total monthly EMI (₹)"),
    money("totalOverdues", "Total overdue amount (₹)"),
    money("creditCardOutstanding", "Credit card outstanding (₹)"),
    money("stockPurchaseValue", "Stock purchase cost (₹)"),
    money("stockMarketValue", "Stock estimated market value (₹)"),
    money("machineryValue", "Machinery and equipment value (₹)"),
    money("propertyAssetValue", "Property / land asset value (₹)"),
    money("monthlyRentalIncome", "Monthly rental income (₹)"),
    money("averageMonthlyBankBalance", "Average monthly bank balance (₹)"),
    money("monthlyBankCredits", "Monthly bank credits (₹)"),
    money("monthlyBankDebits", "Monthly bank debits (₹)"),
    number("chequeBouncesLast3Years", "Cheque bounces — last 3 years"),
    number("emiBouncesLast3Years", "EMI bounces — last 3 years"),
    money("expectedUnsecuredLoan", "Expected unsecured loan amount (₹)"),
    text("loanPurpose", "Loan purpose", "Working capital / expansion / machinery / other"),
    number("preferredTenureMonths", "Preferred loan tenure (months)"),
    money("availableMonthlyCashflow", "Available monthly cash flow (₹)"),
    money("monthlyNetIncome", "Monthly net business income (₹)"),
    money("monthlyOperatingExpenses", "Monthly operating expenses (₹)"),
    money("ownerCapital", "Owner / partner capital (₹)"),
    money("otherBusinessLiabilities", "Other business liabilities (₹)")
  ],
  "Personal Loan": [
    money("monthlyIncome", "Monthly salary / income (₹)"),
    money("annualIncome", "Annual income (₹)"),
    money("otherIncome", "Other monthly income (₹)"),
    money("rentalIncome", "Monthly rental income (₹)"),
    number("cibilScore", "CIBIL score"),
    date("cibilLastUpdated", "CIBIL last updated"),
    money("totalExistingMonthlyEmi", "Total existing monthly EMI (₹)"),
    money("totalExistingOutstanding", "Total existing loan outstanding (₹)"),
    money("totalOverdueAmount", "Current pending overdue amount (₹)"),
    number("daysPastDue", "Days past due (DPD)"),
    number("emiBounces3Years", "EMI bounces — last 3 years"),
    number("chequeBounces3Years", "Cheque bounces — last 3 years"),
    money("creditCardLimitTotal", "Total credit card limit (₹)"),
    money("creditCardOutstandingTotal", "Total credit card outstanding (₹)"),
    money("creditCardMinimumDue", "Total credit card minimum due (₹)"),
    money("personalLoanRequired", "Personal loan required (₹)"),
    text("personalLoanPurpose", "Loan purpose"),
    number("preferredTenureMonths", "Preferred tenure (months)"),
    money("averageMonthlyBankBalance", "Average monthly bank balance (₹)"),
    text("cibilDefaultsSettlements", "Defaults / settlements / write-offs"),
    text("repaymentCapacityNotes", "Repayment capacity notes")
  ],
  "Housing Loan": [
    money("monthlyIncome", "Monthly household income (₹)"),
    money("annualIncome", "Annual income (₹)"),
    money("businessMonthlyTurnover", "Current monthly business turnover (₹)"),
    money("businessProfitLoss", "Latest annual business profit / loss (₹)"),
    money("rentalIncome", "Monthly rental income (₹)"),
    money("totalExistingMonthlyEmi", "Total existing monthly EMI (₹)"),
    money("totalExistingLoanOutstanding", "Total existing loan outstanding (₹)"),
    money("totalOverdueAmount", "Current overdue amount (₹)"),
    number("cibilScore", "CIBIL score"),
    date("cibilLastUpdated", "CIBIL last updated"),
    number("emiBounces3Years", "EMI bounces — last 3 years"),
    number("chequeBounces3Years", "Cheque bounces — last 3 years"),
    money("requiredLoanAmount", "Required housing / property loan (₹)"),
    number("expectedLoanTenureMonths", "Expected loan tenure (months)"),
    money("totalSrValue", "Total SR value of linked properties (₹)"),
    money("totalGuidelineValue", "Total guideline value of linked properties (₹)"),
    money("totalMarketValue", "Total market value of linked properties (₹)"),
    money("totalMortgageOutstanding", "Total property mortgage outstanding (₹)"),
    money("netAvailablePropertyValue", "Net available property value (₹)"),
    number("lenderLtvPercent", "Lender LTV (%)"),
    text("propertyDocumentChecklist", "Property documents available / pending")
  ],
  "House Purchase": [
    money("totalAgreedPurchaseAmount", "Total agreed purchase amount (₹)"),
    money("totalAdvancePaid", "Advance already paid (₹)"),
    date("advancePaymentDate", "Advance payment date"),
    money("ownerFinalSettlement", "Owner final settlement amount (₹)"),
    money("amountAlreadyPaidToOwner", "Amount already paid to owner (₹)"),
    money("pendingOwnerSettlement", "Pending owner settlement (₹)"),
    money("ownContribution", "Applicant own contribution (₹)"),
    money("requiredPurchaseLoan", "Required purchase loan (₹)"),
    number("expectedLoanTenureMonths", "Expected loan tenure (months)"),
    text("purchaseType", "Purchase type", "Ready-to-move / resale / under construction / new"),
    text("propertyDocumentStatus", "Property documents available / pending")
  ],
  "Litigation": [
    select("courtCaseAvailable", "Matter going to court?", ["Yes", "No"]),
    text("disputeNature", "Nature of dispute"),
    select("disputePropertyType", "Property type", ["Agricultural", "Industrial", "Commercial", "Residential", "Other"]),
    text("disputeLandClassification", "Current land classification"),
    number("disputeLandExtent", "Property extent / built-up area"),
    select("disputeLandAreaUnit", "Area unit", ["sq ft", "sq yd", "sq m", "acre", "gunta", "hectare", "cent"]),
    money("disputeSrValue", "SR / Sub-Registrar value (₹)"),
    money("disputeGuidelineValue", "Government guideline value (₹)"),
    money("disputeMarketValue", "Actual market value (₹)"),
    text("caseMainIssue", "Main issue / reason for dispute"),
    text("caseNumberCnr", "Case number / CNR"),
    text("courtName", "Court / tribunal"),
    text("courtCaseType", "Case type"),
    date("caseFilingDate", "Filing date"),
    text("currentCourtStage", "Current court stage"),
    date("nextHearingDate", "Next hearing date"),
    text("interimOrderStatus", "Interim order / injunction status"),
    money("advocateFees", "Advocate fees (₹)"),
    money("courtFees", "Court fees (₹)"),
    money("documentationExpenses", "Documentation expenses (₹)"),
    money("estimatedLitigationCost", "Estimated litigation cost (₹)"),
    money("totalAmountClaimed", "Total amount claimed (₹)"),
    money("actualAmountPayable", "Actual amount payable (₹)"),
    money("ownerSettlementAmount", "Owner settlement amount (₹)"),
    money("agreementHolderSettlementAmount", "Agreement holder settlement amount (₹)"),
    money("otherPartySettlementAmount", "Other parties settlement amount (₹)"),
    money("amountAlreadyPaid", "Total amount already paid (₹)"),
    money("registrationConversionExpenses", "Registration / conversion expenses (₹)"),
    select("landConversionStatus", "Property conversion status", ["Converted", "Not converted", "Partly converted", "Not applicable"]),
    select("conversionType", "Conversion type required", ["Agricultural", "Commercial", "Industrial", "Residential", "Multiple types", "Not applicable"]),
    text("legalIssuesAndRisks", "Legal issues / pending actions")
  ],
  "Fund & Portfolio Management": [
    select("fundType", "Fund type", ["Equity", "Debt", "Venture Capital", "Private Equity", "Real Estate", "Hybrid"]),
    money("totalFundSize", "Total fund size (₹)"),
    money("availableFunds", "Available funds (₹)"),
    money("committedCapitalTotal", "Committed capital (₹)"),
    money("investedCapitalTotal", "Invested capital (₹)"),
    money("pendingCommitments", "Pending investor commitments (₹)"),
    money("dividendsInterestReceived", "Dividends / interest received (₹)"),
    money("realisedGains", "Realised gains (₹)"),
    money("unrealisedGains", "Unrealised gains (₹)"),
    money("fundOutstandingLoans", "Outstanding fund loans (₹)"),
    money("fundInterestPayable", "Interest payable (₹)"),
    date("fundStartDate", "Fund start date"),
    date("fundEndDate", "Fund duration / end date"),
    text("fundComplianceStatus", "Compliance / regulatory status")
  ],
  "Investor Relations": [
    text("investorCompanyName", "Investor company / fund name"),
    text("investorContactPerson", "Contact person"),
    text("investorWebsite", "Website"),
    text("investorSectors", "Preferred sectors"),
    text("investorStages", "Preferred investment stages"),
    select("preferredInvestmentType", "Preferred investment type", ["Equity", "Debt", "Convertible", "Project funding", "Real estate", "Mixed"]),
    money("minimumInvestment", "Minimum investment amount (₹)"),
    money("maximumInvestment", "Maximum investment amount (₹)"),
    money("investmentCapacity", "Total investment capacity (₹)"),
    number("expectedReturnPercent", "Expected return (%)"),
    number("preferredOwnershipPercent", "Preferred ownership (%)"),
    number("investmentTenureMonths", "Investment tenure (months)"),
    text("riskPreference", "Risk preference"),
    text("collateralRequirement", "Collateral requirement"),
    date("nextInvestorFollowup", "Next investor follow-up")
  ],
  "USDT Transaction Details": [
    text("buyerName", "Buyer name"),
    text("sellerName", "Seller name"),
    number("usdtAmount", "USDT quantity"),
    money("googleReferenceRate", "Google reference rate (₹ per USDT)"),
    select("discountType", "Discount type", ["Percentage", "INR per USDT", "Total INR amount", "No discount"]),
    number("discountValue", "Discount value"),
    money("finalUsdtRate", "Final USDT rate (₹ per USDT)"),
    money("totalUsdtTransactionValue", "Total transaction value (₹)"),
    money("buyerSideAmount", "Buyer side amount (₹)"),
    money("sellerSideAmount", "Seller side amount (₹)"),
    select("paymentMode", "Payment mode", ["Cash", "RTGS", "NEFT", "IMPS", "UPI", "Multiple modes"]),
    money("cashAmount", "Cash amount (₹)"),
    money("rtgsAmount", "RTGS amount (₹)"),
    money("neftImpsUpiAmount", "NEFT / IMPS / UPI amount (₹)"),
    text("transactionLocation", "Transaction location"),
    date("transactionDate", "Transaction date"),
    text("transactionRemarks", "Remarks")
  ]
};

const rf = (key: string, label: string, placeholder = "", type: RepeatableField["type"] = "text", options?: string[]): RepeatableField =>
  ({ key, label, placeholder, type, ...(options ? { options } : {}) });
const rMoney = (key: string, label: string): RepeatableField => rf(key, label, "Amount in ₹", "number");

export const axivestraRepeatableGroups: Record<string, RepeatableGroup[]> = {
  "Property Sale": [
    { key: "saleConversionParcels", title: "Conversion portions", description: "Add one, two or all three land-use conversion portions. Record each type and extent separately.", addLabel: "Add conversion portion", fields: [
      rf("conversionType", "Conversion type", "", "select", ["Agricultural", "Commercial", "Industrial", "Residential"]),
      rf("extent", "Extent", "Area", "number"), rf("unit", "Area unit", "", "select", ["acre", "gunta", "sq ft", "sq yd", "sq m", "hectare", "cent"]),
      rf("status", "Status", "", "select", ["Already converted", "Pending", "Partly pending"]), rMoney("conversionAmountNeeded", "Amount needed for conversion")
    ] }
  ],
  "Property Loans": [
    { key: "loanCollateralProperties", title: "Collateral properties", description: "Add every property offered by the borrower. Values and mortgages are maintained separately for each property.", addLabel: "Add another property", fields: [
      rf("propertyName", "Property name / ID"), rf("propertyType", "Property type", "", "select", ["Residential", "Commercial", "Agricultural", "Industrial", "Other"]),
      rf("location", "Address / location"), rf("extent", "Extent / built-up area", "Size", "number"), rf("unit", "Area unit", "", "select", ["sq ft", "sq yd", "sq m", "acre", "gunta", "hectare", "cent"]),
      rMoney("guidelineValue", "Guideline value"), rMoney("srValue", "SR value"), rMoney("marketValue", "Current market value"),
      rMoney("existingMortgage", "Existing mortgage"), rMoney("outstandingLoan", "Outstanding loan"), rMoney("monthlyRent", "Monthly rental income"),
      rf("documentStatus", "Property documents", "Available / pending")
    ] }
  ],
  "JV / JDA / JD": [
    { key: "jvSettlementParties", title: "Owner, agreement holder and other settlement parties", description: "Select who is asking. Add one row for the owner, agreement holder, both, or each additional party. Goodwill, advance and balance remain separate.", addLabel: "Add another party", fields: [
      rf("partyName", "Party name"), rf("partyRole", "Party role", "", "select", ["Owner", "Agreement holder", "Owner and agreement holder", "Developer / partner", "Other"]),
      rMoney("goodwillAsked", "Goodwill asked"), rMoney("advanceAsked", "Advance asked"), rMoney("finalSettlement", "Final settlement"),
      rMoney("amountPaid", "Amount already paid"), rf("conversionStatus", "Conversion status", "", "select", ["Converted", "Not converted", "Partly converted", "N/A"]),
      rf("conversionType", "Conversion type", "", "select", ["Agricultural", "Commercial", "Industrial", "Residential", "Multiple", "N/A"]),
      rf("conversionExtent", "Extent to convert", "Extent", "number"), rMoney("conversionAmountNeeded", "Amount needed for conversion")
    ] }
  ],
  "SR Rate Settlement": [
    { key: "srSettlementParties", title: "Settlement parties", description: "Add as many parties as required. Each person's SR, market and negotiated settlement position is separately recorded.", addLabel: "Add another party", fields: [
      rf("partyName", "Party / entity name"), rf("partyRole", "Role / relationship", "Owner / agreement holder / mediator / other"),
      rMoney("srClaimedAmount", "SR-based amount"), rMoney("marketPosition", "Market-rate position"),
      rMoney("settlementAmount", "Final settlement amount"), rMoney("amountPaid", "Amount already paid"),
      rMoney("balanceAmount", "Balance amount")
    ] },
    { key: "srSettlementLocations", title: "Locations / survey parcels", description: "Use a separate row for every location or survey parcel. Area can be entered in acres, square feet, guntas or other listed units.", addLabel: "Add another location", fields: [
      rf("location", "Location / survey number"), rf("extent", "Extent / size", "Area", "number"),
      rf("unit", "Area unit", "", "select", ["acre", "gunta", "sq ft", "sq yd", "sq m", "hectare", "cent"]),
      rMoney("srRate", "SR rate per unit"), rMoney("marketRate", "Market rate per unit"), rMoney("settlementRate", "Settlement rate per unit"),
      rMoney("settlementAmount", "Location settlement amount")
    ] }
  ],
  "Agricultural Land": [
    { key: "agriConversionParcels", title: "Conversion parcels / land portions", description: "Add each portion separately when conversion is for one, two or all three land-use types.", addLabel: "Add conversion portion", fields: [
      rf("conversionType", "Conversion type", "", "select", ["Commercial", "Industrial", "Residential"]),
      rf("extent", "Extent to convert", "Area", "number"), rf("unit", "Area unit", "", "select", ["acre", "gunta", "sq ft", "sq yd", "sq m", "hectare", "cent"]),
      rf("status", "Status", "", "select", ["Already converted", "Pending", "Partly pending"]),
      rMoney("conversionFee", "Estimated conversion fee"), rf("orderReference", "Conversion order / reference")
    ] },
    { key: "agriSettlementParties", title: "Owner / agreement holder / other parties", description: "Track every settlement party separately, including amounts paid and remaining.", addLabel: "Add another party", fields: [
      rf("partyName", "Party name"), rf("partyRole", "Party role", "", "select", ["Owner", "Agreement holder", "Both", "Other"]),
      rMoney("settlementAmount", "Settlement amount"), rMoney("amountPaid", "Amount paid"), rMoney("balanceAmount", "Balance")
    ] }
  ],
  "Commercial Land": [
    { key: "commercialRentRoll", title: "Tenants and rental income", description: "Add each tenant / lease separately. Actual and projected rent are kept distinct.", addLabel: "Add another tenant", fields: [
      rf("tenantName", "Tenant / occupant"), rf("unitDetails", "Shop / unit / floor"), rMoney("currentMonthlyRent", "Current monthly rent"),
      rMoney("projectedMonthlyRent", "Projected monthly rent"), rf("leaseStart", "Lease start", "", "date"), rf("leaseEnd", "Lease expiry", "", "date"),
      rf("agreementStatus", "Agreement status", "", "select", ["Available", "Signed", "Expired", "Pending"])
    ] }
  ],
  "Startup": [
    { key: "startupFounders", title: "Founders and management", description: "Add multiple founders, co-founders, directors and management members.", addLabel: "Add another founder / director", fields: [
      rf("name", "Name"), rf("role", "Role", "", "select", ["Founder", "Co-founder", "Director", "CEO", "CFO", "CTO", "Promoter", "Other"]),
      rf("phone", "Phone"), rf("email", "Email"), rf("qualificationExperience", "Qualifications / experience")
    ] },
    { key: "startupProjects", title: "Projects and implementation plans", description: "Add every project separately with cost, implementation time and projected financials.", addLabel: "Add another project", fields: [
      rf("projectName", "Project name"), rf("projectType", "Project type"), rMoney("projectCost", "Project cost"),
      rMoney("landBuildingCost", "Land / building cost"), rMoney("machineryCost", "Machinery cost"), rMoney("workingCapital", "Working capital"),
      rf("implementationStart", "Implementation start", "", "date"), rf("implementationEnd", "Expected completion", "", "date"),
      rMoney("projectedAnnualRevenue", "Projected annual revenue"), rMoney("projectedAnnualProfit", "Projected annual profit / loss")
    ] },
    { key: "startupCollateral", title: "Collateral offered to fund the startup", description: "Use one row per collateral property / asset. SR, guideline, market, mortgage and net available values are separate.", addLabel: "Add another collateral asset", fields: [
      rf("assetName", "Collateral property / asset"), rf("assetType", "Asset type", "", "select", ["Land", "Building", "Residential", "Commercial", "Industrial", "Agricultural", "Other"]),
      rf("location", "Location"), rf("extent", "Extent / built-up area", "Size", "number"),
      rf("unit", "Area unit", "", "select", ["sq ft", "sq yd", "sq m", "acre", "gunta", "hectare", "cent"]),
      rMoney("srValue", "SR value"), rMoney("guidelineValue", "Guideline value"), rMoney("marketValue", "Market value"),
      rMoney("mortgageOutstanding", "Existing mortgage outstanding"), rf("ownership", "Ownership / title holder"), rf("collateralProvider", "Collateral provider"), rf("expectedReleaseDate", "Expected collateral release / return date", "", "date"), rf("releaseConditions", "Release / return conditions"), rf("documentStatus", "Documents available")
    ] }
  ],
  "Equity": [
    { key: "equityShareholders", title: "Cap table / shareholding", description: "Add every promoter, founder, investor, ESOP holder or other shareholder. Calculations use the saved share counts.", addLabel: "Add another shareholder", fields: [
      rf("shareholderName", "Shareholder / investor name"), rf("category", "Category", "", "select", ["Promoter", "Founder", "Co-founder", "Investor", "Employee / ESOP", "Other"]),
      rf("shareClass", "Share class"), rf("ownershipPercent", "Ownership / profit share (%)", "%", "number"),
      rMoney("capitalContribution", "Capital contribution (LLP / partnership)"),
      rf("shares", "Number of shares", "Quantity", "number"), rf("faceValue", "Face value per share (₹)", "₹", "number"),
      rf("sharePrice", "Issue / purchase price per share (₹)", "₹", "number"), rMoney("investmentAmount", "Investment amount"),
      rf("issueDate", "Issue / allotment date", "", "date")
    ] },
    { key: "equityFundingRounds", title: "Investment rounds and dilution history", description: "Record each round so before / after funding and dilution scenarios can be compared.", addLabel: "Add another funding round", fields: [
      rf("roundName", "Round name"), rf("investorName", "Investor"), rMoney("investmentAmount", "Investment amount"),
      rMoney("preMoneyValuation", "Pre-money valuation"), rMoney("postMoneyValuation", "Post-money valuation"),
      rf("sharesIssued", "New shares issued", "Quantity", "number"), rf("roundDate", "Investment date", "", "date")
    ] },
    { key: "equityEsop", title: "ESOP grants and employee equity", description: "Track pool allocation, grants, exercises and available options.", addLabel: "Add another ESOP grant", fields: [
      rf("employeeName", "Employee name"), rf("optionsGranted", "Options granted", "Quantity", "number"), rf("optionsExercised", "Options exercised", "Quantity", "number"),
      rf("exercisePrice", "Exercise price (₹)", "₹", "number"), rf("grantDate", "Grant date", "", "date"), rf("vestingStatus", "Vesting status")
    ] }
  ],
  "Unsecured Company Loan": [
    { key: "companyFinancialYears", title: "Last three financial years — turnover and P&L", description: "Enter each financial year separately. Leave values blank / NIL where not available.", addLabel: "Add financial year", fields: [
      rf("financialYear", "Financial year", "FY 2023–24"), rMoney("turnover", "Turnover"), rMoney("grossProfit", "Gross profit"),
      rMoney("ebitda", "EBITDA"), rMoney("netProfit", "Net profit"), rMoney("netLoss", "Net loss")
    ] },
    { key: "companyExistingLoans", title: "Existing loans and liabilities", description: "Add each bank / NBFC / lender facility separately, including EMI and overdue position.", addLabel: "Add another loan", fields: [
      rf("lender", "Bank / NBFC / lender"), rf("loanType", "Loan type"), rMoney("originalAmount", "Original loan amount"),
      rMoney("outstanding", "Outstanding amount"), rMoney("monthlyEmi", "Monthly EMI"), rMoney("overdue", "Overdue amount"),
      rf("bounceCount", "Cheque / EMI bounce count", "Count", "number")
    ] },
    { key: "companyAssets", title: "Stock, machinery and other assets", description: "Separate raw material, finished goods, WIP, machinery and property assets.", addLabel: "Add another asset / stock item", fields: [
      rf("assetType", "Asset type", "", "select", ["Raw material", "Finished goods", "Work in progress", "Trading stock", "Machinery", "Property", "Other"]),
      rf("description", "Description"), rf("quantity", "Quantity", "Quantity", "number"),
      rMoney("purchaseCost", "Purchase cost"), rMoney("marketValue", "Estimated market value")
    ] },
    { key: "companyRentalProperties", title: "Rental properties and income", description: "Add each rental property and its actual rental income separately.", addLabel: "Add another rental property", fields: [
      rf("property", "Property / location"), rMoney("monthlyRent", "Monthly rent"), rMoney("annualRent", "Annual rent"),
      rf("tenant", "Tenant"), rf("agreementStatus", "Rental agreement", "", "select", ["Available", "Not available", "Expired", "Pending"])
    ] },
    { key: "companyOwnership", title: "Owners, partners and directors", description: "Record ownership percentages and personal guarantees by person.", addLabel: "Add another owner / director", fields: [
      rf("personName", "Name"), rf("role", "Role"), rf("ownershipPercent", "Ownership (%)", "%", "number"), rf("experience", "Promoter experience"),
      rf("personalGuarantee", "Personal guarantee", "", "select", ["Yes", "No", "Under discussion"])
    ] }
  ],
  "Personal Loan": [
    { key: "personalLenderCriteria", title: "Lender-wise eligibility criteria", description: "Enter the lender's published or confirmed minimum CIBIL, maximum FOIR, rate and tenure. Eligibility remains N/A until a matching lender rule and applicant data are entered.", addLabel: "Add lender criteria", fields: [
      rf("lender", "Lender name"), rf("minimumCibil", "Minimum CIBIL score", "Score", "number"), rf("maximumFoir", "Maximum FOIR (%)", "%", "number"),
      rf("interestRate", "Annual interest rate (%)", "%", "number"), rf("maximumTenureMonths", "Maximum tenure (months)", "Months", "number"), rMoney("maximumLoanAmount", "Maximum lender loan amount")
    ] },
    { key: "personalExistingLoans", title: "Existing loans", description: "Add each existing bank / NBFC / private loan separately.", addLabel: "Add another existing loan", fields: [
      rf("lender", "Bank / NBFC"), rf("loanType", "Loan type"), rMoney("originalAmount", "Original amount"), rMoney("outstanding", "Outstanding amount"),
      rMoney("monthlyEmi", "Monthly EMI"), rf("remainingTenure", "Remaining tenure (months)", "Months", "number"), rMoney("overdue", "Pending overdue")
    ] },
    { key: "personalBounceHistory", title: "Year-wise bounce and overdue history", description: "Keep historical bounces separate from current pending overdues.", addLabel: "Add another financial year", fields: [
      rf("financialYear", "Financial year"), rf("emiBounceCount", "EMI bounce count", "Count", "number"), rMoney("emiBounceAmount", "EMI bounce amount"),
      rf("chequeBounceCount", "Cheque bounce count", "Count", "number"), rMoney("chequeBounceAmount", "Cheque bounce amount"),
      rf("dpdDays", "Maximum DPD days", "Days", "number")
    ] },
    { key: "personalCreditCards", title: "Credit cards", description: "Add every card separately so limits, outstanding and minimum dues can be reviewed.", addLabel: "Add another credit card", fields: [
      rf("bank", "Issuing bank"), rf("cardName", "Card / account label"), rMoney("creditLimit", "Credit limit"),
      rMoney("outstanding", "Outstanding amount"), rMoney("minimumDue", "Minimum due")
    ] }
  ],
  "Housing Loan": [
    { key: "housingLenderCriteria", title: "Lender-wise eligibility criteria", description: "Enter the chosen lender's configured minimum CIBIL, maximum FOIR, maximum LTV, interest rate and tenure. No generic lender thresholds are assumed.", addLabel: "Add lender criteria", fields: [
      rf("lender", "Lender name"), rf("minimumCibil", "Minimum CIBIL score", "Score", "number"), rf("maximumFoir", "Maximum FOIR (%)", "%", "number"),
      rf("maximumLtv", "Maximum LTV (%)", "%", "number"), rf("interestRate", "Annual interest rate (%)", "%", "number"),
      rf("maximumTenureMonths", "Maximum tenure (months)", "Months", "number"), rMoney("maximumLoanAmount", "Maximum lender loan amount")
    ] },
    { key: "housingCollateralProperties", title: "Applicant's multiple properties / collateral", description: "Add every property. Valuation, mortgage and rental income are tracked separately to avoid double counting.", addLabel: "Add another property", fields: [
      rf("propertyName", "Property name / ID"), rf("propertyType", "Property type", "", "select", ["Residential", "Commercial", "Agricultural", "Industrial", "Other"]),
      rf("address", "Address / location"), rf("ownership", "Owner / ownership share"), rf("extent", "Extent / built-up area", "Size", "number"),
      rf("unit", "Area unit", "", "select", ["sq ft", "sq yd", "sq m", "acre", "gunta", "hectare", "cent"]),
      rMoney("guidelineValue", "Guideline value"), rMoney("srValue", "SR value"), rMoney("marketValue", "Market value"),
      rMoney("mortgageOutstanding", "Existing mortgage outstanding"), rMoney("monthlyRent", "Monthly rent"), rf("documentStatus", "Documents available")
    ] },
    { key: "housingExistingLoans", title: "Existing loans and EMI commitments", description: "Add each existing loan facility separately.", addLabel: "Add another existing loan", fields: [
      rf("lender", "Bank / NBFC"), rf("loanType", "Loan type"), rMoney("originalAmount", "Original amount"), rMoney("outstanding", "Outstanding"),
      rMoney("monthlyEmi", "Monthly EMI"), rMoney("overdue", "Overdue amount")
    ] },
    { key: "housingBounceHistory", title: "Year-wise bounce history", description: "Record cheque and EMI bounces year-wise; do not combine this with current overdues.", addLabel: "Add another financial year", fields: [
      rf("financialYear", "Financial year"), rf("emiBounceCount", "EMI bounce count", "Count", "number"), rMoney("emiBounceAmount", "EMI bounce amount"),
      rf("chequeBounceCount", "Cheque bounce count", "Count", "number"), rMoney("chequeBounceAmount", "Cheque bounce amount")
    ] }
  ],
  "House Purchase": [
    { key: "purchaseOwners", title: "Property owners / agreement holders", description: "Support more than one owner and agreement holder. Track purchase and settlement positions person by person.", addLabel: "Add another party", fields: [
      rf("partyName", "Owner / agreement holder name"), rf("partyRole", "Role", "", "select", ["Owner", "Co-owner", "Agreement holder", "Power of attorney", "Other"]),
      rMoney("agreedAmount", "Agreed amount"), rMoney("advancePaid", "Advance paid"), rMoney("finalSettlement", "Final settlement"), rMoney("balance", "Balance")
    ] },
    { key: "purchasePayments", title: "Advance and purchase payment history", description: "Record multiple advances and part-payments with dates, modes and references.", addLabel: "Add another payment", fields: [
      rf("paymentDate", "Payment date", "", "date"), rMoney("amount", "Payment amount"),
      rf("paidTo", "Paid to / recipient"), rf("paymentMode", "Mode", "", "select", ["Cash", "Bank transfer", "RTGS", "NEFT", "IMPS", "UPI", "Cheque"]),
      rf("reference", "Transaction reference / proof")
    ] }
  ],
  "Litigation": [
    { key: "litigationSettlementParties", title: "Person-wise settlement and payment accounts", description: "Add any number of owners, agreement holders, mediators, claimants or other parties. Record amounts and payments separately.", addLabel: "Add another settlement party", fields: [
      rf("partyName", "Party name"), rf("partyRole", "Party role"), rMoney("amountClaimed", "Amount claimed"),
      rMoney("settlementAmount", "Final settlement amount"), rMoney("amountPaid", "Amount already paid"), rMoney("balance", "Balance")
    ] }
  ],
  "Fund & Portfolio Management": [
    { key: "fundInvestors", title: "Fund investors and commitments", description: "Maintain each investor's commitment, contribution, outstanding contribution and profit share.", addLabel: "Add another investor", fields: [
      rf("investorName", "Investor name"), rf("investorType", "Investor type"), rMoney("commitment", "Commitment"),
      rMoney("invested", "Amount invested"), rMoney("pendingContribution", "Pending contribution"), rf("profitSharePercent", "Profit sharing (%)", "%", "number")
    ] },
    { key: "fundPortfolioInvestments", title: "Portfolio investments", description: "Add companies and projects separately with invested value, valuation and exit details.", addLabel: "Add portfolio investment", fields: [
      rf("companyProject", "Company / project name"), rf("sector", "Sector"), rf("investmentType", "Investment type"),
      rf("investmentDate", "Investment date", "", "date"), rMoney("initialInvestment", "Initial investment"),
      rMoney("additionalInvestment", "Additional investment"), rMoney("currentValue", "Current value"),
      rf("expectedExitDate", "Expected exit date", "", "date"), rMoney("exitValue", "Expected / actual exit value")
    ] },
    { key: "fundTransactions", title: "Fund transactions", description: "Record capital receipts, deployment, withdrawals, distributions, fees and expenses.", addLabel: "Add fund transaction", fields: [
      rf("transactionDate", "Date", "", "date"), rf("transactionType", "Transaction type", "", "select", ["Capital received", "Capital deployed", "Additional contribution", "Withdrawal", "Investor distribution", "Management fee", "Operating expense", "Interest / dividend"]),
      rf("party", "Investor / company / payee"), rMoney("amount", "Amount"), rf("reference", "Reference / description")
    ] }
  ],
  "Investor Relations": [
    { key: "investorPastInvestments", title: "Past investments and exits", description: "An investor can invest in multiple companies and projects. Track each investment and exit separately.", addLabel: "Add previous investment", fields: [
      rf("companyProject", "Company / project"), rf("sector", "Sector"), rMoney("investmentAmount", "Investment amount"),
      rf("investmentDate", "Investment date", "", "date"), rf("equityPercent", "Equity percentage", "%", "number"),
      rf("status", "Investment status"), rMoney("currentValue", "Current value"), rf("exitDate", "Exit date", "", "date"), rMoney("exitReturn", "Exit return")
    ] },
    { key: "investorCommunicationLog", title: "Meetings, calls and follow-ups", description: "Keep an auditable history of communication, documents shared and next action.", addLabel: "Add communication entry", fields: [
      rf("date", "Date", "", "date"), rf("channel", "Channel", "", "select", ["Meeting", "Call", "Email", "WhatsApp", "Video conference", "Other"]),
      rf("contactPerson", "Contact person"), rf("notes", "Discussion notes"), rf("documentsShared", "Documents shared"),
      rf("followUpDate", "Follow-up date", "", "date"), rf("nextAction", "Next action")
    ] }
  ],
  "USDT Transaction Details": [
    { key: "usdtPayments", title: "Payment breakdown", description: "Add every cash, RTGS, NEFT, IMPS or UPI movement. No wallet or blockchain fields are required.", addLabel: "Add another payment", fields: [
      rf("side", "Payment side", "", "select", ["Buyer pays", "Seller receives", "Other"]),
      rf("mode", "Payment mode", "", "select", ["Cash", "RTGS", "NEFT", "IMPS", "UPI", "Cheque"]),
      rMoney("amount", "Amount"), rf("date", "Payment date", "", "date"), rf("location", "Payment location"), rf("reference", "Reference / proof")
    ] }
  ]
};

function readRows(value: string | undefined): Array<Record<string, string>> {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is Record<string, string> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
  } catch { return []; }
}

function rowId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "row-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

export function RepeatableModuleEditor({ config, value, onChange }: {
  config: RepeatableGroup;
  value: string;
  onChange: (value: string) => void;
}) {
  const rows = readRows(value);
  const updateRow = (index: number, key: string, nextValue: string) => {
    const next = rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: nextValue } : row);
    onChange(JSON.stringify(next));
  };
  const addRow = () => onChange(JSON.stringify([...rows, { __rowId: rowId() }]));
  const removeRow = (index: number) => onChange(JSON.stringify(rows.filter((_, rowIndex) => rowIndex !== index)));

  return <section className="module-data-section ax-repeatable-section">
    <div className="form-section-title">
      <span className="section-kicker">{config.title.toUpperCase()} · {rows.length} ENTRIES</span>
      <p>{config.description}</p>
    </div>
    {rows.map((row, index) => <div className="ax-repeatable-row" key={String(row.__rowId || index)}>
      <div className="ax-repeatable-row__header"><strong>{config.title.replace(/s$/, "")} {index + 1}</strong><button type="button" className="text-button danger-text" onClick={() => removeRow(index)} aria-label={"Remove " + config.title + " row " + (index + 1)}>Remove</button></div>
      <div className="module-data-grid">
        {config.fields.map(field => <label key={field.key}>{field.label}
          {field.type === "select"
            ? <select value={row[field.key] || ""} onChange={event => updateRow(index, field.key, event.target.value)}>
                <option value="">{field.placeholder || "Select"}</option>
                {(field.options || []).map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            : <input type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                min={field.type === "number" ? "0" : undefined}
                step={field.type === "number" ? "any" : undefined}
                value={row[field.key] || ""}
                onChange={event => updateRow(index, field.key, event.target.value)}
                placeholder={field.placeholder}/>}
        </label>)}
      </div>
    </div>)}
    <button type="button" className="secondary-button ax-repeatable-add" onClick={addRow}>＋ {config.addLabel}</button>
  </section>;
}

function principalFromEmi(emi: number, annualRate: number, months: number): number | null {
  if (![emi, annualRate, months].every(Number.isFinite) || emi < 0 || annualRate < 0 || months <= 0) return null;
  const monthlyRate = annualRate / 1200;
  if (monthlyRate === 0) return emi * months;
  const factor = Math.pow(1 + monthlyRate, months);
  return emi * (factor - 1) / (monthlyRate * factor);
}

function xirr(cashflows: Array<{ date: string; amount: number }>): number | null {
  const valid = cashflows.filter(item => item.date && Number.isFinite(item.amount) && item.amount !== 0)
    .map(item => ({ time: new Date(item.date + "T00:00:00").getTime(), amount: item.amount }))
    .filter(item => Number.isFinite(item.time)).sort((a,b)=>a.time-b.time);
  if (valid.length < 2 || !valid.some(item=>item.amount<0) || !valid.some(item=>item.amount>0)) return null;
  const origin = valid[0].time;
  const npv = (rate:number) => valid.reduce((sum,item)=>sum+item.amount/Math.pow(1+rate,(item.time-origin)/(365.25*86400000)),0);
  let low = -0.9999, high = 10, lowValue = npv(low), highValue = npv(high);
  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue) || lowValue * highValue > 0) return null;
  for(let i=0;i<180;i++){
    const mid=(low+high)/2, midValue=npv(mid);
    if(!Number.isFinite(midValue)) return null;
    if(Math.abs(midValue)<0.000001) return mid*100;
    if(lowValue*midValue<=0){high=mid;highValue=midValue;}else{low=mid;lowValue=midValue;}
  }
  return ((low+high)/2)*100;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(String(value).replace(/,/g, "").replace(/[₹\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function sumRows(value: string | undefined, key: string): number | null {
  const rows = readRows(value);
  const entered = rows.map(row => parseNumber(row[key])).filter((item): item is number => item !== null);
  if (!entered.length) return null;
  return entered.reduce((sum, item) => sum + item, 0);
}

const fmt = (value: number | null) => value === null || !Number.isFinite(value)
  ? "N/A"
  : "₹" + value.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export function buildModuleSummary(moduleName: string, data: Record<string, string>): Array<{ label: string; value: string }> {
  const result: Array<{ label: string; value: string }> = [];
  const add = (label: string, value: number | null, kind: "money" | "number" | "percent" = "money") => {
    if (value === null || !Number.isFinite(value)) result.push({ label, value: "N/A" });
    else result.push({ label, value: kind === "money" ? fmt(value) : kind === "percent" ? value.toFixed(2) + "%" : value.toLocaleString("en-IN", { maximumFractionDigits: 2 }) });
  };
  const val = (key: string) => parseNumber(data[key]);
  const paidBalance = (settlementKey: string, paidKey: string) => {
    const total = val(settlementKey), paid = val(paidKey);
    return total === null ? null : Math.max(0, total - (paid || 0));
  };

  if (["Property Sale", "Agricultural Land", "Litigation"].includes(moduleName)) {
    add("Owner settlement balance", paidBalance("ownerSettlementAmount", "ownerAmountPaid"));
    add("Agreement holder settlement balance", paidBalance("agreementHolderSettlementAmount", "agreementHolderAmountPaid"));
  }
  if (moduleName === "JV / JDA / JD") {
    add("Owner settlement balance", paidBalance("ownerFinalSettlement", "ownerAlreadyPaid"));
    add("Agreement holder settlement balance", paidBalance("agreementHolderFinalSettlement", "agreementHolderAlreadyPaid"));
    add("Conversion amount required", val("conversionCostEstimate"));
    add("Party settlements total", sumRows(data.jvSettlementParties, "finalSettlement"));
    add("Party payments total", sumRows(data.jvSettlementParties, "amountPaid"));
  }
  if (moduleName === "SR Rate Settlement") {
    add("Settlement parties total", sumRows(data.srSettlementParties, "settlementAmount"));
    add("Amount already paid", sumRows(data.srSettlementParties, "amountPaid"));
    add("Settlement locations total", sumRows(data.srSettlementLocations, "settlementAmount"));
    const sr = val("srRatePerUnit"), market = val("marketRatePerUnit"), negotiated = val("settlementRatePerUnit");
    if (sr !== null && market !== null) add("Market rate vs SR rate difference", market - sr);
    if (negotiated !== null && market !== null) add("Settlement rate vs market difference", market - negotiated);
  }
  if (moduleName === "Property Sale") {
    add("Converted extent total", sumRows(data.saleConversionParcels, "extent"), "number");
    add("Conversion amount required", sumRows(data.saleConversionParcels, "conversionAmountNeeded") ?? val("conversionCostEstimate"));
  }
  if (moduleName === "Agricultural Land") {
    add("Converted / conversion parcel extent", sumRows(data.agriConversionParcels, "extent"), "number");
    add("Conversion amount required", sumRows(data.agriConversionParcels, "conversionFee") ?? val("conversionCostEstimate"));
    add("Party settlement balance", sumRows(data.agriSettlementParties, "balanceAmount"));
  }
  if (moduleName === "Commercial Land") {
    const currentMonthly = sumRows(data.commercialRentRoll, "currentMonthlyRent") ?? val("monthlyCurrentRent");
    const projectedMonthly = sumRows(data.commercialRentRoll, "projectedMonthlyRent") ?? val("monthlyProjectedRent");
    const currentAnnual = val("annualCurrentRent") ?? (currentMonthly !== null ? currentMonthly * 12 : null);
    const projectedAnnual = val("annualProjectedRent") ?? (projectedMonthly !== null ? projectedMonthly * 12 : null);
    add("Current monthly rent total", currentMonthly);
    add("Projected monthly rent total", projectedMonthly);
    add("Annual current rent", currentAnnual);
    add("Annual projected rent", projectedAnnual);
    const market = val("marketValue");
    add("Projected rental yield", projectedAnnual !== null && market ? projectedAnnual / market * 100 : null, "percent");
  }
  if (moduleName === "Property Loans" || moduleName === "Housing Loan" || moduleName === "Startup") {
    const groupKey = moduleName === "Property Loans" ? "loanCollateralProperties" : moduleName === "Housing Loan" ? "housingCollateralProperties" : "startupCollateral";
    const valueKey = "marketValue", mortgageKey = moduleName === "Property Loans" ? "existingMortgage" : "mortgageOutstanding";
    const sr = sumRows(data[groupKey], "srValue"), guideline = sumRows(data[groupKey], "guidelineValue"), market = sumRows(data[groupKey], valueKey);
    const outstanding = sumRows(data[groupKey], mortgageKey), rent = sumRows(data[groupKey], "monthlyRent");
    add("Total SR value of listed properties", sr);
    add("Total guideline value of listed properties", guideline);
    add("Total market value of listed properties", market);
    add("Total existing mortgage outstanding", outstanding);
    add("Net available collateral value", market !== null ? Math.max(0, market - (outstanding || 0)) : null);
    if (rent !== null) add("Monthly rent from listed properties", rent);
  }
  if (moduleName === "Startup") {
    add("Total project cost", sumRows(data.startupProjects, "projectCost"));
    add("Total requested project working capital", sumRows(data.startupProjects, "workingCapital"));
  }
  if (moduleName === "Equity") {
    const rows = readRows(data.equityShareholders);
    const nonShareStructure = ["LLP","Partnership","Proprietorship"].includes(data.equityLegalStructure || "");
    const pre = val("preMoneyValuation"), investment = val("equityFundingRequired");
    add("Calculated post-money valuation", pre !== null && investment !== null ? pre + investment : val("postMoneyValuation"));
    if (nonShareStructure) {
      const contributions = sumRows(data.equityShareholders, "capitalContribution");
      const partnerContributions = rows.reduce((sum,row)=>sum+(parseNumber(row.capitalContribution)||0),0);
      add("Total partner / owner capital contributions", contributions);
      rows.forEach(row => {
        const amount = parseNumber(row.capitalContribution);
        if (row.shareholderName) add("Ownership — " + row.shareholderName, amount !== null && partnerContributions ? amount / partnerContributions * 100 : parseNumber(row.ownershipPercent), "percent");
      });
    } else {
      const totalShares = sumRows(data.equityShareholders, "shares");
      const promoterShares = rows.filter(row=>["Promoter","Founder","Co-founder"].includes(row.category||"")).reduce((sum,row)=>sum+(parseNumber(row.shares)||0),0);
      const founderShares = rows.filter(row=>["Founder","Co-founder"].includes(row.category||"")).reduce((sum,row)=>sum+(parseNumber(row.shares)||0),0);
      const investorShares = rows.filter(row=>row.category==="Investor").reduce((sum,row)=>sum+(parseNumber(row.shares)||0),0);
      const otherShares = rows.filter(row=>!["Promoter","Founder","Co-founder","Investor"].includes(row.category||"")).reduce((sum,row)=>sum+(parseNumber(row.shares)||0),0);
      add("Total issued / captured shares", totalShares, "number");
      add("Promoter / founder holding", totalShares ? promoterShares / totalShares * 100 : null, "percent");
      add("Founder ownership", totalShares ? founderShares / totalShares * 100 : null, "percent");
      add("Investor holding", totalShares ? investorShares / totalShares * 100 : null, "percent");
      add("Other shareholder ownership", totalShares ? otherShares / totalShares * 100 : null, "percent");
      const dilutionShares = val("newInvestorShares");
      add("New investor dilution", dilutionShares !== null && totalShares !== null && totalShares + dilutionShares > 0 ? dilutionShares / (totalShares + dilutionShares) * 100 : null, "percent");
      const fullyDiluted = totalShares !== null ? totalShares + (val("fullyDilutedShares") || 0) : null;
      add("Fully diluted share count", fullyDiluted, "number");
      add("Fully diluted investor ownership", fullyDiluted && investorShares ? investorShares / fullyDiluted * 100 : null, "percent");
      const debt = val("totalDebt"), equity = val("shareholdersEquity");
      add("Debt-to-equity ratio", debt !== null && equity ? debt / equity : null, "number");
      const earnings = val("earningsAvailableToEquity"), weightedShares = val("weightedAverageShares");
      const eps = earnings !== null && weightedShares ? earnings / weightedShares : null;
      add("Earnings per share (EPS)", eps, "money");
      const marketPrice = val("marketPricePerShare");
      add("Price-to-earnings ratio (P/E)", marketPrice !== null && eps ? marketPrice / eps : null, "number");
    }
    const profit = val("netProfitForRatios"), averageEquity = val("averageShareholdersEquity");
    add("Return on equity (ROE)", profit !== null && averageEquity ? profit / averageEquity * 100 : null, "percent");
    const gain = val("investmentGain"), cost = val("investmentCost");
    add("Return on investment (ROI)", gain !== null && cost ? gain / cost * 100 : null, "percent");
  }
  if (moduleName === "Unsecured Company Loan") {
    const years = readRows(data.companyFinancialYears);
    const turnover = years.map(row=>({year:String(row.financialYear||""),value:parseNumber(row.turnover)})).filter((row):row is {year:string;value:number}=>row.value!==null);
    const gross = sumRows(data.companyFinancialYears,"grossProfit");
    const totalTurnover = sumRows(data.companyFinancialYears, "turnover");
    const netProfit = sumRows(data.companyFinancialYears,"netProfit");
    const netLoss = sumRows(data.companyFinancialYears,"netLoss");
    add("Three-year / captured turnover total", totalTurnover);
    add("Three-year gross profit total", gross);
    add("Three-year net profit total", netProfit);
    add("Three-year net loss total", netLoss);
    add("Three-year net result", netProfit !== null || netLoss !== null ? (netProfit||0)-(netLoss||0) : null);
    const orderedTurnover = [...turnover].sort((a,b)=>a.year.localeCompare(b.year));
    const firstTurnover = orderedTurnover[0]?.value;
    const latestTurnover = orderedTurnover[orderedTurnover.length-1]?.value;
    add("Turnover growth from first to latest captured year", firstTurnover && latestTurnover !== undefined ? (latestTurnover-firstTurnover)/firstTurnover*100 : null,"percent");
    add("Latest captured financial year turnover", latestTurnover ?? null);
    const loanOutstanding = sumRows(data.companyExistingLoans, "outstanding") ?? val("totalExistingLoanOutstanding");
    const emi = sumRows(data.companyExistingLoans, "monthlyEmi") ?? val("totalMonthlyEmi");
    add("Total existing loan outstanding", loanOutstanding);
    add("Total monthly EMI commitments", emi);
    const assetRows = sumRows(data.companyAssets, "marketValue");
    const singleAssets = ["stockMarketValue","machineryValue","propertyAssetValue"].map(key=>val(key)).filter((item):item is number=>item!==null);
    const assets = assetRows ?? (singleAssets.length ? singleAssets.reduce((sum,item)=>sum+item,0) : null);
    add("Total stock / asset market value", assets);
    add("Total rental income per month", sumRows(data.companyRentalProperties, "monthlyRent"));
    const cash = val("availableMonthlyCashflow"), monthlyNetIncome = val("monthlyNetIncome");
    add("Cash flow after existing EMI", cash !== null && emi !== null ? cash - emi : null);
    add("Debt-to-income (monthly EMI / net income)", monthlyNetIncome && emi !== null ? emi / monthlyNetIncome * 100 : null,"percent");
    const otherLiabilities = val("otherBusinessLiabilities");
    const totalLiabilities = loanOutstanding !== null || otherLiabilities !== null ? (loanOutstanding||0)+(otherLiabilities||0) : null;
    add("Debt-to-equity ratio", totalLiabilities !== null && val("ownerCapital") ? totalLiabilities / (val("ownerCapital") as number) : null,"number");
    add("Estimated net worth (captured assets less liabilities)", assets !== null && totalLiabilities !== null ? assets-totalLiabilities : null);
  }
  if (moduleName === "Personal Loan") {
    const emi = sumRows(data.personalExistingLoans, "monthlyEmi") ?? val("totalExistingMonthlyEmi");
    const income = val("monthlyIncome");
    add("Total existing monthly EMI", emi);
    add("FOIR (existing EMI / monthly income)", income && emi !== null ? emi / income * 100 : null, "percent");
    add("Available monthly income after EMI", income !== null && emi !== null ? income - emi : null);
    add("Total existing loan outstanding", sumRows(data.personalExistingLoans, "outstanding") ?? val("totalExistingOutstanding"));
    add("Credit card outstanding total", sumRows(data.personalCreditCards, "outstanding") ?? val("creditCardOutstandingTotal"));
    add("Year-wise EMI bounces", sumRows(data.personalBounceHistory, "emiBounceCount"), "number");
    add("Year-wise cheque bounces", sumRows(data.personalBounceHistory, "chequeBounceCount"), "number");
    const principal = val("principal"), annualRate = val("interestRate"), months = val("tenureMonths");
    const monthlyRate = annualRate !== null ? annualRate / 1200 : null;
    const calculatedEmi = principal !== null && monthlyRate !== null && months !== null && months > 0
      ? (monthlyRate === 0 ? principal / months : principal * monthlyRate * Math.pow(1+monthlyRate,months) / (Math.pow(1+monthlyRate,months)-1))
      : null;
    add("Calculated proposed EMI", calculatedEmi);
    const requestedLender = String(data.lender || "").trim().toLowerCase();
    const rule = readRows(data.personalLenderCriteria).find(row=>String(row.lender||"").trim().toLowerCase()===requestedLender);
    const minimumCibil = rule ? parseNumber(rule.minimumCibil) : null;
    const maxFoir = rule ? parseNumber(rule.maximumFoir) : null;
    const lenderRate = rule ? parseNumber(rule.interestRate) : null;
    const lenderTenure = rule ? parseNumber(rule.maximumTenureMonths) : null;
    const cibil = val("cibilScore");
    const currentEmi = emi;
    const eligibleEmi = income !== null && maxFoir !== null && currentEmi !== null ? Math.max(0,income*maxFoir/100-currentEmi) : null;
    const eligibilityPrincipal = eligibleEmi !== null && lenderRate !== null && lenderTenure !== null ? principalFromEmi(eligibleEmi,lenderRate,lenderTenure) : null;
    const lenderCap = rule ? parseNumber(rule.maximumLoanAmount) : null;
    const criteriaMatch = Boolean(rule && minimumCibil !== null && cibil !== null && cibil >= minimumCibil);
    add("Configured lender minimum CIBIL", minimumCibil, "number");
    add("Estimated loan eligibility (configured lender)", criteriaMatch && eligibilityPrincipal !== null ? Math.min(eligibilityPrincipal,lenderCap ?? Infinity) : null);
  }
  if (moduleName === "Housing Loan") {
    add("Total property monthly rental income", sumRows(data.housingCollateralProperties, "monthlyRent"));
    const collateralMarket = sumRows(data.housingCollateralProperties, "marketValue");
    add("Total existing monthly EMI", sumRows(data.housingExistingLoans, "monthlyEmi") ?? val("totalExistingMonthlyEmi"));
    add("Total existing loan outstanding", sumRows(data.housingExistingLoans, "outstanding") ?? val("totalExistingLoanOutstanding"));
    const income = val("monthlyIncome"), emi = sumRows(data.housingExistingLoans, "monthlyEmi") ?? val("totalExistingMonthlyEmi");
    add("FOIR (existing EMI / monthly income)", income && emi !== null ? emi / income * 100 : null, "percent");
    const requestedLender = String(data.lender || "").trim().toLowerCase();
    const rule = readRows(data.housingLenderCriteria).find(row=>String(row.lender||"").trim().toLowerCase()===requestedLender);
    const minCibil = rule ? parseNumber(rule.minimumCibil) : null;
    const maxFoir = rule ? parseNumber(rule.maximumFoir) : null;
    const maxLtv = rule ? parseNumber(rule.maximumLtv) : null;
    const cibil = val("cibilScore");
    const currentEmi = emi;
    const emiCapacity = income !== null && maxFoir !== null && currentEmi !== null ? Math.max(0,income*maxFoir/100-currentEmi) : null;
    const rate = rule ? parseNumber(rule.interestRate) : null;
    const tenure = rule ? parseNumber(rule.maximumTenureMonths) : null;
    const byIncome = emiCapacity !== null && rate !== null && tenure !== null ? principalFromEmi(emiCapacity,rate,tenure) : null;
    const byLtv = collateralMarket !== null && maxLtv !== null ? collateralMarket * maxLtv / 100 : null;
    const cap = rule ? parseNumber(rule.maximumLoanAmount) : null;
    const eligible = byIncome !== null && byLtv !== null && minCibil !== null && cibil !== null && cibil >= minCibil
      ? Math.min(byIncome,byLtv,...(cap !== null ? [cap] : [])) : null;
    add("Configured lender minimum CIBIL", minCibil, "number");
    add("Estimated housing loan eligibility (configured lender)", eligible);
  }
  if (moduleName === "House Purchase") {
    const price = val("totalAgreedPurchaseAmount") ?? val("agreedPrice");
    const payments = sumRows(data.purchasePayments, "amount") ?? val("totalAdvancePaid") ?? val("advancePaid");
    add("Total purchase payments entered", payments);
    add("Balance purchase amount", price !== null ? Math.max(0, price - (payments || 0)) : null);
    add("Owner settlement balance", paidBalance("ownerFinalSettlement", "amountAlreadyPaidToOwner"));
    add("Total person-wise agreed amount", sumRows(data.purchaseOwners, "agreedAmount"));
    add("Total person-wise advance paid", sumRows(data.purchaseOwners, "advancePaid"));
  }
  if (moduleName === "Litigation") {
    add("Person-wise settlement total", sumRows(data.litigationSettlementParties, "settlementAmount"));
    add("Person-wise amount paid", sumRows(data.litigationSettlementParties, "amountPaid"));
    add("Person-wise balance to settle", sumRows(data.litigationSettlementParties, "balance"));
  }
  if (moduleName === "Fund & Portfolio Management") {
    add("Investor commitments total", sumRows(data.fundInvestors, "commitment"));
    add("Capital invested total", sumRows(data.fundInvestors, "invested"));
    add("Pending investor contribution", sumRows(data.fundInvestors, "pendingContribution"));
    add("Portfolio current value", sumRows(data.fundPortfolioInvestments, "currentValue"));
    add("Actual / projected exit value", sumRows(data.fundPortfolioInvestments, "exitValue"));
    add("Fund transaction total", sumRows(data.fundTransactions, "amount"));
    const invested = sumRows(data.fundPortfolioInvestments, "initialInvestment");
    const additions = sumRows(data.fundPortfolioInvestments, "additionalInvestment");
    const deployed = invested !== null || additions !== null ? (invested || 0) + (additions || 0) : null;
    const current = sumRows(data.fundPortfolioInvestments, "currentValue");
    add("Total deployed investment", deployed);
    add("Portfolio unrealised / realised value", current);
    add("Portfolio MOIC", deployed && current !== null ? current / deployed : null, "number");
    add("Portfolio ROI", deployed && current !== null ? (current - deployed) / deployed * 100 : null, "percent");
    const liabilities = val("fundOutstandingLoans");
    add("Net portfolio value after fund borrowings", current !== null && liabilities !== null ? current - liabilities : null);
    const transactions = readRows(data.fundTransactions);
    const investorCashflows = transactions.flatMap(row => {
      const type = String(row.transactionType || "");
      const amount = parseNumber(row.amount);
      if (amount === null) return [];
      if (["Capital received","Additional contribution"].includes(type)) return [{date:String(row.transactionDate||""),amount:-amount}];
      if (["Investor distribution","Withdrawal","Interest / dividend"].includes(type)) return [{date:String(row.transactionDate||""),amount}];
      return [];
    });
    const terminalValue = val("nav") ?? current;
    const terminalDate = String(data.fundEndDate || data.reportingDate || "");
    const irrFlows = terminalValue !== null && terminalDate ? [...investorCashflows,{date:terminalDate,amount:terminalValue}] : investorCashflows;
    add("Investor cash-flow IRR (XIRR)", xirr(irrFlows), "percent");

  }
  if (moduleName === "Investor Relations") {
    add("Previous investment total", sumRows(data.investorPastInvestments, "investmentAmount"));
    add("Current value of previous investments", sumRows(data.investorPastInvestments, "currentValue"));
    add("Previous exit return total", sumRows(data.investorPastInvestments, "exitReturn"));
  }
  if (moduleName === "USDT Transaction Details") {
    const rate = val("googleReferenceRate"), quantity = val("usdtAmount"), discount = val("discountValue");
    let finalRate = rate;
    if (rate !== null && discount !== null) {
      if (data.discountType === "Percentage") finalRate = rate - rate * discount / 100;
      else if (data.discountType === "INR per USDT") finalRate = rate - discount;
      else if (data.discountType === "Total INR amount" && quantity) finalRate = rate - discount / quantity;
    }
    const total = finalRate !== null && quantity !== null ? finalRate * quantity : null;
    add("Calculated final USDT rate", finalRate);
    add("Calculated total transaction value", total);
    const payments = readRows(data.usdtPayments);
    const enteredPayments = payments.map(row => parseNumber(row.amount)).filter((amount): amount is number => amount !== null);
    const cashValues = payments.filter(row => row.mode === "Cash").map(row => parseNumber(row.amount)).filter((amount): amount is number => amount !== null);
    const rtgsValues = payments.filter(row => row.mode === "RTGS").map(row => parseNumber(row.amount)).filter((amount): amount is number => amount !== null);
    const paymentTotal = enteredPayments.length ? enteredPayments.reduce((sum, amount) => sum + amount, 0) : null;
    if (enteredPayments.length) {
      add("Cash payment total", cashValues.length ? cashValues.reduce((sum, amount) => sum + amount, 0) : null);
      add("RTGS payment total", rtgsValues.length ? rtgsValues.reduce((sum, amount) => sum + amount, 0) : null);
      add("Payment total", paymentTotal);
      add("Payment difference / balance", total !== null && paymentTotal !== null ? total - paymentTotal : null);
    }
  }
  return result;
}
