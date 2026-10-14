// In-memory behavioral checks for gateway reconciliation and isolated Pilot identity.
// No external network, no database access, no payment creation.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "package.json"))("typescript");
const source = (p) => fs.readFileSync(path.join(root, p), "utf8");

function load(rel, env, fakeFetch) {
  const output = ts.transpileModule(source(rel), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(output, {
    module: mod, exports: mod.exports,
    require: (id) => { if (id === "server-only") return {}; throw Error("Unexpected import: " + id); },
    process: { env }, fetch: fakeFetch, console: { error: () => {} },
    crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, setTimeout,
    btoa: (v) => Buffer.from(v, "binary").toString("base64"),
    atob: (v) => Buffer.from(v, "base64").toString("binary"),
  });
  return mod.exports;
}

function mockGateway(body, status = 200) {
  return async (url) => {
    const target = String(url);
    if (target.endsWith("/api/auth")) return { ok: true, json: async () => ({ id_token: "test-token" }) };
    if (target.includes("/api/getTransactionsOfOrderNumber/") || target.endsWith("/api/addInvoice")) {
      return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => "gateway error" };
    }
    throw Error("unexpected gateway URL");
  };
}
const gatewayEnv = {
  PAYLINK_BASE_URL: "https://paylink.invalid",
  PAYLINK_API_ID: "test",
  PAYLINK_API_SECRET: "test",
};
const transactions = async (body) => load("src/lib/paylink.ts", gatewayEnv, mockGateway(body))
  .getPaylinkTransactionsByOrderNumber("payment-demo");

assert.equal((await transactions([])).ok, true, "explicit [] is a known-empty transaction list");
assert.equal((await transactions({ transactions: [] })).ok, true, "explicit transactions:[] is known empty");
assert.equal((await transactions({ error: "unavailable" })).ok, false, "error objects are not empty lists");
assert.equal((await transactions(null)).ok, false, "null response is not an empty list");
assert.equal((await transactions([{}])).ok, false, "malformed transactions are not empty");
assert.equal((await transactions([{ transactionNo: "tx-one" }])).ok, true, "valid transaction is accepted");
assert.equal((await transactions([{ transactionNo: "tx-one" }, { transactionNo: "tx-two" }])).ok, false, "conflicting transactions must be reconciled manually");

const invoiceInput = {
  orderNumber: "payment-demo",
  amount: 100, clientName: "Pilot",
  clientMobile: "966500000000",
  productTitle: "Demo", callBackUrl: "https://example.test/callback",
  cancelUrl: "https://example.test/cancel",
};
const malformedInvoice = await load("src/lib/paylink.ts", gatewayEnv, mockGateway({ url: "https://example.test/pay" }))
  .createPaylinkInvoice(invoiceInput);
assert.equal(malformedInvoice.ok, false);
assert.equal(malformedInvoice.ambiguous, true, "200 with missing invoice ID is ambiguous, not a rejected invoice");
const errorInvoice = await load("src/lib/paylink.ts", gatewayEnv, mockGateway({}, 500))
  .createPaylinkInvoice(invoiceInput);
assert.equal(errorInvoice.ok, false);
assert.equal(errorInvoice.ambiguous, true, "gateway 500 cannot prove no invoice was created");

const demoParent = "214f67a8-7b53-4b8a-9a9d-646b2ac50b8b";
const secondParent = "3d58b5a4-1177-4b9d-b324-0c9ed704855c";
const pilotEnv = {
  NODE_ENV: "development",
  KHOTA_PILOT_AUTH: "true",
  KHOTA_PILOT_SECRET: "local-isolated-testing-only-key",
  KHOTA_PILOT_PARENT_ID: demoParent,
};
const loadPilot = (env) => load("src/lib/pilot-auth.ts", env, undefined);
assert.equal(loadPilot({ ...pilotEnv, NODE_ENV: "production" }).isPilotAuthEnabled(), false, "pilot disabled in production");
assert.equal(loadPilot({ ...pilotEnv, KHOTA_PILOT_PARENT_ID: "" }).isPilotAuthEnabled(), false, "pilot requires explicit parent ID");

const pilot = loadPilot(pilotEnv);
const signed = await pilot.createPilotSessionToken();
assert.equal(await pilot.verifyPilotSessionParentId(signed), demoParent, "signed pilot token is parent-bound");
assert.equal(await loadPilot({ ...pilotEnv, KHOTA_PILOT_PARENT_ID: secondParent }).verifyPilotSessionToken(signed), false, "token must not switch parent when config changes");
assert.equal(await pilot.verifyPilotSessionToken("invalid.token"), false, "unsigned pilot tokens must fail");

console.log("ALL GATEWAY AND PILOT BEHAVIOR CHECKS PASSED");
