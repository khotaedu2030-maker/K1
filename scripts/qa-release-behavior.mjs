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

console.log(failures === 0 ? "\nALL RELEASE-BEHAVIOR CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
