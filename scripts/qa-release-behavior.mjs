// اختبار سلوكي بلا بيانات حقيقية ولا شبكة: npm run qa:release (جزء من qa:release)
// يشغّل مساري الدفع (paylink create) وتخطيطات English/Qudurat الحقيقية فوق محاكاة في الذاكرة.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "package.json"))("typescript");
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

// ---------------- محمِّل TS بسيط مع محاكاة الوحدات ----------------
const permissive = () => new Proxy(function () {}, { get: (_t, k) => (k === "__esModule" ? false : permissive()), apply: () => permissive() });
function loadModule(rel, mocks, env = {}, consoleImpl = console) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = { exports: {} };
  const req = (id) => {
    if (id in mocks) return mocks[id];
    if (id.startsWith("@/lib/")) return loadModule(`src/lib/${id.slice(6)}.ts`, mocks, env, consoleImpl);
    if (id === "server-only") return {};
    return permissive();
  };
  vm.runInNewContext(out, {
    module: mod, exports: mod.exports, require: req, process: { env }, Promise, Set, Map, Date, Math, Number, String, Array, Object, Boolean, RegExp, JSON, Error, console: consoleImpl, URL,
  });
  return mod.exports;
}

class FakeResponse {
  constructor(body, status) { this.body = body; this.status = status; }
  static json(body, init) { return new FakeResponse(body, init?.status ?? 200); }
}

// ---------------- الدفع المتوقف ----------------
function loadPaylinkCreate(flag) {
  const calls = { db: 0, paylink: 0 };
  const guardClient = new Proxy({}, { get: () => { calls.db++; throw new Error("db touched"); } });
  const mocks = {
    "next/server": { NextResponse: FakeResponse },
    "@/lib/supabase-admin": { createSupabaseAdminClient: () => guardClient },
    "@/lib/pilot-parent": { resolveParentContext: async () => ({ parentId: "p1", fullName: "P" }) },
    "@/lib/paylink": {
      createPaylinkInvoice: async () => { calls.paylink++; return { ok: false }; },
      getPaylinkInvoice: async () => { calls.paylink++; return { ok: false }; },
      getPaylinkTransactionsByOrderNumber: async () => { calls.paylink++; return { ok: false }; },
    },
    "@/lib/paylink-verify": { verifyAndActivatePaylinkPayment: async () => { calls.paylink++; return { ok: false, status: 500, error: "x" }; } },
    "@/lib/api-rate-limit": { checkRateLimit: async () => ({ ok: true }), declaredBodyExceeds: () => false, rateLimitRejectionResponse: () => null, readJsonBodyLimited: async (r) => ({ ok: true, body: r.__body }) },
  };
  const env = flag === undefined ? {} : { KHOTA_PAYMENTS_ENABLED: flag };
  return { POST: loadModule("src/app/api/payments/paylink/create/route.ts", mocks, env).POST, calls };
}
for (const flag of [undefined, "false", "TRUE", ""]) {
  await check(`payments paused (KHOTA_PAYMENTS_ENABLED=${JSON.stringify(flag)}) -> 503, no invoice, no DB access`, async () => {
    const { POST, calls } = loadPaylinkCreate(flag);
    const res = await POST({ __body: { subscriptionId: "s1" } });
    assert.equal(res.status, 503);
    assert.equal(calls.paylink, 0);
    assert.equal(calls.db, 0);
  });
}
await check("payments enabled=true passes the gate (control)", async () => {
  const { POST, calls } = loadPaylinkCreate("true");
  await POST({ __body: { subscriptionId: "s1" } }).catch(() => {});
  assert.ok(calls.db > 0, "route proceeds past the gate when explicitly enabled");
});

