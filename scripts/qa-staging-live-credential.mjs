// Read-only runtime proof that isolated KHOTA Staging server credentials actually work.
// Requires isolated protected Vercel Staging build; never log a secret or its raw value.
import { createClient } from "@supabase/supabase-js";
import { validateStagingConfig } from "./qa-staging-env.mjs";

const STAGING_PROJECT_ID = "prj_mpaXaRNmczd9jbqjtigtyKpMDJ5r";
const env = process.env;
const { ok } = validateStagingConfig(env);
if (!ok || (env.VERCEL_PROJECT_ID && env.VERCEL_PROJECT_ID !== STAGING_PROJECT_ID)) {
  throw new Error("Fail closed: this runtime is not the KHOTA isolated Staging project.");
}
if (env.NEXT_PUBLIC_SITE_URL !== "https://khota-staging-web-khota.vercel.app") {
  throw new Error("Fail closed: staging site alias differs from approved host.");
}
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const { error: adminError } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
if (adminError) {
  throw new Error("Staging Auth Admin API rejected the server credential. Status: " + String(adminError.status || "unknown"));
}
const { data: catalogFixture, error: fixtureError } = await client.from("plans")
  .select("id, active").eq("id", "staging-khota-2-20261025").maybeSingle();
if (fixtureError || !catalogFixture || catalogFixture.active !== true) {
  throw new Error("Isolated Staging fixture lookup failed; do not proceed with Auth test writes.");
}
console.log("PASS live Staging privileged credential ownership: Auth Admin API accepted it and isolated fixture was readable (read-only).");
