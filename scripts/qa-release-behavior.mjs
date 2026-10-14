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
      select: () => q, eq: () => q, neq: () => q, in: () => q, ilike: () => q, is: () => q, order: () => q, limit: () => q,
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

function loadSessionReport(failAttendance, log, sessionPatch = {}) {
  const rows = {
    sessions: { id: "sess1", teacher_id: "t1", cohort_id: "c1", status: "scheduled", starts_at: new Date(Date.now() - 600_000).toISOString(), ends_at: new Date(Date.now() + 3600_000).toISOString(), ...sessionPatch },
    subscriptions: [{ child_id: "kid1" }],
  };
  const mocks = {
    "next/server": { NextResponse: FakeResponse },
    "@/lib/supabase-admin": { createSupabaseAdminClient: () => fakeClient(rows, log, failAttendance ? { attendance: true } : {}) },
    "@/lib/require-teacher": { requireTeacher: async () => ({ ok: true, userId: "u1", teacherId: "t1" }) },
    "@/lib/makeup-credits": { issueMakeupCreditIfEligible: async () => { log.push("makeup"); return { issued: true }; } },
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

// ---------------- تسجيل مكرر، توقيت التقرير، وعدم الكتابة فوق حضور المعلم ----------------
// قاعدة بيانات في الذاكرة (تدعم eq/in/is/order/insert/upsert[ignoreDuplicates]/update/delete وrpc للتسجيل).
function memDb(seed, log) {
  const t = JSON.parse(JSON.stringify(seed));
  let n = 0;
  const from = (table) => {
    const rows = (t[table] ??= []);
    let op = "select", filters = [], payload = null, opts = {}, ord = null;
    const exec = () => {
      const matched = rows.filter((r) => filters.every((f) => f(r)));
      if (ord) matched.sort((a, b) => (String(a[ord.k]) < String(b[ord.k]) ? -1 : 1) * (ord.asc ? 1 : -1));
      if (op === "insert") {
        const row = { id: `${table}-${++n}`, created_at: new Date().toISOString(), ...payload };
        rows.push(row); log.push(`${table}.insert`);
        return [row];
      }
      if (op === "upsert") {
        log.push(`${table}.upsert`);
        const keys = String(opts.onConflict ?? "id").split(",");
        for (const p of Array.isArray(payload) ? payload : [payload]) {
          const existing = rows.find((r) => keys.every((k) => r[k] === p[k]));
          if (!existing) rows.push({ id: `${table}-${++n}`, ...p });
          else if (!opts.ignoreDuplicates) Object.assign(existing, p);
        }
        return [];
      }
      if (op === "update") { log.push(`${table}.update`); matched.forEach((r) => Object.assign(r, payload)); return matched; }
      if (op === "delete") { log.push(`${table}.delete`); matched.forEach((r) => rows.splice(rows.indexOf(r), 1)); return matched; }
      return matched;
    };
    const q = {
      select: () => q,
      eq: (k, v) => { filters.push((r) => r[k] === v); return q; },
      neq: (k, v) => { filters.push((r) => r[k] !== v); return q; },
      in: (k, a) => { filters.push((r) => a.includes(r[k])); return q; },
      is: (k, v) => { filters.push((r) => (r[k] ?? null) === v); return q; },
      ilike: () => q,
      order: (k, o) => { ord = { k, asc: o?.ascending !== false }; return q; },
      limit: () => q,
      insert: (p) => { op = "insert"; payload = p; return q; },
      upsert: (p, o) => { op = "upsert"; payload = p; opts = o ?? {}; return q; },
      update: (p) => { op = "update"; payload = p; return q; },
      delete: () => { op = "delete"; return q; },
      maybeSingle: async () => ({ data: exec()[0] ?? null, error: null }),
      single: async () => ({ data: exec()[0] ?? null, error: null }),
      then: (res, rej) => Promise.resolve({ data: exec(), error: null }).then(res, rej),
    };
    return q;
  };
  const live = (cohortId) => (t.subscriptions ?? []).filter((s) => s.cohort_id === cohortId && ["active", "pending_payment"].includes(s.status));
  const rpc = async (name, args) => {
    log.push(`rpc:${name}`);
    const cohort = t.cohorts.find((c) => c.id === args.p_cohort_id);
    if (name === "cohort_available_seats") return { data: cohort.capacity - live(cohort.id).length, error: null };
    if (live(cohort.id).length >= cohort.capacity) return { data: null, error: { message: "cohort_full" } };
    const row = { id: `sub-${++n}`, child_id: args.p_child_id, parent_id: args.p_parent_id, plan_id: args.p_plan_id, cohort_id: args.p_cohort_id, status: "pending_payment", created_at: new Date().toISOString() };
    (t.subscriptions ??= []).push(row);
    return { data: row.id, error: null };
  };
  return { client: { from, rpc }, t };
}

const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString();
function loadEnrollMem(db, userId, email) {
  const mocks = {
    "next/server": { NextResponse: FakeResponse },
    "@/lib/supabase-server": { createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: userId, email } } }) } }) },
    "@/lib/supabase-admin": { createSupabaseAdminClient: () => db.client },
    "@/lib/platform-settings": { getRuntimeSettings: async () => ({ registrationEnabled: true }) },
    "@/lib/api-rate-limit": rl,
  };
  return loadModule("src/app/api/enroll/route.ts", mocks, {}, silent).POST;
}
const enrollSeed = (capacity) => ({
  parents: [{ id: "p1", user_id: "u1", email: "p1@example.test", phone: "+966500000001" }, { id: "p2", user_id: "u2", email: "p2@example.test", phone: "+966500000002" }],
  children: [], subscriptions: [],
  cohorts: [{ id: "c1", plan_id: "plan1", grade_band: null, status: "open", product: "focus_room", days_of_week: [0, 2], capacity }, { id: "c2", plan_id: "plan1", grade_band: null, status: "open", product: "focus_room", days_of_week: [1, 3], capacity }],
  plans: [{ id: "plan1", product: "focus_room", active: true, price_sar: 300, days_per_week: 2 }],
});
const enrollBody = (over = {}) => ({ __body: { parentName: "P", phone: "0500000001", childName: "Sara", grade: 1, cohortId: "c1", ...over } });

