// اختبار سلوكي بلا بيانات حقيقية ولا شبكة: node scripts/qa-release-behavior.mjs
// يشغّل مسارات الخادم الحقيقية (enroll / paylink create / تخطيطات English-Qudurat / metadata)
// فوق محاكاة في الذاكرة لـSupabase.
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
function loadModule(rel, mocks, env = {}) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  const out = ts.transpileModule(src, {
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
    module: mod, exports: mod.exports, require: req, process: { env }, Promise, Set, Map, Date, Math, Number, String, Array, Object, Boolean, RegExp, JSON, Error, console, URL,
  });
  return mod.exports;
}

class FakeResponse {
  constructor(body, status) { this.body = body; this.status = status; }
  static json(body, init) { return new FakeResponse(body, init?.status ?? 200); }
}

// ---------------- محاكاة Supabase في الذاكرة ----------------
function makeDb(seed) {
  let counter = 100;
  const nextId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
  const db = { tables: JSON.parse(JSON.stringify(seed)), rpcCalls: [], nextId };
  const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
  const likeToRegex = (pat) => {
    let re = "";
    for (let i = 0; i < pat.length; i++) {
      const c = pat[i];
      if (c === "\\") { re += pat[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
      else if (c === "%") re += ".*";
      else if (c === "_") re += ".";
      else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    return new RegExp(`^${re}$`, "i");
  };
  class Q {
    constructor(table) { this.table = table; this.op = "select"; this.f = []; this.ord = []; this.lim = null; this.payload = null; this.sel = null; }
    select(s) { this.sel = s ?? "*"; return this; }
    insert(p) { this.op = "insert"; this.payload = p; return this; }
    update(p) { this.op = "update"; this.payload = p; return this; }
    delete() { this.op = "delete"; return this; }
    eq(k, v) { this.f.push((r) => r[k] === v); return this; }
    in(k, arr) { this.f.push((r) => arr.includes(r[k])); return this; }
    ilike(k, p) { const re = likeToRegex(p); this.f.push((r) => re.test(String(r[k] ?? ""))); return this; }
    gte(k, v) { this.f.push((r) => String(r[k]) >= String(v)); return this; }
    order(k, o) { this.ord.push([k, o?.ascending !== false]); return this; }
    limit(n) { this.lim = n; return this; }
    async run() {
      await tick();
      const rows = db.tables[this.table];
      if (this.op === "insert") {
        const row = { id: nextId(), created_at: new Date(Date.now() + counter).toISOString(), ...this.payload };
        rows.push(row);
        return { data: [{ ...row }], error: null };
      }
      let match = rows.filter((r) => this.f.every((fn) => fn(r)));
      if (this.op === "update") { match.forEach((r) => Object.assign(r, this.payload)); return { data: match.map((r) => ({ ...r })), error: null }; }
      if (this.op === "delete") { db.tables[this.table] = rows.filter((r) => !match.includes(r)); return { data: null, error: null }; }
      for (const [k, asc] of [...this.ord].reverse()) match = [...match].sort((a, b) => (String(a[k]) < String(b[k]) ? -1 : String(a[k]) > String(b[k]) ? 1 : 0) * (asc ? 1 : -1));
      if (this.lim != null) match = match.slice(0, this.lim);
      match = match.map((r) => {
        const copy = { ...r };
        if (this.table === "children" && /subscriptions\(/.test(this.sel ?? "")) copy.subscriptions = db.tables.subscriptions.filter((s) => s.child_id === r.id).map((s) => ({ ...s }));
        return copy;
      });
      return { data: match, error: null };
    }
    async maybeSingle() { const r = await this.run(); return { data: r.data?.[0] ?? null, error: r.error }; }
    async single() { const r = await this.run(); return { data: r.data?.[0] ?? null, error: r.data?.[0] ? null : { message: "no rows" } }; }
    then(res, rej) { return this.run().then(res, rej); }
  }
  db.client = {
    from: (t) => new Q(t),
    rpc: async (name, args) => {
      await tick();
      db.rpcCalls.push(name);
      if (name === "cohort_available_seats") return { data: 5, error: null };
      if (name === "enroll_subscription_atomic") {
        const row = { id: nextId(), created_at: new Date(Date.now() + counter).toISOString(), child_id: args.p_child_id, parent_id: args.p_parent_id, plan_id: args.p_plan_id, cohort_id: args.p_cohort_id, status: "pending_payment" };
        db.tables.subscriptions.push(row);
        return { data: row.id, error: null };
      }
      return { data: null, error: { message: "unknown rpc" } };
    },
  };
  return db;
}

const COHORT = "00000000-0000-4000-8000-0000000000c1";
const COHORT2 = "00000000-0000-4000-8000-0000000000c2";
const OLD = "2020-01-01T00:00:00.000Z";
const seed = () => ({
  parents: [
    { id: "p1", user_id: "u1", full_name: "Parent One", phone: "+966500000001", email: "p1@example.test" },
    { id: "p2", user_id: "u2", full_name: "Parent Two", phone: "+966500000002", email: "p2@example.test" },
  ],
  children: [
    { id: "00000000-0000-4000-8000-0000000000a1", parent_id: "p1", first_name: "Sara", grade: 1, created_at: OLD },
    { id: "00000000-0000-4000-8000-0000000000a2", parent_id: "p2", first_name: "Other", grade: 1, created_at: OLD },
    { id: "00000000-0000-4000-8000-0000000000a3", parent_id: "p1", first_name: "Big", grade: 5, created_at: OLD },
  ],
  subscriptions: [],
  cohorts: [
    { id: COHORT, plan_id: "khota-2", grade_band: "1-3", status: "open", product: "motabaa", days_of_week: [0, 2] },
    { id: COHORT2, plan_id: "khota-2", grade_band: "1-3", status: "open", product: "motabaa", days_of_week: [1, 3] },
  ],
  plans: [{ id: "khota-2", product: "motabaa", active: true, price_sar: 399, days_per_week: 2 }],
});
const CHILD_SARA = "00000000-0000-4000-8000-0000000000a1";
const CHILD_OTHER = "00000000-0000-4000-8000-0000000000a2";
const CHILD_BIG = "00000000-0000-4000-8000-0000000000a3";

function loadEnroll(db, userId = "u1") {
  const mocks = {
    "next/server": { NextResponse: FakeResponse },
    "@/lib/supabase-server": { createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: userId, email: userId === "u1" ? "p1@example.test" : "p2@example.test" } } }) } }) },
    "@/lib/supabase-admin": { createSupabaseAdminClient: () => db.client },
    "@/lib/platform-settings": { getRuntimeSettings: async () => ({ registrationEnabled: true }) },
    "@/lib/api-rate-limit": {
      checkRateLimit: async () => ({ ok: true }),
      declaredBodyExceeds: () => false,
      rateLimitRejectionResponse: () => null,
      readJsonBodyLimited: async (req) => ({ ok: true, body: req.__body }),
    },
  };
  return loadModule("src/app/api/enroll/route.ts", mocks).POST;
}
const body = (extra) => ({ __body: { parentName: "Parent One", phone: "0500000001", email: "p1@example.test", grade: 1, cohortId: COHORT, ...extra } });
const kids = (db, p = "p1") => db.tables.children.filter((c) => c.parent_id === p);
const subs = (db, status) => db.tables.subscriptions.filter((s) => !status || s.status === status);