// ---------------- المسارات غير الجاهزة ----------------
for (const d of ["english", "qudurat"]) {
  const run = (env) => {
    const mocks = { "next/navigation": { notFound: () => { throw new Error("NEXT_NOT_FOUND"); } } };
    return loadModule(`src/app/${d}/layout.tsx`, mocks, env).default({ children: "ok" });
  };
  await check(`/${d} layout -> 404 in production`, async () => assert.throws(() => run({ NODE_ENV: "production" }), /NEXT_NOT_FOUND/));
  await check(`/${d} layout -> renders in production only when explicitly enabled`, async () => assert.equal(run({ NODE_ENV: "production", KHOTA_ENABLE_UNFINISHED_ROUTES: "true" }), "ok"));
  await check(`/${d} layout -> renders in development`, async () => assert.equal(run({ NODE_ENV: "development" }), "ok"));
}

// ---------------- أسعار الخطط غير الصالحة + فشل كتابة الحضور ----------------
// عميل Supabase وهمي: كل جدول يُرجع صفًا ثابتًا، وتُسجَّل عمليات الكتابة والـRPC.
function fakeClient(rows, log, failWrites = {}) {
  const from = (table) => {
    let op = "select";
    const q = {
      select: () => q, eq: () => q, in: () => q, ilike: () => q, is: () => q, order: () => q, limit: () => q,
      insert: () => { op = "insert"; log.push(`${table}.insert`); return q; },
      update: (v) => { op = "update"; log.push(`${table}.update`); if (v?.status) log.push(`${table}.update:${v.status}`); return q; },
      upsert: () => { op = "upsert"; log.push(`${table}.upsert`); return q; },
      delete: () => { op = "delete"; log.push(`${table}.delete`); return q; },
      maybeSingle: async () => ({ data: Array.isArray(rows[table]) ? rows[table][0] ?? null : rows[table] ?? null, error: null }),
      single: async () => ({ data: { id: `${table}-new` }, error: null }),
      then: (res, rej) => Promise.resolve({
        data: Array.isArray(rows[table]) ? rows[table] : rows[table] ? [rows[table]] : [],
        error: op === "upsert" && failWrites[table] ? { message: "boom" } : null,
      }).then(res, rej),
    };
    return q;
  };
  return { from, rpc: async (name) => { log.push(`rpc:${name}`); return { data: name === "cohort_available_seats" ? 5 : "sub-new", error: null }; } };
}
const rl = { checkRateLimit: async () => ({ ok: true }), declaredBodyExceeds: () => false, rateLimitRejectionResponse: () => null, readJsonBodyLimited: async (r) => ({ ok: true, body: r.__body }) };
const silent = { ...console, error: () => {} };

for (const price of [0, -5, "-1", "abc", NaN, Infinity]) {
  await check(`enroll rejects plan price ${JSON.stringify(String(price))} with 409 and creates nothing`, async () => {
    const log = [];
    const rows = {
      parents: { id: "p1" },
      cohorts: { id: "c1", plan_id: "plan1", grade_band: null, status: "open", product: "focus_room", days_of_week: [0, 2] },
      plans: { id: "plan1", product: "focus_room", active: true, price_sar: price, days_per_week: 2 },
    };
    const mocks = {
      "next/server": { NextResponse: FakeResponse },
      "@/lib/supabase-server": { createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "u1", email: "p1@example.test" } } }) } }) },
      "@/lib/supabase-admin": { createSupabaseAdminClient: () => fakeClient(rows, log) },
      "@/lib/platform-settings": { getRuntimeSettings: async () => ({ registrationEnabled: true }) },
      "@/lib/api-rate-limit": rl,
    };
    const POST = loadModule("src/app/api/enroll/route.ts", mocks, {}).POST;
    const res = await POST({ __body: { parentName: "P", phone: "0500000001", childName: "Sara", grade: 1, cohortId: "c1" } });
    assert.equal(res.status, 409);
    assert.ok(!log.some((l) => /insert|rpc:enroll/.test(l)), `unexpected writes: ${log}`);
  });
}

