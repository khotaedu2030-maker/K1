// TRUE Supabase Auth/JWT/PostgREST checks for ten teacher-facing SELECT policies.
// THIS FILE MUST NEVER BE ADDED TO DEFAULT BUILD. Invoke only explicitly in the
// dedicated KHOTA Staging Vercel project, after the read-only credential probe.
// Creates synthetic accounts and rows, then cleans up in finally. No emails sent.
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { validateStagingConfig } from "./qa-staging-env.mjs";

const env = process.env;
const STAGING_VERCEL_PROJECT = "prj_mpaXaRNmczd9jbqjtigtyKpMDJ5r";
if (!process.argv.includes("--ephemeral-staging-only")) {
  throw new Error("This live data test must be deliberately opted into.");
}
if (!validateStagingConfig(env).ok
  || env.NEXT_PUBLIC_SITE_URL !== "https://khota-staging-web-khota.vercel.app"
  || (env.VERCEL_PROJECT_ID && env.VERCEL_PROJECT_ID !== STAGING_VERCEL_PROJECT)) {
  throw new Error("Fail closed: isolated Staging environment verification failed.");
}
// The imported read-only Auth Admin and Staging-only catalog proof must run
// successfully before any test user or row is created.
await import("./qa-staging-live-credential.mjs");

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const mkUserClient = () => createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const runId = randomUUID().replaceAll("-", "").slice(0, 16);
const created = { users: [], teachers: [], parent: null, cohort: null, child: null, session: null };
const fixtures = {};
let failure = false;
let completed = 0;
const coveredTables = [
  "cohorts", "sessions", "children", "subscriptions", "assessments",
  "child_progress_snapshots", "independence_assessments",
  "weekly_goals", "message_threads", "messages",
];
const fail = (message) => { throw new Error(message); };
const expect = (ok, message) => { if (!ok) fail(message); completed++; };

async function createAuthIdentity(label) {
  // example.invalid is a reserved non-deliverable domain; admin.createUser
  // does not send an invitation and email_confirm avoids any OTP/email.
  const email = "khota-qa-" + label + "-" + runId + "@example.invalid";
  const password = randomBytes(36).toString("base64url") + "aA1!";
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error || !data?.user?.id) fail("Staging Auth fixture creation failed (" + label + ", status " + String(error?.status ?? "unknown") + ").");
  created.users.push(data.user.id);
  return { id: data.user.id, email, password };
}
async function insertOne(table, row) {
  const { data, error } = await admin.from(table).insert(row).select("id").single();
  if (error || !data?.id) fail("Staging synthetic row insertion failed in " + table + " (code " + String(error?.code ?? "unknown") + ").");
  fixtures[table] = data.id;
  return data.id;
}
async function login(u) {
  const client = mkUserClient();
  const { data, error } = await client.auth.signInWithPassword({ email: u.email, password: u.password });
  if (error || !data?.session?.access_token || data.user?.id !== u.id) {
    fail("Real Staging password Auth/JWT session failed (status " + String(error?.status ?? "unknown") + ").");
  }
  return client;
}
async function rowCount(client, table, id) {
  const { data, error } = await client.from(table).select("id").eq("id", id);
  if (error) fail("Staging JWT PostgREST SELECT rejected for " + table + " (code " + String(error.code ?? "unknown") + ").");
  return data?.length ?? 0;
}
async function assertRole(client, label, expected) {
  for (const table of coveredTables) {
    const count = await rowCount(client, table, fixtures[table]);
    expect(count === expected, label + " expected " + expected + " readable row(s) in " + table + ", got " + count);
  }
}