await check("childId of another parent is rejected, nothing created", async () => {
  const db = makeDb(seed());
  const res = await loadEnroll(db)(body({ childId: CHILD_OTHER }));
  assert.equal(res.status, 404);
  assert.equal(subs(db).length, 0);
  assert.equal(db.tables.children.length, 3);
  assert.ok(!db.rpcCalls.includes("enroll_subscription_atomic"));
});
await check("existing own child (childId) -> no new child record", async () => {
  const db = makeDb(seed());
  const res = await loadEnroll(db)(body({ childId: CHILD_SARA }));
  assert.equal(res.status, 200);
  assert.equal(db.tables.children.length, 3);
  assert.equal(subs(db)[0].child_id, CHILD_SARA);
});
await check("childId with mismatched grade is rejected", async () => {
  const db = makeDb(seed());
  const res = await loadEnroll(db)(body({ childId: CHILD_BIG }));
  assert.equal(res.status, 409);
  assert.equal(subs(db).length, 0);
});
await check("same name as an old child does NOT merge two different children", async () => {
  const db = makeDb(seed());
  const res = await loadEnroll(db)(body({ childName: "Sara" }));
  assert.equal(res.status, 200);
  assert.equal(kids(db).filter((c) => c.first_name === "Sara").length, 2);
  assert.notEqual(subs(db)[0].child_id, CHILD_SARA);
});
await check("add new child -> created exactly once, retry stays idempotent", async () => {
  const db = makeDb(seed());
  const post = loadEnroll(db);
  const first = await post(body({ childName: "Noor" }));
  const retry = await post(body({ childName: "Noor" }));
  assert.equal(first.status, 200);
  assert.equal(retry.body.subscriptionId, first.body.subscriptionId);
  assert.equal(kids(db).filter((c) => c.first_name === "Noor").length, 1);
  assert.equal(subs(db, "pending_payment").length, 1);
});
await check("duplicate subscription for same child+cohort is rejected/idempotent server-side", async () => {
  const db = makeDb(seed());
  const post = loadEnroll(db);
  const first = await post(body({ childId: CHILD_SARA }));
  const again = await post(body({ childId: CHILD_SARA }));
  assert.equal(again.body.subscriptionId, first.body.subscriptionId, "pending duplicate returns the same booking");
  assert.equal(subs(db).length, 1);
  subs(db)[0].status = "active";
  const third = await post(body({ childId: CHILD_SARA }));
  assert.equal(third.status, 409, "active subscription in the same cohort is rejected");
  assert.equal(subs(db).length, 1);
});
await check("concurrent identical new-child requests -> one child, one live subscription", async () => {
  const db = makeDb(seed());
  const post = loadEnroll(db);
  const [a, b] = await Promise.all([post(body({ childName: "Omar" })), post(body({ childName: "Omar" }))]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(a.body.subscriptionId, b.body.subscriptionId);
  assert.equal(kids(db).filter((c) => c.first_name === "Omar").length, 1);
  assert.equal(subs(db, "pending_payment").length, 1);
});
await check("concurrent requests with the same childId+cohort -> one live subscription", async () => {
  const db = makeDb(seed());
  const post = loadEnroll(db);
  const [a, b] = await Promise.all([post(body({ childId: CHILD_SARA })), post(body({ childId: CHILD_SARA }))]);
  assert.equal(a.body.subscriptionId, b.body.subscriptionId);
  assert.equal(subs(db, "pending_payment").length, 1);
});
await check("inactive plan or missing/zero price is rejected by the API", async () => {
  for (const patch of [{ active: false }, { price_sar: null }, { price_sar: 0 }]) {
    const s = seed();
    Object.assign(s.plans[0], patch);
    const db = makeDb(s);
    const res = await loadEnroll(db)(body({ childId: CHILD_SARA }));
    assert.equal(res.status, 409, JSON.stringify(patch));
    assert.ok(!db.rpcCalls.includes("enroll_subscription_atomic"));
    assert.equal(subs(db).length, 0);
  }
});

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

// ---------------- SEO ----------------
await check("root canonical never points every page to the homepage", async () => {
  const { metadata } = loadModule("src/app/layout.tsx", {}, {});
  const canonical = metadata.alternates?.canonical;
  assert.notEqual(canonical, "/");
  assert.equal(canonical, "./");
  assert.equal(String(metadata.metadataBase), "https://www.khota.sa/");
});

console.log(failures === 0 ? "\nALL RELEASE-BEHAVIOR CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