for (const price of [0, -5, "abc"]) {
  await check(`paylink create rejects plan price ${JSON.stringify(String(price))} with no payment row or invoice`, async () => {
    const log = [];
    let invoices = 0;
    const rows = {
      subscriptions: { id: "s1", parent_id: "p1", plan_id: "plan1", status: "pending_payment", created_at: new Date().toISOString(), cohort_id: "c1" },
      cohorts: { id: "c1", status: "open" },
      plans: { name: "Plan", price_sar: price },
      parents: { full_name: "P", phone: "+966500000001", email: "p1@example.test" },
    };
    const mocks = {
      "next/server": { NextResponse: FakeResponse },
      "@/lib/supabase-admin": { createSupabaseAdminClient: () => fakeClient(rows, log) },
      "@/lib/pilot-parent": { resolveParentContext: async () => ({ parentId: "p1", fullName: "P" }) },
      "@/lib/paylink": { createPaylinkInvoice: async () => { invoices++; return { ok: false }; }, getPaylinkInvoice: async () => ({ ok: false }), getPaylinkTransactionsByOrderNumber: async () => ({ ok: false }) },
      "@/lib/paylink-verify": { verifyAndActivatePaylinkPayment: async () => ({ ok: false, status: 500, error: "x" }) },
      "@/lib/api-rate-limit": rl,
    };
    const POST = loadModule("src/app/api/payments/paylink/create/route.ts", mocks, { KHOTA_PAYMENTS_ENABLED: "true" }).POST;
    const res = await POST({ __body: { subscriptionId: "s1" } });
    assert.equal(res.status, 500, JSON.stringify(res.body));
    assert.equal(res.body.error, "تعذّر تحديد سعر الخطة");
    assert.equal(invoices, 0);
    assert.ok(!log.some((l) => l === "payments.insert"), `payment row created: ${log}`);
  });
}

function loadSessionReport(failAttendance, log) {
  const rows = {
    sessions: { id: "sess1", teacher_id: "t1", cohort_id: "c1", status: "scheduled", ends_at: new Date(Date.now() + 3600_000).toISOString() },
    subscriptions: [{ child_id: "kid1" }],
  };
  const mocks = {
    "next/server": { NextResponse: FakeResponse },
    "@/lib/supabase-admin": { createSupabaseAdminClient: () => fakeClient(rows, log, failAttendance ? { attendance: true } : {}) },
    "@/lib/require-teacher": { requireTeacher: async () => ({ ok: true, userId: "u1", teacherId: "t1" }) },
    "@/lib/makeup-credits": { issueMakeupCreditIfEligible: async () => { log.push("makeup"); } },
    "@/lib/platform-settings": { getRuntimeSettings: async () => ({ attendanceLockHours: 24 }) },
    "@/lib/api-rate-limit": rl,
  };
  return loadModule("src/app/api/session-report/submit/route.ts", mocks, {}, silent).POST;
}
const reportBody = {
  sessionId: "sess1",
  entries: [{ childId: "kid1", subjectsCompleted: ["math"], independenceRating: 3, focusRating: 3, tomorrowReadiness: "ok", teacherNote: "n", needsSpecialist: false, materialsReady: true, tomorrowTestStatus: "", remainingReview: "", readinessStatus: "ready", attended: false, absenceReason: "excused" }],
};
await check("session report: attendance write failure -> 500, no success, no makeup credit", async () => {
  const log = [];
  const res = await loadSessionReport(true, log)({ __body: reportBody });
  assert.equal(res.status, 500);
  assert.ok(res.body.error && !res.body.ok);
  assert.ok(!log.includes("makeup"), "makeup credit must not be issued after a failed attendance write");
  assert.ok(!log.includes("sessions.update:completed"), "session must not be marked completed when attendance fails");
});
await check("session report: attendance write success -> 200 (control)", async () => {
  const log = [];
  const res = await loadSessionReport(false, log)({ __body: reportBody });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(log.includes("attendance.upsert"));
  assert.ok(log.includes("sessions.update:completed"), "session is completed when attendance succeeds");
  assert.ok(log.indexOf("attendance.upsert") < log.indexOf("sessions.update:completed"), "completed only after attendance");
});

console.log(failures === 0 ? "\nALL RELEASE-BEHAVIOR CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
