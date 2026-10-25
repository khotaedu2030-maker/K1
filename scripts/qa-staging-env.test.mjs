import assert from "node:assert/strict";
import test from "node:test";
import { validateStagingConfig } from "./qa-staging-env.mjs";

const valid = {
  KHOTA_ENVIRONMENT: "staging",
  NEXT_PUBLIC_SUPABASE_URL: "https://iteskfrpeeclzshauxog.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_staging_fixture",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_staging_fixture",
  NEXT_PUBLIC_SITE_URL: "https://khota-staging-web.vercel.app",
  VERCEL_PROJECT_ID: "prj_staging_isolated_fixture",
  KHOTA_PAYMENTS_ENABLED: "false",
};

const check = (patch) => validateStagingConfig({ ...valid, ...patch });

test("accepts an explicitly isolated staging configuration", () => {
  assert.equal(check({}).ok, true);
});

test("blocks production Supabase URL even if staging is labeled correctly", () => {
  assert.equal(check({
    NEXT_PUBLIC_SUPABASE_URL: "https://jylenzphqkmucwxqlzmq.supabase.co",
  }).ok, false);
});

test("blocks production Vercel project and website domain", () => {
  assert.equal(check({ VERCEL_PROJECT_ID: "prj_ztQ52qhSQsqFGBLfdOinctN9hA0y" }).ok, false);
  assert.equal(check({ NEXT_PUBLIC_SITE_URL: "https://www.khota.sa" }).ok, false);
});

test("blocks empty or unrecognized public connection settings", () => {
  assert.equal(check({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" }).ok, false);
  assert.equal(check({ NEXT_PUBLIC_SUPABASE_URL: "http://iteskfrpeeclzshauxog.supabase.co" }).ok, false);
  assert.equal(check({ SUPABASE_SERVICE_ROLE_KEY: "" }).ok, false);
});

test("blocks wrong-project legacy JWT service credentials without logging secrets", () => {
  const encoded = (ref) => ["eyJhbGciOiJIUzI1NiJ9",
    Buffer.from(JSON.stringify({ ref })).toString("base64url"), "signature"].join(".");
  assert.equal(check({ SUPABASE_SERVICE_ROLE_KEY: encoded("jylenzphqkmucwxqlzmq") }).ok, false);
  assert.equal(check({ SUPABASE_SERVICE_ROLE_KEY: encoded("iteskfrpeeclzshauxog") }).ok, true);
});

test("blocks payment enablement and Paylink live credentials", () => {
  assert.equal(check({ KHOTA_PAYMENTS_ENABLED: "true" }).ok, false);
  assert.equal(check({ KHOTA_PAYMENTS_ENABLED: undefined }).ok, false);
  assert.equal(check({ PAYLINK_API_ID: "not-a-real-id" }).ok, false);
  assert.equal(check({ PAYLINK_API_SECRET: "not-a-real-secret" }).ok, false);
  assert.equal(check({ PAYLINK_WEBHOOK_SECRET: "not-a-real-webhook-secret" }).ok, false);
  assert.equal(check({ PAYLINK_BASE_URL: "https://restapi.paylink.sa" }).ok, false);
});

test("blocks bypassing real Auth tests with Pilot auth", () => {
  assert.equal(check({ KHOTA_PILOT_AUTH: "true" }).ok, false);
  assert.equal(check({ KHOTA_ENVIRONMENT: undefined }).ok, false);
});

test("errors contain no credential values", () => {
  const key = "a-sensitive-test-value-that-must-not-be-logged";
  const r = check({ PAYLINK_API_SECRET: key });
  assert.equal(r.ok, false);
  assert.ok(!r.errors.join(" ").includes(key));
});
