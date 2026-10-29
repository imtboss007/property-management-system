const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
let failed = 0;
function check(name, condition) {
  if (!condition) {
    console.error("FAIL:", name);
    failed++;
  } else {
    console.log("PASS:", name);
  }
}
const migration = read("supabase/migrations/202610290005_whatsapp_cloud_scheduler.sql");
const edge = read("supabase/functions/whatsapp-cloud-scheduler/index.ts");
const client = read("src/lib/cloud-whatsapp.ts");
const ui = read("src/WhatsAppScheduler.tsx");
const config = read("supabase/config.toml");

check("Cloud queue keeps company/user scope and explicit consent",
  /company_id uuid not null references public\.companies/.test(migration) &&
  /created_by uuid not null references auth\.users/.test(migration) &&
  /consent_confirmed boolean not null default false/.test(migration) &&
  /consent_confirmed = true/.test(migration));
check("Cloud sender is locked to one configured company at status, queue, and reply-stop layers",
  /AXIVESTRA_WA_COMPANY_ID/.test(edge) &&
  /companyId !== senderCompanyId/.test(edge) &&
  /target_company_id: senderCompanyId/.test(edge) &&
  /company_id = target_company_id/.test(migration));
check("Due queue uses locked claims and avoids blind crash retries",
  /for update skip locked/i.test(migration) &&
  /status = 'sending'/.test(migration) &&
  /Delivery status is uncertain/.test(migration));
check("Cloud dispatcher checks its secret and sends through the official Meta Graph API",
  /x-axivestra-scheduler-secret/i.test(edge) &&
  /graph\.facebook\.com/.test(edge) &&
  /META_ACCESS_TOKEN/.test(edge) &&
  /META_PHONE_NUMBER_ID/.test(edge));
check("Incoming reply handler validates Meta's HMAC signature",
  /x-hub-signature-256/i.test(edge) &&
  /META_APP_SECRET/.test(edge) &&
  /crypto\.subtle\.sign/.test(edge));
check("User operations verify session and selected company before accessing the queue",
  /supabase\.auth\.getUser/.test(client) &&
  /axivestra\.activeCompanyId/.test(client) &&
  /company_memberships/.test(client));
check("Cloud mode retains the local sender fallback and requires approved template fields when needed",
  /if \(cloudMode\) return createCloudApi\(\)/.test(ui) &&
  /The Windows sender starts hidden at login/.test(ui) &&
  /Approved WhatsApp template name/.test(ui));
check("Cloud Edge Function performs custom authentication because JWT gateway verification is disabled",
  /\[functions\.whatsapp-cloud-scheduler\][\s\S]*?verify_jwt = false/.test(config) &&
  /auth\.getUser/.test(edge) &&
  /x-axivestra-scheduler-secret/i.test(edge));

if (failed) {
  console.error(`\\n${failed} cloud scheduler contract check(s) failed.`);
  process.exit(1);
}
console.log("\\nAll cloud scheduler contract checks passed.");
