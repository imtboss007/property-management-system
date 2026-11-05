const assert = require("assert");
(async () => {
  const { parseContactImport, contactsToVCard } = await import("../src/lib/contact-portability.mjs");
  const csv = 'Name,Phone,Email,Address\n"Jane Doe","+919876543210",jane@example.com,"Bengaluru, India"\nJohn,9876543210,john@example.com,Chennai';
  const csvRows = parseContactImport(csv, "contacts.csv");
  assert.strictEqual(csvRows.length, 2, "CSV import should parse all rows.");
  assert.strictEqual(csvRows[0].address, "Bengaluru, India", "CSV parser must preserve quoted commas.");
  const vcf = contactsToVCard([
    { name: "Jane Doe", phone: "+919876543210", email: "jane@example.com" },
    { name: "John", phone: "9876543210" }
  ]);
  assert.strictEqual((vcf.match(/BEGIN:VCARD/g) || []).length, 2, "Each exported contact must have its own vCard envelope.");
  assert.strictEqual((vcf.match(/END:VCARD/g) || []).length, 2, "Each exported contact must close its vCard envelope.");
  const imported = parseContactImport(vcf, "axivestra.vcf");
  assert.strictEqual(imported.length, 2, "vCard export must round-trip multiple contacts.");
  assert.strictEqual(imported[0].email, "jane@example.com", "vCard round-trip should retain email.");
  console.log("AXIVESTRA contact portability tests passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
