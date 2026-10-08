// فحص انحدار لجاهزية الإصدار (بدون شبكة): node scripts/qa-release-readiness.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "package.json"))("typescript");
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

// ---- الخطط: لا شراء إلا لخطة فعّالة بسعر موجب ----
const planSrc = ts.transpileModule(read("src/lib/plan-display.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const planMod = { exports: {} };
vm.runInNewContext(planSrc, { module: planMod, exports: planMod.exports, Number, String, Array, Boolean });
const { isPlanPurchasable } = planMod.exports;
check("isPlanPurchasable requires active + positive price", () => {
  assert.equal(isPlanPurchasable({ active: true, price_sar: 399 }), true);
  assert.equal(isPlanPurchasable({ active: false, price_sar: 399 }), false);
  assert.equal(isPlanPurchasable({ active: true, price_sar: null }), false);
  assert.equal(isPlanPurchasable({ active: true, price_sar: 0 }), false);
  assert.equal(isPlanPurchasable({ price_sar: 399 }), false);
});
check("enroll API rejects inactive or non-positive-price plans", () => {
  const src = read("src/app/api/enroll/route.ts");
  assert.ok(src.includes("!plan.active"));
  assert.ok(src.includes("!(Number(plan.price_sar) > 0)"));
});
check("plans selector disables non-purchasable plans", () => {
  assert.ok(read("src/app/motabaa/plans/PlansSelector.tsx").includes("disabled={!isPlanPurchasable(p)}"));
});

// ---- الأطفال: ملكية childId في الخادم ومنع التكرار ----
check("enroll verifies childId ownership server-side and reuses children", () => {
  const src = read("src/app/api/enroll/route.ts");
  assert.ok(/\.eq\("id", requestedChildId\)\s*\.eq\("parent_id", parent\.id\)/.test(src), "childId must be scoped to the parent");
  assert.ok(src.includes("if (childCreated)"), "cleanup must only delete a child created in this request");
  assert.ok(src.includes('.in("status", ["pending_payment", "active", "paused"])'), "duplicate subscription guard");
});

// ---- SEO والمسارات غير الجاهزة ----
check("canonical is per-page and domain is www", () => {
  const src = read("src/app/layout.tsx");
  assert.ok(!/canonical:\s*"\/"/.test(src), "global '/' canonical must not exist");
  assert.ok(src.includes('canonical: "./"'));
  assert.ok(src.includes("https://www.khota.sa"));
  assert.ok(read("src/app/sitemap.ts").includes("https://www.khota.sa"));
});
check("english and qudurat return 404 unless explicitly enabled", () => {
  for (const d of ["english", "qudurat"]) {
    const src = read(`src/app/${d}/layout.tsx`);
    assert.ok(src.includes("notFound()") && src.includes("areUnfinishedRoutesEnabled"));
  }
  const helper = read("src/lib/unfinished-routes.ts");
  assert.ok(helper.includes('NODE_ENV !== "production"') && helper.includes("KHOTA_ENABLE_UNFINISHED_ROUTES"));
});

// ---- المحتوى ----
check("terms do not hard-code plan prices", () => {
  assert.ok(!/\d{3}\s*ر\.س/.test(read("src/app/terms/page.tsx")));
});
check("FAQ covers grades 1-12", () => {
  const src = read("src/app/help/page.tsx");
  assert.ok(src.includes("الصف الأول الابتدائي حتى الثالث الثانوي") && src.includes("7–12"));
});

// ---- الواجهة ----
check("footer and empty-state CSS hardening present", () => {
  const css = read("src/app/globals.css");
  assert.ok(css.includes(".footer-top .btn{max-width:100%;white-space:normal") && css.includes(".empty-state{"));
});
check("parent empty states use the shared EmptyState", () => {
  for (const f of ["subscriptions", "children", "payments", "reports", "recommendations"]) {
    assert.ok(read(`src/app/parent/${f}/page.tsx`).includes("<EmptyState"), `${f} page`);
  }
});

console.log(failures === 0 ? "\nALL RELEASE-READINESS CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
