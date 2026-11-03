// Behavior tests for editable settings and minute-accurate Riyadh quiet hours.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const ts = createRequire(import.meta.url)("typescript");

function read(path) { return fs.readFileSync(path, "utf8"); }
function load(path, mocks = {}) {
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(js, {
    exports: mod.exports, module: mod, Intl, Date, Math, Number, String, JSON, Promise, RegExp, Object, Boolean, console,
    require: (name) => {
      if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
      throw new Error(`Unmocked module ${name} in ${path}`);
    },
  }, { filename: path });
  return mod.exports;
}
const clock = load("src/lib/riyadh-time.ts");
assert.equal(clock.getRiyadhMinutesSinceMidnight(new Date("2026-10-27T17:30:00Z")), 20 * 60 + 30);
assert.equal(clock.getRiyadhMinutesSinceMidnight(new Date("2026-10-27T21:00:00Z")), 0);

const row = {
  makeup_monthly_limit: 2, pause_min_days: 7, pause_max_days: 28,
  registration_enabled: true, quiet_hours_start: "20:30:00", quiet_hours_end: "08:15:00",
  attendance_lock_hours: 24,
  default_capacity_1_3: 3, default_capacity_4_6: 4, default_capacity_7_9: 5, default_capacity_10_12: 5,
};
const fakeClient = (data) => ({
  from: (table) => {
    assert.equal(table, "admin_platform_settings");
    return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data, error: null }) }) }) };
  },
});
function runtimeFor(data) {
  return load("src/lib/platform-settings.ts", {
    "server-only": {},
    "@/lib/supabase-admin": { createSupabaseAdminClient: () => fakeClient(data) },
  });
}
const runtime = await runtimeFor(row).getRuntimeSettings();
assert.equal(runtime.quietHoursStartMinutes, 20 * 60 + 30);
assert.equal(runtime.quietHoursEndMinutes, 8 * 60 + 15);
assert.equal(runtime.quietHoursStart, 20);
assert.equal((await runtimeFor({ ...row, quiet_hours_start: "00:00:00" }).getRuntimeSettings()).quietHoursStartMinutes, 0);

const messaging = load("src/lib/messaging-config.ts", {
  "@/lib/platform-settings": { getRuntimeSettings: async () => runtime },
  "@/lib/riyadh-time": clock,
});
assert.equal(messaging.isQuietHoursAtMinute(20 * 60 + 29, 20 * 60 + 30, 8 * 60 + 15), false);
assert.equal(messaging.isQuietHoursAtMinute(20 * 60 + 30, 20 * 60 + 30, 8 * 60 + 15), true);
assert.equal(messaging.isQuietHoursAtMinute(8 * 60 + 14, 20 * 60 + 30, 8 * 60 + 15), true);
assert.equal(messaging.isQuietHoursAtMinute(8 * 60 + 15, 20 * 60 + 30, 8 * 60 + 15), false);
assert.equal(messaging.isQuietHoursAtMinute(600, 300, 300), false);
assert.equal(await messaging.isQuietHoursNow(new Date("2026-10-27T17:29:00Z")), false);
assert.equal(await messaging.isQuietHoursNow(new Date("2026-10-27T17:30:00Z")), true);
assert.equal(await messaging.isQuietHoursNow(new Date("2026-10-28T05:14:00Z")), true);
assert.equal(await messaging.isQuietHoursNow(new Date("2026-10-28T05:15:00Z")), false);

const settingsForm = read("src/app/admin/settings/SettingsForm.tsx");
const settingsApi = read("src/app/api/admin/settings/route.ts");
const cohortApi = read("src/app/api/admin/cohorts/route.ts");
assert.match(settingsForm, /baseline\.default_capacity_4_6/, "only changed settings should be saved");
assert.match(settingsForm, /name: "أوقات التواصل والرد"/, "communication settings label must reflect real behavior");
assert.match(settingsForm, /لا تُمنع الرسائل أو رموز OTP/, "quiet hours must not be advertised as blocking messages");
assert.equal((settingsForm.match(/max: 20, unit: "طالب"/g) ?? []).length, 4, "all four grade bands should honor the 20-seat cohort creation maximum");
assert.match(settingsApi, /cap4_6 > 20/, "server settings validation must also cap capacity at 20");
assert.match(cohortApi, /capacity > 20/, "group creation and settings must enforce the same cap");
console.log("PASS admin settings persistence contract, quiet-hour minute boundaries and 20-seat cohort maximum");
