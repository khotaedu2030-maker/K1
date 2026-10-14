// فحص جاهزية رحلات المستخدم (ثابت + في الذاكرة، بلا شبكة ولا بيانات حقيقية): npm run qa:e2e
// - حدود الصلاحيات لكل مسار API/صفحة (ولي أمر / معلم / أدمن / طالب)
// - الدفع المتوقف: لا فاتورة ولا سجل دفع، بينما webhook/callback يستمران في تسوية الفواتير المدفوعة
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
async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${name}: ${e.message}`);
  }
}

function walk(dir, test) {
  const out = [];
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(rel, test));
    else if (test(e.name)) out.push(rel);
  }
  return out;
}

const permissive = () => new Proxy(function () {}, { get: (_t, k) => (k === "__esModule" ? false : permissive()), apply: () => permissive() });
function loadModule(rel, mocks, env = {}) {
  const out = ts.transpileModule(read(rel), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = { exports: {} };
  const req = (id) => {
    if (id in mocks) return mocks[id];
    if (id.startsWith("@/lib/")) return loadModule(`src/lib/${id.slice(6)}.ts`, mocks, env);
    if (id === "server-only") return {};
    return permissive();
  };
  vm.runInNewContext(out, {
    module: mod, exports: mod.exports, require: req, process: { env }, Promise, Set, Map, Date, Math, Number, String, Array, Object, Boolean, RegExp, JSON, Error, console, URL, Request, Headers, TextEncoder, crypto,
  });
  return mod.exports;
}

class FakeResponse {
  constructor(body, status) { this.body = body; this.status = status; }
  static json(body, init) { return new FakeResponse(body, init?.status ?? 200); }
  static redirect(url) { const r = new FakeResponse(null, 307); r.location = String(url); return r; }
}

// ---------- 1) كل API إداري/معلم محمي بحارس الدور ----------
await check("every /api/admin route requires an admin permission", () => {
  for (const f of walk("src/app/api/admin", (n) => n === "route.ts")) {
    assert.ok(/requirePermission|requireAdmin|requireSuperAdmin/.test(read(f)), `${f} has no admin guard`);
  }
});
await check("every /admin page checks admin identity", () => {
  for (const f of walk("src/app/admin", (n) => n === "page.tsx")) {
    assert.ok(read(f).includes("getAdminIdentity"), `${f} has no admin identity check`);
  }
});
await check("teacher mutation APIs require an active teacher and scope by teacher ownership", () => {
  for (const f of ["session-report/submit", "goals/submit", "assessment/submit"]) {
    assert.ok(read(`src/app/api/${f}/route.ts`).includes("requireTeacher()"), `${f}: requireTeacher missing`);
  }
  assert.ok(/session\.teacher_id !== teacherCheck\.teacherId/.test(read("src/app/api/session-report/submit/route.ts")));
  for (const f of ["goals/submit", "assessment/submit"]) {
    assert.ok(read(`src/app/api/${f}/route.ts`).includes("teacher_id === teacherCheck.teacherId"), `${f}: ownership check missing`);
  }
  assert.ok(read("src/app/teacher/layout.tsx").includes("getTeacherIdentity"));
});
await check("parent/student APIs derive the child from the session, not blindly from the request", () => {
  const mark = read("src/app/api/attendance/mark/route.ts");
  assert.ok(mark.includes("child.parent_id !== parent.id"));
  const enter = read("src/app/api/student-mode/enter/route.ts");
  assert.ok(enter.includes("child.parent_id !== parent.id"));
  assert.ok(read("src/app/api/student/attendance/mark/route.ts").includes("getActiveStudentSession"));
  assert.ok(read("src/app/api/student/tasks/toggle/route.ts").includes("task.child_id !== session.childId"));
  for (const p of ["today", "schedule", "tasks", "progress", "achievements"]) {
    assert.ok(read(`src/app/student/${p}/page.tsx`).includes("getActiveStudentSession"), `student/${p}`);
  }
});
await check("API routes without an auth helper are an explicit public allowlist", () => {
  const publicRoutes = new Set([
    "src/app/api/auth/otp/request/route.ts",
    "src/app/api/auth/otp/verify/route.ts",
    "src/app/api/contact/route.ts",
    "src/app/api/level-test/start/route.ts",
    "src/app/api/level-test/submit/route.ts",
    "src/app/api/level-test/tracks/route.ts",
    "src/app/api/payments/paylink/callback/route.ts",
    "src/app/api/pilot-auth/login/route.ts",
    "src/app/api/pilot-auth/logout/route.ts",
    "src/app/api/pilot-auth/status/route.ts",
    "src/app/api/teacher-applications/route.ts",
  ]);
  const guard = /requirePermission|requireAdmin|requireTeacher|getUser\(|resolveParentContext|getActiveStudentSession|PAYLINK_WEBHOOK_SECRET/;
  const unguarded = walk("src/app/api", (n) => n === "route.ts").filter((f) => !guard.test(read(f)));
  assert.deepEqual(unguarded.sort(), [...publicRoutes].sort());
});
await check("pilot-auth is impossible in production", () => {
  const src = read("src/lib/pilot-auth.ts");
  assert.ok(/NODE_ENV !== "production" && process\.env\.KHOTA_PILOT_AUTH === "true"/.test(src));
  for (const r of ["login", "logout", "status"]) assert.ok(read(`src/app/api/pilot-auth/${r}/route.ts`).includes("isPilotAuthEnabled()"));
  assert.ok(read("src/app/api/payment/confirm/route.ts").includes('NODE_ENV === "production"'), "manual confirm must be dev-only");
});

// ---------- 2) proxy: مسارات محمية + حارس الأصل + قائمة وضع الطالب ----------
await check("proxy protects parent/teacher/admin/student pages and student mode is allowlisted", () => {
  const src = read("src/proxy.ts");
  assert.ok(src.includes('["/parent", "/teacher", "/admin", "/student"]'));
  assert.ok(src.includes('["/parent", "/teacher", "/admin"]'));
  assert.ok(src.includes("/api/:path*"));
  assert.ok(src.includes('CROSS_ORIGIN_API_EXEMPTIONS = new Set(["/api/payments/paylink/webhook"])'));
  const c = loadModule("src/lib/student-mode-constants.ts", {});
  for (const p of ["/api/student/tasks/toggle", "/api/student/attendance/mark", "/api/student-mode/exit/verify", "/api/student-mode/exit/request-otp"]) assert.equal(c.isStudentModeAllowedApiPath(p), true, p);
  for (const p of ["/api/attendance/mark", "/api/enroll", "/api/payments/paylink/create", "/api/admin/parents", "/api/student-mode/enter", "/api/student-mode/exit"]) assert.equal(c.isStudentModeAllowedApiPath(p), false, p);
});
await check("unsafe cross-origin browser requests are rejected, safe methods are not", () => {
  const { validateUnsafeRequestOrigin: v } = loadModule("src/lib/request-security.ts", {});
  const mk = (method, headers) => ({ method, url: "https://www.khota.sa/api/enroll", headers: new Headers(headers) });
  assert.equal(v(mk("POST", { "sec-fetch-site": "cross-site" })).ok, false);
  assert.equal(v(mk("POST", { origin: "https://evil.example" })).ok, false);
  assert.equal(v(mk("POST", { origin: "https://www.khota.sa" })).ok, true);
  assert.equal(v(mk("GET", { "sec-fetch-site": "cross-site" })).ok, true);
});

// ---------- 3) الدفع: متوقف افتراضيًا، والتسوية تعمل دائمًا ----------
const payCalls = () => ({ db: 0, paylink: 0, verify: [] });
function loadCreate(flag, calls, parentCtx = { parentId: "p1", fullName: "P" }) {
  const guardClient = new Proxy({}, { get: () => { calls.db++; throw new Error("db touched"); } });
  const mocks = {
    "next/server": { NextResponse: FakeResponse },
    "@/lib/supabase-admin": { createSupabaseAdminClient: () => guardClient },
    "@/lib/pilot-parent": { resolveParentContext: async () => parentCtx },
    "@/lib/paylink": {
      createPaylinkInvoice: async () => { calls.paylink++; return { ok: false }; },
      getPaylinkInvoice: async () => { calls.paylink++; return { ok: false }; },
      getPaylinkTransactionsByOrderNumber: async () => { calls.paylink++; return { ok: false }; },
    },
    "@/lib/paylink-verify": { verifyAndActivatePaylinkPayment: async () => { calls.paylink++; return { ok: false, status: 500, error: "x" }; } },
    "@/lib/api-rate-limit": { checkRateLimit: async () => ({ ok: true }), declaredBodyExceeds: () => false, rateLimitRejectionResponse: () => null, readJsonBodyLimited: async (r) => ({ ok: true, body: r.__body }) },
  };
  return loadModule("src/app/api/payments/paylink/create/route.ts", mocks, flag === undefined ? {} : { KHOTA_PAYMENTS_ENABLED: flag }).POST;
}
for (const flag of [undefined, "false", "1", "yes"]) {
  await check(`create with payments disabled (${JSON.stringify(flag)}) -> 503, no invoice, no DB read/write`, async () => {
    const calls = payCalls();
    const res = await loadCreate(flag, calls)({ __body: { subscriptionId: "s1" } });
    assert.equal(res.status, 503);
    assert.equal(calls.paylink + calls.db, 0);
  });
}
await check("create requires a parent session before anything else", async () => {
  const calls = payCalls();
  const res = await loadCreate("true", calls, null)({ __body: { subscriptionId: "s1" } });
  assert.equal(res.status, 401);
  assert.equal(calls.paylink + calls.db, 0);
});
await check("create (enabled) rejects another parent's subscription without creating an invoice/payment", async () => {
  const calls = payCalls();
  const writes = [];
  const table = (name) => {
    const q = { select: () => q, eq: () => q, in: () => q, maybeSingle: async () => ({ data: { id: "s1", parent_id: "OTHER", plan_id: "x", status: "pending_payment" } }),
      insert: (v) => { writes.push([name, "insert"]); return q; }, update: () => { writes.push([name, "update"]); return q; } };
    return q;
  };
  const mocks = {
    "next/server": { NextResponse: FakeResponse },
    "@/lib/supabase-admin": { createSupabaseAdminClient: () => ({ from: table }) },
    "@/lib/pilot-parent": { resolveParentContext: async () => ({ parentId: "p1", fullName: "P" }) },
    "@/lib/paylink": { createPaylinkInvoice: async () => { calls.paylink++; return { ok: false }; }, getPaylinkInvoice: async () => ({ ok: false }), getPaylinkTransactionsByOrderNumber: async () => ({ ok: false }) },
    "@/lib/paylink-verify": { verifyAndActivatePaylinkPayment: async () => ({ ok: false, status: 500, error: "x" }) },
    "@/lib/api-rate-limit": { checkRateLimit: async () => ({ ok: true }), declaredBodyExceeds: () => false, rateLimitRejectionResponse: () => null, readJsonBodyLimited: async (r) => ({ ok: true, body: r.__body }) },
  };
  const POST = loadModule("src/app/api/payments/paylink/create/route.ts", mocks, { KHOTA_PAYMENTS_ENABLED: "true" }).POST;
  const res = await POST({ __body: { subscriptionId: "s1" } });
  assert.equal(res.status, 404);
  assert.equal(calls.paylink, 0);
  assert.deepEqual(writes, []);
});

function loadWebhook(env, verifyCalls) {
  const mocks = {
    "next/server": { NextResponse: FakeResponse },
    "@/lib/paylink-verify": { verifyAndActivatePaylinkPayment: async (t) => { verifyCalls.push(t); return { ok: true, alreadyActive: false, subscriptionId: "s1", paymentId: "pay1" }; } },
    "@/lib/api-rate-limit": { checkRateLimit: async () => ({ ok: true }), declaredBodyExceeds: () => false, rateLimitRejectionResponse: () => null, readJsonBodyLimited: async (r) => ({ ok: true, body: r.__body }) },
  };
  return loadModule("src/app/api/payments/paylink/webhook/route.ts", mocks, env).POST;
}
const hookReq = (auth, body) => ({ headers: new Headers(auth ? { authorization: auth } : {}), __body: body });
const hookBody = { transactionNo: "T1", merchantOrderNumber: "pay1", orderStatus: "Paid", amount: 100 };
for (const flag of [undefined, "false"]) {
  await check(`webhook settles a paid invoice while payments are disabled (${JSON.stringify(flag)})`, async () => {
    const v = [];
    const env = { PAYLINK_WEBHOOK_SECRET: "s3cret", ...(flag === undefined ? {} : { KHOTA_PAYMENTS_ENABLED: flag }) };
    const res = await loadWebhook(env, v)(hookReq("Bearer s3cret", hookBody));
    assert.equal(res.status, 200);
    assert.deepEqual(v, ["T1"]);
  });
}
await check("webhook rejects missing/wrong secret and unconfigured secret without verifying", async () => {
  const v = [];
  assert.equal((await loadWebhook({ PAYLINK_WEBHOOK_SECRET: "s3cret" }, v)(hookReq(null, hookBody))).status, 401);
  assert.equal((await loadWebhook({ PAYLINK_WEBHOOK_SECRET: "s3cret" }, v)(hookReq("Bearer wrong!", hookBody))).status, 401);
  assert.equal((await loadWebhook({}, v)(hookReq("Bearer s3cret", hookBody))).status, 500);
  assert.deepEqual(v, []);
});
await check("callback settles through the same verifier while payments are disabled", async () => {
  const v = [];
  const mocks = {
    "next/server": { NextResponse: FakeResponse },
    "@/lib/supabase-admin": { createSupabaseAdminClient: () => { throw new Error("no db needed on success"); } },
    "@/lib/paylink-verify": { verifyAndActivatePaylinkPayment: async (t) => { v.push(t); return { ok: true, alreadyActive: false, subscriptionId: "s1", paymentId: "pay1" }; } },
    "@/lib/api-rate-limit": { checkRateLimit: async () => ({ ok: true }), rateLimitRejectionResponse: () => null },
  };
  const GET = loadModule("src/app/api/payments/paylink/callback/route.ts", mocks, {}).GET;
  const res = await GET({ url: "https://www.khota.sa/api/payments/paylink/callback?orderNumber=pay1&transactionNo=T1" });
  assert.deepEqual(v, ["T1"]);
  assert.match(res.location, /\/motabaa\/enroll\/payment\?.*sub=s1.*paid=1/);
});
await check("verifier trusts only Paylink getInvoice and validates amount, currency, status, provider_ref", () => {
  const src = read("src/lib/paylink-verify.ts");
  for (const needle of ["getPaylinkInvoice(transactionNo)", 'orderStatus !== "paid"', "gatewayCurrency !== \"SAR\"", "paymentRow.provider_ref !== transactionNo", "Math.abs(Number(paymentRow.amount_sar) - amountSar) > 0.01"]) {
    assert.ok(src.includes(needle), needle);
  }
});
await check("payment page shows disabled state and only the gated create route builds invoices", () => {
  assert.ok(read("src/app/motabaa/enroll/payment/page.tsx").includes("areOnlinePaymentsEnabled()"));
  assert.ok(read("src/app/motabaa/enroll/payment/PaymentClient.tsx").includes("{!paymentsEnabled && ("));
  assert.ok(read("src/app/motabaa/enroll/payment/PaymentClient.tsx").includes('NODE_ENV !== "production"'), "manual confirm UI is dev-only");
});

// ---------- 4) التسجيل: اشتراك pending فقط، بلا أي سجل دفع ----------
await check("enroll creates only a pending_payment subscription (no payments row) behind auth + rate limit + registration flag", () => {
  const src = read("src/app/api/enroll/route.ts");
  assert.ok(src.includes("status: 401") && src.includes("checkRateLimit") && src.includes("registrationEnabled"));
  assert.ok(src.includes("enroll_subscription_atomic"));
  assert.ok(!/from\("payments"\)/.test(src), "enroll must not touch payments");
  assert.ok(src.includes('cohort.status !== "open"') && src.includes("requestedBand"));
});

console.log(failures === 0 ? "\nALL E2E-READINESS CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