await check("enroll retry for the same parent+child+cohort reuses the pending subscription (no 2nd child/subscription/seat)", async () => {
  const log = [];
  const db = memDb(enrollSeed(1), log);
  const post = loadEnrollMem(db, "u1", "p1@example.test");
  const first = await post(enrollBody());
  assert.equal(first.status, 200);
  const retry = await post(enrollBody({ childName: " sara " }));
  assert.equal(retry.status, 200, JSON.stringify(retry.body));
  assert.equal(retry.body.subscriptionId, first.body.subscriptionId);
  assert.equal(db.t.children.length, 1);
  assert.equal(db.t.subscriptions.length, 1);
  assert.equal(log.filter((l) => l === "rpc:enroll_subscription_atomic").length, 1);
});
await check("enroll retry does not hold a second seat (capacity 2 stays at 1 live subscription)", async () => {
  const db = memDb(enrollSeed(2), []);
  const post = loadEnrollMem(db, "u1", "p1@example.test");
  await post(enrollBody()); await post(enrollBody()); await post(enrollBody());
  assert.equal(db.t.subscriptions.filter((s) => s.status === "pending_payment").length, 1);
  assert.equal(db.t.children.length, 1);
});
await check("enroll: same child already active in the cohort -> 409, nothing created", async () => {
  const db = memDb(enrollSeed(5), []);
  db.t.children.push({ id: "k1", parent_id: "p1", first_name: "Sara", grade: 1 });
  db.t.subscriptions.push({ id: "s-old", child_id: "k1", parent_id: "p1", cohort_id: "c1", status: "active", created_at: hoursAgo(100) });
  const res = await loadEnrollMem(db, "u1", "p1@example.test")(enrollBody());
  assert.equal(res.status, 409);
  assert.equal(db.t.children.length, 1);
  assert.equal(db.t.subscriptions.length, 1);
});
await check("enroll: another parent's same-named child/pending subscription is never reused", async () => {
  const db = memDb(enrollSeed(5), []);
  db.t.children.push({ id: "k1", parent_id: "p1", first_name: "Sara", grade: 1 });
  db.t.subscriptions.push({ id: "s-p1", child_id: "k1", parent_id: "p1", cohort_id: "c1", status: "pending_payment", created_at: hoursAgo(1) });
  const res = await loadEnrollMem(db, "u2", "p2@example.test")(enrollBody({ phone: "0500000002" }));
  assert.equal(res.status, 200);
  assert.notEqual(res.body.subscriptionId, "s-p1");
  const mine = db.t.subscriptions.find((s) => s.id === res.body.subscriptionId);
  assert.equal(mine.parent_id, "p2");
  assert.equal(db.t.children.length, 2);
});
await check("enroll control: different cohort or different child still creates a new enrollment", async () => {
  const db = memDb(enrollSeed(5), []);
  const post = loadEnrollMem(db, "u1", "p1@example.test");
  const a = await post(enrollBody());
  const b = await post(enrollBody({ cohortId: "c2" }));
  const c = await post(enrollBody({ childName: "Omar" }));
  assert.equal(new Set([a, b, c].map((r) => r.body.subscriptionId)).size, 3);
  assert.equal(db.t.subscriptions.length, 3);
});
await check("enroll: a stale pending subscription (>24h) is not reused", async () => {
  const db = memDb(enrollSeed(5), []);
  db.t.children.push({ id: "k1", parent_id: "p1", first_name: "Sara", grade: 1 });
  db.t.subscriptions.push({ id: "s-stale", child_id: "k1", parent_id: "p1", cohort_id: "c1", status: "pending_payment", created_at: hoursAgo(30) });
  const res = await loadEnrollMem(db, "u1", "p1@example.test")(enrollBody());
  assert.equal(res.status, 200);
  assert.notEqual(res.body.subscriptionId, "s-stale");
});
await check("enroll: two same-name/same-grade children under one parent -> 409, no guessing, nothing created", async () => {
  const log = [];
  const db = memDb(enrollSeed(5), log);
  db.t.children.push({ id: "k1", parent_id: "p1", first_name: "Sara", grade: 1 }, { id: "k2", parent_id: "p1", first_name: "sara ", grade: 1 });
  db.t.subscriptions.push({ id: "s-k1", child_id: "k1", parent_id: "p1", cohort_id: "c1", status: "pending_payment", created_at: hoursAgo(1) });
  const res = await loadEnrollMem(db, "u1", "p1@example.test")(enrollBody());
  assert.equal(res.status, 409);
  assert.equal(db.t.children.length, 2);
  assert.equal(db.t.subscriptions.length, 1);
  assert.ok(!log.includes("rpc:enroll_subscription_atomic"));
});
await check("enroll: stale pending -> new subscription reuses the existing child (no duplicate child row)", async () => {
  const db = memDb(enrollSeed(5), []);
  db.t.children.push({ id: "k1", parent_id: "p1", first_name: "Sara", grade: 1 });
  db.t.subscriptions.push({ id: "s-stale", child_id: "k1", parent_id: "p1", cohort_id: "c1", status: "pending_payment", created_at: hoursAgo(30) });
  const res = await loadEnrollMem(db, "u1", "p1@example.test")(enrollBody());
  assert.equal(res.status, 200);
  assert.notEqual(res.body.subscriptionId, "s-stale");
  assert.equal(db.t.children.length, 1);
  assert.equal(db.t.subscriptions.find((s) => s.id === res.body.subscriptionId).child_id, "k1");
});
await check("enroll: failed atomic RPC for a reused child never deletes the existing child", async () => {
  const db = memDb(enrollSeed(1), []);
  db.t.children.push({ id: "k1", parent_id: "p1", first_name: "Sara", grade: 1 });
  db.t.subscriptions.push({ id: "s-stale", child_id: "k1", parent_id: "p1", cohort_id: "c1", status: "pending_payment", created_at: hoursAgo(30) });
  db.t.cohorts[0].capacity = 2;
  const realRpc = db.client.rpc;
  db.client.rpc = async (name, args) => (name === "enroll_subscription_atomic" ? { data: null, error: { message: "cohort_full" } } : realRpc(name, args));
  const res = await loadEnrollMem(db, "u1", "p1@example.test")(enrollBody());
  assert.equal(res.status, 409);
  assert.equal(db.t.children.length, 1);
});
const inHours = (h) => new Date(Date.now() + h * 3600_000).toISOString();
for (const [label, sub, reused] of [
  ["future hold_expires_at is reused even if created_at is older than 24h", { created_at: hoursAgo(48), hold_expires_at: inHours(1) }, true],
  ["expired hold_expires_at is not reused even if created_at is recent", { created_at: hoursAgo(1), hold_expires_at: hoursAgo(0.1) }, false],
  ["legacy null hold_expires_at, recent created_at -> reused (24h fallback)", { created_at: hoursAgo(1), hold_expires_at: null }, true],
  ["legacy null hold_expires_at, old created_at -> not reused (24h fallback)", { created_at: hoursAgo(30), hold_expires_at: null }, false],
]) {
  await check(`enroll pending: ${label}`, async () => {
    const db = memDb(enrollSeed(5), []);
    db.t.children.push({ id: "k1", parent_id: "p1", first_name: "Sara", grade: 1 });
    db.t.subscriptions.push({ id: "s-p", child_id: "k1", parent_id: "p1", cohort_id: "c1", status: "pending_payment", ...sub });
    const res = await loadEnrollMem(db, "u1", "p1@example.test")(enrollBody());
    assert.equal(res.status, 200);
    assert.equal(res.body.subscriptionId === "s-p", reused);
    assert.equal(db.t.children.length, 1);
    assert.equal(db.t.subscriptions.length, reused ? 1 : 2);
  });
}
await check("enroll: a full cohort is still rejected for a new enrollment", async () => {
  const db = memDb(enrollSeed(1), []);
  db.t.subscriptions.push({ id: "s-x", child_id: "kx", parent_id: "p2", cohort_id: "c1", status: "active", created_at: hoursAgo(5) });
  const res = await loadEnrollMem(db, "u1", "p1@example.test")(enrollBody());
  assert.equal(res.status, 409);
  assert.equal(db.t.children.length, 0);
});

