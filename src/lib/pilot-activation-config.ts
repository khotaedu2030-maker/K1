// Deliberately closed outside the separately isolated KHOTA Staging project.
// Production remains disabled even if someone mistakenly copies the feature flag.
export function pilotActivationEnabled(): boolean {
  return process.env.KHOTA_FREE_PILOT_ACTIVATION_ENABLED === "true" &&
    process.env.VERCEL_PROJECT_ID === "prj_mpaXaRNmczd9jbqjtigtyKpMDJ5r" &&
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes("iteskfrpeeclzshauxog");
}
