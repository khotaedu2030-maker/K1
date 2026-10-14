// فحص انحدار لجاهزية الإصدار (بدون شبكة): npm run qa:release
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${name}: ${e.message}`);
  }
}

// ---- الدفع متوقف: create يُغلق قبل أي استدعاء Paylink، وwebhook/callback لا يُقفَلان أبدًا ----
check("paylink create is gated before invoice creation", () => {
  const src = read("src/app/api/payments/paylink/create/route.ts");
  const post = src.slice(src.indexOf("export async function POST"));
  const gate = post.indexOf("if (!areOnlinePaymentsEnabled())");
  assert.ok(gate > 0, "gate missing in POST");
  for (const call of ["createSupabaseAdminClient(", "await createPaylinkInvoice(", "verifyAndActivatePaylinkPayment("]) {
    const at = post.indexOf(call);
    assert.ok(at === -1 || gate < at, `gate must precede ${call}`);
  }
});
check("createPaylinkInvoice is only used by the gated create route", () => {
  const users = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name) && fs.readFileSync(p, "utf8").includes("createPaylinkInvoice")) users.push(path.relative(root, p).replace(/\\/g, "/"));
    }
  })(path.join(root, "src"));
  assert.deepEqual(users.sort(), ["src/app/api/payments/paylink/create/route.ts", "src/lib/paylink.ts"]);
});
check("webhook, callback and verification are never blocked by the payments flag", () => {
  for (const f of ["src/app/api/payments/paylink/webhook/route.ts", "src/app/api/payments/paylink/callback/route.ts", "src/lib/paylink-verify.ts"]) {
    assert.ok(!/areOnlinePaymentsEnabled|PAYMENTS_ENABLED/.test(read(f)), `${f} must settle paid invoices regardless of the flag`);
  }
});

// ---- الخطط: لا اشتراك إلا لخطة فعّالة ومسعّرة ----
check("enroll API rejects inactive or unpriced plans", () => {
  const src = read("src/app/api/enroll/route.ts");
  assert.ok(src.includes("!plan.active"));
  assert.ok(src.includes("plan.price_sar === null"));
});

// ---- المسارات غير الجاهزة ----
check("english and qudurat return 404 unless explicitly enabled", () => {
  for (const d of ["english", "qudurat"]) {
    const src = read(`src/app/${d}/layout.tsx`);
    assert.ok(src.includes("notFound()") && src.includes("areUnfinishedRoutesEnabled"));
  }
  const helper = read("src/lib/unfinished-routes.ts");
  assert.ok(helper.includes('NODE_ENV !== "production"') && helper.includes("KHOTA_ENABLE_UNFINISHED_ROUTES"));
});

console.log(failures === 0 ? "\nALL RELEASE-READINESS CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
