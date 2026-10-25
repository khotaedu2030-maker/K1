// Staging-only fail-closed configuration guard.
// Run before building KHOTA's *separate* Vercel staging project:
// npm run qa:staging-env && npm run build
// No network requests; no secrets or key values are printed.

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STAGING_REF = "iteskfrpeeclzshauxog";
const PRODUCTION_REF = "jylenzphqkmucwxqlzmq";
const PRODUCTION_VERCEL_PROJECT = "prj_ztQ52qhSQsqFGBLfdOinctN9hA0y";
const PRODUCTION_DOMAINS = new Set(["khota.sa", "www.khota.sa"]);

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function embeddedJwtProjectRef(key) {
  if (typeof key !== "string" || !key.includes(".")) return null;
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload.ref === "string" ? payload.ref : null;
  } catch {
    return null;
  }
}

export function validateStagingConfig(env) {
  const errors = [];
  if (env.KHOTA_ENVIRONMENT !== "staging") {
    errors.push("KHOTA_ENVIRONMENT must equal staging.");
  }
  const supabase = safeUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  if (!supabase || supabase.protocol !== "https:" ||
      supabase.hostname !== STAGING_REF + ".supabase.co" ||
      supabase.username || supabase.password || supabase.port ||
      !["", "/"].includes(supabase.pathname) || supabase.search || supabase.hash) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL must point exclusively to KHOTA staging.");
  }
  if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) {
    errors.push("A staging NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required.");
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    errors.push("A staging-only server-side SUPABASE_SERVICE_ROLE_KEY is required.");
  }
  // Legacy Supabase service JWTs include a project ref; inspect without logging
  // the credential. Opaque sb_secret_* keys require dashboard/API verification.
  const embeddedRef = embeddedJwtProjectRef(env.SUPABASE_SERVICE_ROLE_KEY);
  if (embeddedRef && embeddedRef !== STAGING_REF) {
    errors.push("SUPABASE_SERVICE_ROLE_KEY does not belong to KHOTA staging.");
  }
  if (env.VERCEL_PROJECT_ID === PRODUCTION_VERCEL_PROJECT) {
    errors.push("Never run staging QA on the production Vercel project k1.");
  }
  const site = safeUrl(env.NEXT_PUBLIC_SITE_URL);
  if (!site || site.protocol !== "https:" || PRODUCTION_DOMAINS.has(site.hostname) ||
      site.username || site.password || site.search || site.hash) {
    errors.push("NEXT_PUBLIC_SITE_URL must be an HTTPS staging-only hostname, not khota.sa.");
  }
  if (env.KHOTA_PAYMENTS_ENABLED !== "false") {
    errors.push("KHOTA_PAYMENTS_ENABLED must be explicitly false in staging.");
  }
  if (env.KHOTA_PILOT_AUTH === "true") {
    errors.push("Pilot bypass authentication must remain off for real Auth E2E testing.");
  }
  for (const name of ["PAYLINK_API_ID", "PAYLINK_API_SECRET", "PAYLINK_WEBHOOK_SECRET"]) {
    if (env[name]?.trim()) errors.push(name + " must not be configured in isolated staging.");
  }
  if (env.PAYLINK_BASE_URL?.includes("restapi.paylink.sa")) {
    errors.push("Live Paylink API endpoint must not be configured in staging.");
  }
  return { ok: errors.length === 0, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { ok, errors } = validateStagingConfig(process.env);
  if (ok) {
    console.log("PASS staging isolation configuration (credential ownership still needs a live API check)");
  } else {
    for (const error of errors) console.error("FAIL " + error);
    process.exitCode = 1;
  }
}
