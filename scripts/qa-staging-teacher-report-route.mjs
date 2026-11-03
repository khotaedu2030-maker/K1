// Deliberately invoked STAGING-ONLY integration test: real Auth/JWT, real DB,
// and the real session-report POST handler, with only Next Auth/request adapters
// replaced for an in-process test. NOT a full browser/cookie HTTP E2E.
// No customer emails, no production traffic, no payment calls.
// Run only in the isolated protected staging Vercel project.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { validateStagingConfig } from "./qa-staging-env.mjs";

const env = process.env;
const project = "prj_mpaXaRNmczd9jbqjtigtyKpMDJ5r";
if (!process.argv.includes("--ephemeral-staging-only") || !validateStagingConfig(env).ok ||
    env.NEXT_PUBLIC_SITE_URL !== "https://khota-staging-web-khota.vercel.app" ||
    (env.VERCEL_PROJECT_ID && env.VERCEL_PROJECT_ID !== project)) {
  throw new Error("Fail closed: not expressly approved isolated KHOTA Staging runtime.");
}
await import("./qa-staging-live-credential.mjs");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(root, "package.json"))("typescript");
function loadTs(rel, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, rel), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRecord = { exports: {} };
  vm.runInNewContext(code, {
    module: moduleRecord, exports: moduleRecord.exports,
    require: (name) => {
      if (name === "server-only") return {};
      if (name in mocks) return mocks[name];
      throw new Error("Unmocked dependency in Staging route integration: " + name);
    },
    Date, Math, Number, String, Array, Object, JSON, Set, Map, Promise, Error, RegExp,
    console: { error: () => {} }, process: { env }, Buffer,
  });
  return moduleRecord.exports;
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const publicClient = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const users = [];
const created = { parent:null, children:[], cohort:null, teachers:[], sessions:[] };
const run = randomUUID().slice(0,8);
let failures = [];
let checks = 0;
const verify = (value,message) => { assert.ok(value,message);checks++; };
const insert = async (table,values) => {
  const {data,error}=await admin.from(table).insert(values).select("id").single();
  if(error||!data?.id) throw new Error("Staging fixture "+table+" insert failed: "+(error?.code??"unknown"));
  return data.id;
};
async function authIdentity(label){
  const email="khota-route-"+label+"-"+run+"@example.invalid";
  const password=randomBytes(36).toString("base64url")+"Aa1!";
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
  if(error||!data?.user?.id) throw new Error("Staging Auth createUser failed for "+label+": "+(error?.status??"unknown"));
  users.push(data.user.id);
  const client=publicClient();
  const signed=await client.auth.signInWithPassword({email,password});
  if(signed.error||!signed.data?.session?.access_token) throw new Error("Staging Auth JWT signIn failed");
  return { id:data.user.id,jwt:signed.data.session.access_token,client };
}
const FakeResponse={json:(body,{status=200}={})=>({status,body})};
const policy=loadTs("src/lib/policies.ts");
const settings={ attendanceLockHours:24, makeupMonthlyLimit:2 };
const makeup=loadTs("src/lib/makeup-credits.ts", {
  "@/lib/policies":policy,
  "@/lib/platform-settings":{getRuntimeSettings:async()=>settings},
});
const time=loadTs("src/lib/riyadh-time.ts");
let acting=null;
const requireTeacher=async()=>{
  if(!acting) return {ok:false,response:FakeResponse.json({error:"يجب تسجيل الدخول"},{status:401})};
  // Even in-process, inspect the actual issued JWT against Supabase Auth, and
  // inspect the current teacher's active field from the live Staging database.
  const {data:authData,error:authError}=await admin.auth.getUser(acting.jwt);
  if(authError||authData?.user?.id!==acting.id) return {ok:false,response:FakeResponse.json({error:"يجب تسجيل الدخول"},{status:401})};
  const {data:teacher,error:teacherError}=await admin.from("teachers")
    .select("id").eq("user_id",acting.id).eq("active",true).maybeSingle();
  if(teacherError) throw new Error("Failed to check live Staging teacher activation");
  if(!teacher) return {ok:false,response:FakeResponse.json({error:"هذا الحساب ليس حساب معلم نشط"},{status:403})};
  return {ok:true,userId:acting.id,teacherId:teacher.id};
};
const route=loadTs("src/app/api/session-report/submit/route.ts",{
  "next/server":{NextResponse:FakeResponse},
  "@/lib/supabase-admin":{createSupabaseAdminClient:()=>admin},
  "@/lib/require-teacher":{requireTeacher},
  "@/lib/makeup-credits":makeup,
  "@/lib/platform-settings":{getRuntimeSettings:async()=>settings},
  "@/lib/riyadh-time":time,
  "@/lib/api-rate-limit":{
    declaredBodyExceeds:()=>false,
    readJsonBodyLimited:async(r)=>({ok:true,body:r.body}),
    checkRateLimit:async()=>({ok:true}),
    rateLimitRejectionResponse:()=>null,
  },
});
const post=async(body)=>route.POST({body});
const rowCount=async(table,field,value)=>{
  const {count,error}=await admin.from(table).select("*",{count:"exact",head:true}).eq(field,value);
  if(error)throw new Error("DB verification "+table+" failed: "+error.code);
  return count||0;
};
async function cleanup(){
  async function erase(table,id,field="id"){
    if(!id)return;
    const {error}=await admin.from(table).delete().eq(field,id);
    if(error)failures.push("cleanup-"+table);
  }
  // Explicitly remove reports, credits and tasks even if FK cascades change.
  for(const child of created.children){
    for(const table of ["recommendations","daily_tasks","makeup_credits","attendance","daily_pulse_reports"]){
      await erase(table,child,"child_id");
    }
  }
  for(const s of created.sessions)await erase("sessions",s);
  for(const child of created.children)await erase("children",child);
  if(created.parent)await erase("parents",created.parent);
  if(created.cohort)await erase("cohorts",created.cohort);
  for(const teacher of created.teachers)await erase("teachers",teacher);
  for(const user of users){
    const {error}=await admin.auth.admin.deleteUser(user);
    if(error)failures.push("cleanup-auth-user");
  }
}
try{
  const active=await authIdentity("teacher");
  const other=await authIdentity("unrelated");
  const parent=await authIdentity("parent");
  const t1=await insert("teachers",{user_id:active.id,full_name:"معلم تقرير QA",active:true});
  const t2=await insert("teachers",{user_id:other.id,full_name:"معلم غير مرتبط QA",active:true});
  created.teachers.push(t1,t2);
  created.parent=await insert("parents",{user_id:parent.id,full_name:"ولي أمر QA",phone:"+966500000000"});
  const c1=await insert("children",{parent_id:created.parent,first_name:"طالب اختبار",grade:4});
  const c2=await insert("children",{parent_id:created.parent,first_name:"طالب ثان للاختبار",grade:4});
  created.children.push(c1,c2);
  created.cohort=await insert("cohorts",{
    title:"اختبار تقرير مؤقت "+run,product:"motabaa",plan_id:"staging-khota-2-20261025",
    teacher_id:t1,grade_band:"4-6",capacity:4,days_of_week:[1,3],
    start_time:"17:00",end_time:"17:45",status:"open",slot_code:"QA-REPORT-"+run,
  });
  const startsAt=new Date(Date.now()-30*60_000);
  const endsAt=new Date(Date.now()+15*60_000);
  const dateKey=time.formatRiyadhCalendarDate(time.getRiyadhCalendarDate(startsAt));
  const sessionId=await insert("sessions",{
    cohort_id:created.cohort,teacher_id:t1,session_date:dateKey,
    starts_at:startsAt.toISOString(),ends_at:endsAt.toISOString(),status:"scheduled",
  });
  created.sessions.push(sessionId);
  for(const child of [c1,c2])await insert("subscriptions",{
    parent_id:created.parent,child_id:child,cohort_id:created.cohort,
    plan_id:"staging-khota-2-20261025",status:"active",start_date:dateKey,
  });
  const payload={sessionId,entries:[
    {childId:c1,subjectsCompleted:["رياضيات"],independenceRating:4,focusRating:3,
     tomorrowReadiness:"جيدة",teacherNote:"ملاحظة تجريبية فقط",needsSpecialist:false,
     materialsReady:true,tomorrowTestStatus:"",remainingReview:"مراجعة تجريبية",
     readinessStatus:"ready",attended:true},
    {childId:c2,subjectsCompleted:[],independenceRating:3,focusRating:3,
     tomorrowReadiness:"",teacherNote:"غياب تجريبي فقط",needsSpecialist:false,
     materialsReady:false,tomorrowTestStatus:"",remainingReview:"",
     readinessStatus:"needs_attention",attended:false,absenceReason:"excused"},
  ]};
  acting=null;
  let res=await post(payload);
  verify(res.status===401,"Anonymous session-report must return HTTP 401");
  acting=other;
  res=await post(payload);
  verify(res.status===403,"Unrelated active teacher must return HTTP 403");
  acting=active;
  const disable=await admin.from("teachers").update({active:false}).eq("id",t1);
  if(disable.error)throw new Error("Failed to disable test teacher");
  res=await post(payload);
  verify(res.status===403,"Disabled teacher must be denied even with existing valid JWT");
  const enable=await admin.from("teachers").update({active:true}).eq("id",t1);
  if(enable.error)throw new Error("Failed to reactivate test teacher");
  res=await post({...payload,entries:[payload.entries[0]]});
  verify(res.status===409,"Partial group report must be rejected");
  res=await post(payload);
  verify(res.status===200 && res.body?.ok===true,"Valid teacher report should be accepted");
  verify(await rowCount("daily_pulse_reports","session_id",sessionId)===2,"Two student reports must persist");
  const {data:attendance,error:attendanceError}=await admin.from("attendance")
    .select("child_id,status,reason").eq("session_id",sessionId);
  if(attendanceError)throw new Error("Failed to verify student attendance");
  verify(attendance?.length===2 && attendance.some(a=>a.child_id===c1&&a.status==="present") &&
    attendance.some(a=>a.child_id===c2&&a.status==="absent"&&a.reason==="excused"),
    "Teacher must write present and excused absence correctly");
  verify(await rowCount("makeup_credits","source_session_id",sessionId)===1,"Excused absence should issue one makeup credit");
  verify(await rowCount("daily_tasks","session_id",sessionId)===2,"Completed subject + next-day review should appear as tasks");
  const {data:sessionAfter}=await admin.from("sessions").select("status").eq("id",sessionId).single();
  verify(sessionAfter?.status==="completed","Session should transition to completed only after attendance");
  // A real parent JWT must be able to read its own child's attendance records.
  const {data:parentAttendance,error:parentReadError}=await parent.client.from("attendance")
    .select("id").eq("session_id",sessionId);
  verify(!parentReadError && parentAttendance?.length===2,"Parent JWT should see two own-child attendance records");
  // Re-submit is expected to remain idempotent for credits and report count.
  res=await post(payload);
  verify(res.status===200,"Repeated teacher report must remain safe");
  verify(await rowCount("makeup_credits","source_session_id",sessionId)===1,"Retry must not double-credit absence");
  verify(await rowCount("daily_pulse_reports","session_id",sessionId)===2,"Retry must not duplicate reports");
  console.log("PASS Staging live teacher route integration: "+checks+" Auth+handler+DB assertions; attendance, 2 reports, makeup credit, tasks, parent visibility, retries.");
}catch(e){
  failures.push("integration-test");
  // Do not expose Supabase response objects, credentials, identities or tokens.
  console.error("FAIL Staging teacher route integration: "+String(e?.message||"unknown"));
}finally{
  await cleanup();
  if(failures.length)console.error("FAIL Staging test or fixture cleanup: "+[...new Set(failures)].join(","));
  else console.log("PASS temporary Staging session-report fixture cleanup.");
}
if(failures.length)process.exitCode=1;