try {
  const activeUser = await createAuthIdentity("teacher-active");
  const unrelatedUser = await createAuthIdentity("teacher-unrelated");
  const parentUser = await createAuthIdentity("parent");

  const teacherId = await insertOne("teachers", { user_id: activeUser.id, full_name: "معلم تجريبي مؤقت", active: true });
  created.teachers.push(teacherId);
  const unrelatedTeacherId = await insertOne("teachers", { user_id: unrelatedUser.id, full_name: "معلم غير مرتبط تجريبي", active: true });
  created.teachers.push(unrelatedTeacherId);
  const parentId = await insertOne("parents", {
    user_id: parentUser.id, full_name: "ولي أمر تجريبي مؤقت", email: parentUser.email, phone: "+966500000000",
  });
  created.parent = parentId;
  const childId = await insertOne("children", { parent_id: parentId, first_name: "طالب QA", grade: 4 });
  created.child = childId;
  const cohortId = await insertOne("cohorts", {
    title: "مجموعة فحص المعلم مؤقتة " + runId,
    product: "motabaa", plan_id: "staging-khota-2-20261025",
    teacher_id: teacherId, grade_band: "4-6", capacity: 4,
    days_of_week: [1, 3], start_time: "17:00", end_time: "17:45",
    status: "open", slot_code: "QA-TEACHER-" + runId,
  });
  created.cohort = cohortId;
  // A future Monday at 17:00 Riyadh = 14:00 UTC.
  const now = new Date();
  const daysToNextMonday = (8 - now.getUTCDay()) % 7 || 7;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToNextMonday, 14));
  const end = new Date(start.getTime() + 45 * 60_000);
  const date = start.toISOString().slice(0, 10);
  created.session = await insertOne("sessions", {
    cohort_id: cohortId, teacher_id: teacherId, session_date: date,
    starts_at: start.toISOString(), ends_at: end.toISOString(), status: "scheduled",
  });
  await insertOne("subscriptions", {
    parent_id: parentId, child_id: childId, cohort_id: cohortId,
    plan_id: "staging-khota-2-20261025", status: "active", start_date: date,
  });
  await insertOne("assessments", { child_id: childId, teacher_id: teacherId, assessment_type: "manual_review" });
  await insertOne("child_progress_snapshots", { child_id: childId, created_by: teacherId, source: "teacher", focus_score: 3 });
  await insertOne("independence_assessments", {
    child_id: childId, teacher_id: teacherId,
    task_management: 3, task_initiation: 3, help_seeking: 3, task_completion: 3, time_organization: 3, total_score: 3,
  });
  await insertOne("weekly_goals", { child_id: childId, created_by_teacher_id: teacherId, week_start: date, title: "هدف تجريبي مؤقت" });
  const threadId = await insertOne("message_threads", {
    child_id: childId, cohort_id: cohortId, parent_user_id: parentUser.id,
    teacher_user_id: activeUser.id, status: "open",
  });
  await insertOne("messages", { thread_id: threadId, sender_user_id: activeUser.id, sender_role: "teacher", body: "رسالة تجريبية مؤقتة" });

  const active = await login(activeUser);
  const unrelated = await login(unrelatedUser);
  // Genuine JWTs + production-equivalent HTTP PostgREST; no admin credential on user clients.
  await assertRole(active, "active teacher", 1);
  await assertRole(unrelated, "unrelated teacher", 0);
  const disable = await admin.from("teachers").update({ active: false }).eq("id", teacherId);
  if (disable.error) fail("Unable to disable synthetic teacher for revocation test.");
  await assertRole(active, "disabled teacher with existing JWT", 0);
  const nullify = await admin.from("teachers").update({ active: null }).eq("id", teacherId);
  if (nullify.error) fail("Unable to set synthetic teacher active=NULL for fail-closed test.");
  await assertRole(active, "null-active teacher with existing JWT", 0);
  const restore = await admin.from("teachers").update({ active: true }).eq("id", teacherId);
  if (restore.error) fail("Unable to restore synthetic teacher after revocation test.");
  await assertRole(active, "re-enabled teacher", 1);
  console.log("PASS real Staging Auth/JWT/PostgREST: 10 teacher tables x 5 role/states (" + completed + " assertions). No real customer identities.");
} catch (error) {
  failure = true;
  // Only own fixed diagnostic messages are emitted. Never log API response objects,
  // passwords, service-role values, JWTs, or PII.
  console.error("FAIL real Staging Auth/JWT teacher boundaries: " + String(error?.message || "unknown fixture failure"));
} finally {
  // Clean up children/related tables via the actual ON DELETE CASCADE constraints.
  // Always attempt every step independently so partial failures do not leave working accounts.
  const problems = [];
  async function erase(table, id) {
    if (!id) return;
    const { error } = await admin.from(table).delete().eq("id", id);
    if (error) problems.push(table);
  }
  await erase("parents", created.parent);
  await erase("cohorts", created.cohort);
  for (const teacherId of [...created.teachers].reverse()) await erase("teachers", teacherId);
  for (const uid of [...created.users].reverse()) {
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) problems.push("auth_user");
  }
  if (problems.length) {
    failure = true;
    console.error("FAIL synthetic Staging fixture cleanup in: " + [...new Set(problems)].join(", "));
  } else {
    console.log("PASS synthetic Staging fixture cleanup: no temporary accounts or group retained.");
  }
}
if (failure) process.exitCode = 1;