await check("session report before the session starts -> 409, nothing written", async () => {
  const log = [];
  const res = await loadSessionReport(false, log, { starts_at: new Date(Date.now() + 3600_000).toISOString() })({ __body: reportBody });
  assert.equal(res.status, 409);
  assert.ok(!log.some((l) => /upsert|update|insert/.test(l)), `unexpected writes: ${log}`);
  assert.ok(!log.includes("makeup"));
});
await check("session report after the attendance lock window is still rejected (upper bound kept)", async () => {
  const log = [];
  const res = await loadSessionReport(false, log, { starts_at: hoursAgo(60), ends_at: hoursAgo(48) })({ __body: reportBody });
  assert.equal(res.status, 409);
  assert.ok(!log.some((l) => /upsert|update|insert/.test(l)));
});

function attendanceSeed(existing) {
  const now = Date.now();
  return {
    parents: [{ id: "p1", user_id: "u1" }],
    children: [{ id: "kid1", parent_id: "p1" }],
    subscriptions: [{ id: "s1", child_id: "kid1", cohort_id: "c1", status: "active" }],
    sessions: [{ id: "sess1", cohort_id: "c1", teacher_id: "t1", starts_at: new Date(now - 300_000).toISOString(), ends_at: new Date(now + 1800_000).toISOString(), meeting_url: "https://meet.example/x" }],
    attendance: existing ? [existing] : [],
  };
}
const authUser = { createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } }) };
function loadParentMark(db) {
  return loadModule("src/app/api/attendance/mark/route.ts", { "next/server": { NextResponse: FakeResponse }, "@/lib/supabase-server": authUser, "@/lib/supabase-admin": { createSupabaseAdminClient: () => db.client }, "@/lib/api-rate-limit": rl }, {}, silent).POST;
}
function loadStudentMark(db) {
  return loadModule("src/app/api/student/attendance/mark/route.ts", { "next/server": { NextResponse: FakeResponse }, "@/lib/student-mode": { getActiveStudentSession: async () => ({ sessionId: "sm1", childId: "kid1" }) }, "@/lib/supabase-admin": { createSupabaseAdminClient: () => db.client }, "@/lib/api-rate-limit": rl }, {}, silent).POST;
}
const teacherAbsent = { session_id: "sess1", child_id: "kid1", status: "absent", reason: "excused", marked_by: "t1" };
for (const [who, load, body] of [["parent", loadParentMark, { sessionId: "sess1", childId: "kid1" }], ["student", loadStudentMark, { sessionId: "sess1" }]]) {
  await check(`${who} attendance mark (control): valid in-window mark records present and returns the meeting URL`, async () => {
    const db = memDb(attendanceSeed(null), []);
    const res = await load(db)({ __body: body });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.meetingUrl, "https://meet.example/x");
    assert.equal(db.t.attendance.length, 1);
    assert.equal(db.t.attendance[0].status, "present");
  });
  await check(`${who} attendance mark cannot overwrite a teacher-finalized decision`, async () => {
    const db = memDb(attendanceSeed(teacherAbsent), []);
    const res = await load(db)({ __body: body });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(db.t.attendance.length, 1);
    assert.equal(db.t.attendance[0].status, "absent");
    assert.equal(db.t.attendance[0].marked_by, "t1");
    assert.equal(db.t.attendance[0].reason, "excused");
  });
}
await check("teacher report remains final authority: it overwrites a self-marked present", async () => {
  const log = [];
  const db = memDb({ ...attendanceSeed({ session_id: "sess1", child_id: "kid1", status: "present" }), sessions: [{ id: "sess1", teacher_id: "t1", cohort_id: "c1", status: "scheduled", starts_at: hoursAgo(1), ends_at: new Date(Date.now() + 3600_000).toISOString() }] }, log);
  const mocks = {
    "next/server": { NextResponse: FakeResponse },
    "@/lib/supabase-admin": { createSupabaseAdminClient: () => db.client },
    "@/lib/require-teacher": { requireTeacher: async () => ({ ok: true, userId: "u9", teacherId: "t1" }) },
    "@/lib/makeup-credits": { issueMakeupCreditIfEligible: async () => ({ issued: true }) },
    "@/lib/platform-settings": { getRuntimeSettings: async () => ({ attendanceLockHours: 24 }) },
    "@/lib/api-rate-limit": rl,
  };
  const res = await loadModule("src/app/api/session-report/submit/route.ts", mocks, {}, silent).POST({ __body: reportBody });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(db.t.attendance[0].status, "absent");
  assert.equal(db.t.attendance[0].marked_by, "t1");
});


console.log(failures === 0 ? "\nALL RELEASE-BEHAVIOR CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
