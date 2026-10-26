// Isolated KHOTA Staging HTTP/cookie integration against a temporary Next.js server.
// Explicit opt-in only; requires NEXT BUILD output before launching. Not real
// Vercel Edge, not browser/Playwright, and does not simulate OTP email delivery.
// Uses real Supabase-generated sessions stored with the production SSR cookie API;
// requests execute the real Next.js proxy, pages, route handlers, limiter, and DB.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { createHmac, randomUUID, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";
import { validateStagingConfig } from "./qa-staging-env.mjs";

const env = process.env;
if (!process.argv.includes("--ephemeral-staging-only") ||
    !validateStagingConfig(env).ok ||
    env.NEXT_PUBLIC_SITE_URL !== "https://khota-staging-web-khota.vercel.app" ||
    env.VERCEL_PROJECT_ID !== "prj_mpaXaRNmczd9jbqjtigtyKpMDJ5r" ||
    env.KHOTA_PAYMENTS_ENABLED !== "false" ||
    env.KHOTA_PILOT_AUTH === "true") {
  throw new Error("Fail closed: isolated Staging HTTP test is not authorized in this runtime.");
}
await import("./qa-staging-live-credential.mjs");

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
});
const makeBrowserAuth = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
});
const created = {users:[],teachers:[],admins:[],parent:null,children:[],cohort:null,sessions:[],studentModes:[]};
const rateLimitKeys = new Set();
const tag = randomUUID().slice(0,8);
let childProcess = null, problems = [], checks = 0;
let localhost = null;
const verify = (condition, reason) => { assert.ok(condition, reason); checks++; };
const fail = (reason) => { throw new Error(reason); };
const count = async (table, key, value) => {
  const {count:c,error}=await admin.from(table).select("*",{head:true,count:"exact"}).eq(key,value);
  if(error)fail("Staging verification failed for "+table+" ("+(error.code||"unknown")+")");
  return c ?? 0;
};
const insert = async (table, values) => {
  const {data,error}=await admin.from(table).insert(values).select("id").single();
  if(error || !data?.id)fail("Staging fixture insert failed for "+table+" ("+(error?.code||"unknown")+")");
  return data.id;
};
const riyadhDate = (d) => {
  const parts=new Intl.DateTimeFormat("en-US", {timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
  const get=(type)=>parts.find((p)=>p.type===type)?.value;
  return [get("year"),get("month"),get("day")].join("-");
};
function limiterKey(scope, identifier) {
  const hashed=createHmac("sha256",env.SUPABASE_SERVICE_ROLE_KEY)
    .update(scope+"\0"+identifier.trim().toLowerCase()).digest("hex");
  return scope+":"+hashed;
}
async function identity(label) {
  const email="khota-http-"+label+"-"+tag+"@example.invalid";
  const password=randomBytes(38).toString("base64url")+"Aa1!";
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
  if(error||!data?.user?.id)fail("Auth fixture "+label+" creation failed ("+(error?.status||"unknown")+")");
  created.users.push(data.user.id);
  const auth=makeBrowserAuth();
  const {data:login,error:signInError}=await auth.auth.signInWithPassword({email,password});
  if(signInError || !login?.session?.access_token || !login.session.refresh_token)fail("Staging synthetic Auth sign-in failed");
  const cookieJar = new Map();
  const ssr=createServerClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies:{
      getAll(){return [...cookieJar].map(([name,value])=>({name,value}));},
      setAll(list) {
        for (const cookie of list) {
          if (cookie.options?.maxAge===0) cookieJar.delete(cookie.name);
          else cookieJar.set(cookie.name,cookie.value);
        }
      },
    },
  });
  const {data:attached,error:attachErr}=await ssr.auth.setSession({
    access_token:login.session.access_token,refresh_token:login.session.refresh_token,
  });
  if(attachErr||attached?.user?.id!==data.user.id||cookieJar.size===0)fail("SSR cookie session attachment failed");
  const {data:checked,error:checkErr}=await ssr.auth.getUser();
  if(checkErr||checked?.user?.id!==data.user.id)fail("SSR cookie server-session verification failed");
  // Only return in-memory cookie header, never serialize into logs or files.
  return {id:data.user.id, cookieHeader:[...cookieJar].map(([name,value])=>name+"="+value).join("; ")};
}
async function listenPort() {
  const s=createServer();
  s.listen(0,"127.0.0.1");
  await once(s,"listening");
  const p=s.address().port;
  s.close();await once(s,"close");
  return p;
}
async function bootServer() {
  const port=await listenPort();
  localhost="http://127.0.0.1:"+port;
  childProcess=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p",String(port)],{
    cwd:resolve("."),env:{...env,NODE_ENV:"production"},stdio:"ignore",
  });
  for(let tries=0;tries<100;tries++){
    if(childProcess.exitCode!==null)fail("Local Next.js server exited before ready");
    try{
      const res=await fetch(localhost+"/login",{redirect:"manual",signal:AbortSignal.timeout(1500)});
      if(res.status===200)return;
    }catch{ /* retry only during bounded local server startup */ }
    await sleep(200);
  }
  fail("Local Next.js server startup deadline exceeded");
}
async function request(path,{method="GET",cookieHeader="",body=null,origin=null}={}){
  const headers={};
  if(cookieHeader)headers.cookie=cookieHeader;
  if(body!==null)headers["content-type"]="application/json";
  if(origin)headers.origin=origin;
  const r=await fetch(localhost+path,{
    method,headers,body:body===null?undefined:JSON.stringify(body),
    redirect:"manual",signal:AbortSignal.timeout(20000),
  });
  const payload=await r.text();
  return {status:r.status,location:r.headers.get("location"),html:payload,setCookies:r.headers.getSetCookie()};
}
async function erase(table,key,id){
  if(!id)return;
  const {error}=await admin.from(table).delete().eq(key,id);
  if(error)problems.push("cleanup-"+table);
}
async function cleanup(){
  // Any enrollment-created child also belongs exclusively to our synthetic parent.
  // Reconcile IDs before deletion even if an earlier HTTP assertion interrupted.
  if(created.parent){
    const {data:allOwned,error:lookupError}=await admin.from("children").select("id").eq("parent_id",created.parent);
    if(lookupError)problems.push("cleanup-child-lookup");
    for(const row of allOwned||[])if(!created.children.includes(row.id))created.children.push(row.id);
  }
  // Generated data only; never remove the pre-existing staging sample plan/cohort.
  for(const child of created.children){
    for(const name of ["daily_tasks","makeup_credits","daily_pulse_reports","attendance","recommendations"]){
      await erase(name,"child_id",child);
    }
  }
  for(const modeId of created.studentModes)await erase("student_mode_sessions","id",modeId);
  for(const sid of created.sessions)await erase("sessions","id",sid);
  for(const child of created.children)await erase("children","id",child);
  if(created.parent)await erase("parents","id",created.parent);
  if(created.cohort)await erase("cohorts","id",created.cohort);
  for(const teacher of created.teachers)await erase("teachers","id",teacher);
  for(const adminId of created.admins)await erase("admins","id",adminId);
  for(const uid of created.users){
    const {error}=await admin.auth.admin.deleteUser(uid);
    if(error)problems.push("cleanup-auth");
  }
  for(const key of rateLimitKeys)await erase("api_rate_limits","key",key);
}
try{
  await bootServer();
  const unauth=await request("/teacher",{});
  verify([307,308,302].includes(unauth.status) &&
    (unauth.location||"").includes("/login"),"Guest access to teacher page must redirect");
  const wrongOrigin=await request("/api/session-report/submit",{
    method:"POST",body:{sessionId:randomUUID(),entries:[]},origin:"https://not-khota.invalid",
  });
  verify(wrongOrigin.status===403,"Cross-origin API request should fail CSRF proxy");

  const teacher=await identity("teacher");
  const unrelated=await identity("unrelated");
  const parent=await identity("parent");
  const ops=await identity("ops-manager");
  const finance=await identity("finance-admin");
  const t1=await insert("teachers",{user_id:teacher.id,full_name:"معلم اختبار HTTP",active:true});
  const t2=await insert("teachers",{user_id:unrelated.id,full_name:"معلم بعيد",active:true});
  created.teachers.push(t1,t2);
  const opsId=await insert("admins",{user_id:ops.id,full_name:"مدير عمليات QA",role:"operations_manager",active:true});
  const financeId=await insert("admins",{user_id:finance.id,full_name:"مسؤول مالية QA",role:"finance_admin",active:true});
  created.admins.push(opsId,financeId);
  created.parent=await insert("parents",{
    user_id:parent.id,full_name:"ولي أمر HTTP",phone:"+966500000000",
  });
  const child=await insert("children",{parent_id:created.parent,first_name:"طالب اختبار HTTP",grade:4});
  created.children.push(child);
  const sibling=await insert("children",{parent_id:created.parent,first_name:"طالب اختبار ثانٍ",grade:4});
  created.children.push(sibling);
  const siblingTask=await insert("daily_tasks",{child_id:sibling,title:"مهمة لطالب آخر",status:"pending"});
  created.cohort=await insert("cohorts",{
    product:"motabaa",plan_id:"staging-khota-2-20261025",teacher_id:t1,grade_band:"4-6",status:"open",
    title:"مجموعة HTTP اختبار "+tag,capacity:4,days_of_week:[1,3],start_time:"17:00",end_time:"17:45",
    slot_code:"QA-HTTP-"+tag,
  });
  const start=new Date(Date.now()-15*60000),end=new Date(Date.now()+30*60000);
  const session=await insert("sessions",{
    cohort_id:created.cohort,teacher_id:t1,status:"scheduled",
    session_date:riyadhDate(start),starts_at:start.toISOString(),ends_at:end.toISOString(),
  });
  created.sessions.push(session);
  await insert("subscriptions",{
    parent_id:created.parent,child_id:child,cohort_id:created.cohort,
    plan_id:"staging-khota-2-20261025",status:"active",start_date:riyadhDate(start),
  });
  rateLimitKeys.add(limiterKey("session-report:teacher",teacher.id));
  rateLimitKeys.add(limiterKey("session-report:teacher",unrelated.id));
  rateLimitKeys.add(limiterKey("session-report:session",session));
  rateLimitKeys.add(limiterKey("student-mode:enter:user",parent.id));
  rateLimitKeys.add(limiterKey("student-mode:enter:child",child));

  const teacherHome=await request("/teacher",{cookieHeader:teacher.cookieHeader});
  verify(teacherHome.status===200 && teacherHome.html.includes("معلم اختبار HTTP"),
    "Logged-in teacher must see own dashboard");
  const teacherSchedule=await request("/teacher/schedule",{cookieHeader:teacher.cookieHeader});
  verify(teacherSchedule.status===200 && teacherSchedule.html.includes("مجموعة HTTP اختبار"),
    "Logged-in teacher must see own scheduled cohort");
  const reportPage=await request("/teacher/session-report?session="+session,{cookieHeader:teacher.cookieHeader});
  verify(reportPage.status===200 && reportPage.html.includes("طالب اختبار HTTP"),
    "Teacher must receive own student report form");
  const wrongTeacher=await request("/teacher/session-report?session="+session,{cookieHeader:unrelated.cookieHeader});
  verify(wrongTeacher.status===200 && wrongTeacher.html.includes("هذه الجلسة غير متاحة لحسابك") &&
    !wrongTeacher.html.includes("طالب اختبار HTTP"),"Unrelated teacher must not see other student");
  const parentPageBefore=await request("/parent",{cookieHeader:parent.cookieHeader});
  verify(parentPageBefore.status===200 && parentPageBefore.html.includes("طالب اختبار HTTP"),
    "Logged-in parent must see their child");
  const opsPage=await request("/admin",{cookieHeader:ops.cookieHeader});
  verify(opsPage.status===200 && opsPage.html.includes("مدير عمليات QA"),"Operations manager must see admin overview");
  const financePage=await request("/admin",{cookieHeader:finance.cookieHeader});
  verify(financePage.status===200 && financePage.html.includes("مسؤول مالية QA"),"Finance admin can see its own admin overview");
  const opsAttendance=await request("/admin/attendance",{cookieHeader:ops.cookieHeader});
  verify(opsAttendance.status===200 && !opsAttendance.html.includes("هذه الصفحة لحسابات الإدارة فقط"),
    "Operations manager can read attendance operations");
  const financeAttendance=await request("/admin/attendance",{cookieHeader:finance.cookieHeader});
  verify(financeAttendance.status===200 && financeAttendance.html.includes("غير مصرَّح"),
    "Finance admin must not read attendance page without permission");
  const fakeAssignment={sessionId:randomUUID(),teacherId:t1,reason:"اختبار صلاحية فقط"};
  const opsDeniedMissing=await request("/api/admin/sessions",{method:"POST",cookieHeader:ops.cookieHeader,body:fakeAssignment});
  verify(opsDeniedMissing.status===404,"Operations manager permitted API must proceed to missing session check");
  const financeForbidden=await request("/api/admin/sessions",{method:"POST",cookieHeader:finance.cookieHeader,body:fakeAssignment});
  verify(financeForbidden.status===403,"Finance admin cannot manage sessions");
  const parentForbidden=await request("/api/admin/sessions",{method:"POST",cookieHeader:parent.cookieHeader,body:fakeAssignment});
  verify(parentForbidden.status===403,"Parent cannot manage admin sessions");
  const adminDisable=await admin.from("admins").update({active:false}).eq("id",opsId);
  if(adminDisable.error)fail("Staging admin disable failed");
  const blockedOps=await request("/api/admin/sessions",{method:"POST",cookieHeader:ops.cookieHeader,body:fakeAssignment});
  verify(blockedOps.status===403,"Revoked admin must lose permission despite existing SSR cookie");
  const adminEnable=await admin.from("admins").update({active:true}).eq("id",opsId);
  if(adminEnable.error)fail("Staging admin reactivation failed");
  const entry={childId:child,subjectsCompleted:["رياضيات"],independenceRating:4,focusRating:4,
    tomorrowReadiness:"جيدة",teacherNote:"تقرير مؤقت",needsSpecialist:false,
    materialsReady:true,tomorrowTestStatus:"",remainingReview:"مراجعة مؤقتة",
    readinessStatus:"ready",attended:true};
  const payload={sessionId:session,entries:[entry]};
  const guestPost=await request("/api/session-report/submit",{method:"POST",body:payload});
  verify(guestPost.status===401,"Guest POST must be HTTP 401");
  const unrelatedPost=await request("/api/session-report/submit",{method:"POST",body:payload,cookieHeader:unrelated.cookieHeader});
  verify(unrelatedPost.status===403,"Unrelated teacher POST must be HTTP 403");
  const disable=await admin.from("teachers").update({active:false}).eq("id",t1);
  if(disable.error)fail("Teacher fixture disable failed");
  const disabledPost=await request("/api/session-report/submit",{method:"POST",body:payload,cookieHeader:teacher.cookieHeader});
  verify(disabledPost.status===403,"Existing cookie of disabled teacher must not submit");
  const enable=await admin.from("teachers").update({active:true}).eq("id",t1);
  if(enable.error)fail("Teacher fixture enable failed");
  const posted=await request("/api/session-report/submit",{method:"POST",body:payload,cookieHeader:teacher.cookieHeader});
  verify(posted.status===200 && JSON.parse(posted.html).ok===true,
    "Teacher must submit real POST through Next.js with SSR cookies");
  verify(await count("daily_pulse_reports","session_id",session)===1,"HTTP POST must store progress report");
  verify(await count("attendance","session_id",session)===1,"HTTP POST must record attendance");
  const {data:finished}=await admin.from("sessions").select("status").eq("id",session).single();
  verify(finished?.status==="completed","HTTP POST must complete the session");
  const parentPageAfter=await request("/parent",{cookieHeader:parent.cookieHeader});
  verify(parentPageAfter.status===200 && parentPageAfter.html.includes("مراجعة مؤقتة"),
    "Parent dashboard must display teacher's report-derived review task");

  // Parent multi-child regression: add the sibling to the SAME group only
  // after the original report was completed so its expected roster is unchanged.
  await insert("subscriptions",{
    parent_id:created.parent,child_id:sibling,cohort_id:created.cohort,
    plan_id:"staging-khota-2-20261025",status:"active",start_date:riyadhDate(start),
  });
  await insert("child_progress_snapshots",{
    child_id:child,created_by:t1,source:"teacher",focus_score:4,
  });
  await insert("child_progress_snapshots",{
    child_id:sibling,created_by:t1,source:"teacher",focus_score:1,
  });
  const futureStart=new Date(Date.now()+2*60*60_000);
  const futureEnd=new Date(futureStart.getTime()+45*60_000);
  const sharedSession=await insert("sessions",{
    cohort_id:created.cohort,teacher_id:t1,status:"scheduled",
    session_date:riyadhDate(futureStart),
    starts_at:futureStart.toISOString(),ends_at:futureEnd.toISOString(),
  });
  created.sessions.push(sharedSession);
  const parentSharedSchedule=await request("/parent/schedule",{cookieHeader:parent.cookieHeader});
  verify(parentSharedSchedule.status===200 &&
    parentSharedSchedule.html.includes("طالب اختبار HTTP") &&
    parentSharedSchedule.html.includes("طالب اختبار ثانٍ"),
    "Parent schedule must display both siblings enrolled in one cohort");
  const secondOverview=await request("/parent?child="+encodeURIComponent(sibling),{cookieHeader:parent.cookieHeader});
  verify(secondOverview.status===200 && secondOverview.html.includes("هذه خُطى طالب اختبار ثانٍ") &&
    !secondOverview.html.includes("مراجعة مؤقتة"),
    "Parent overview must switch to sibling data, not mix with first child");
  const firstReport=await request("/parent/reports?child="+encodeURIComponent(child),{cookieHeader:parent.cookieHeader});
  const siblingReport=await request("/parent/reports?child="+encodeURIComponent(sibling),{cookieHeader:parent.cookieHeader});
  verify(firstReport.status===200 &&
    firstReport.html.includes("التركيز: 4 من 5 إلى 4 من 5") &&
    siblingReport.status===200 &&
    siblingReport.html.includes("التركيز: 1 من 5 إلى 1 من 5") &&
    !siblingReport.html.includes("التركيز: 4 من 5 إلى 4 من 5"),
    "Parent progress reports must only use selected child's score and accessible dimension label");
  const foreignReport=await request("/parent/reports?child="+randomUUID(),{cookieHeader:parent.cookieHeader});
  verify(foreignReport.status===200 && foreignReport.html.includes("الطفل المطلوب غير مرتبط بحسابك") &&
    !foreignReport.html.includes("4/5") && !foreignReport.html.includes("1/5"),
    "Foreign child ID in query must fail closed with no progress disclosure");
  const siblingWeekly=await request("/parent/reports/weekly?child="+encodeURIComponent(sibling),{cookieHeader:parent.cookieHeader});
  verify(siblingWeekly.status===200 && siblingWeekly.html.includes("طالب اختبار ثانٍ"),
    "Weekly parent report must render the explicitly owned sibling");
  // Real HTTP parent-task visibility by child and task status.
  await insert("daily_tasks",{child_id:child,title:"مهمة معلقة للأول",status:"pending",due_date:"2026-10-01"});
  await insert("daily_tasks",{child_id:child,title:"مهمة منجزة للأول",status:"done"});
  await insert("daily_tasks",{child_id:child,title:"مراجعة المعلم للأول",status:"needs_review"});
  const firstTasksPage=await request("/parent/tasks?child="+encodeURIComponent(child),{cookieHeader:parent.cookieHeader});
  verify(firstTasksPage.status===200 && firstTasksPage.html.includes("مهمة معلقة للأول") &&
    firstTasksPage.html.includes("مهمة منجزة للأول") && firstTasksPage.html.includes("مراجعة المعلم للأول") &&
    !firstTasksPage.html.includes("مهمة لطالب آخر"),
    "Parent task view separates the selected child's pending, done and teacher-review tasks");
  const siblingTasksPage=await request("/parent/tasks?child="+encodeURIComponent(sibling),{cookieHeader:parent.cookieHeader});
  verify(siblingTasksPage.status===200 && siblingTasksPage.html.includes("مهمة لطالب آخر") &&
    !siblingTasksPage.html.includes("مهمة معلقة للأول") && !siblingTasksPage.html.includes("مراجعة المعلم للأول"),
    "Sibling task view excludes first child's assignments");
  const forbiddenTasksPage=await request("/parent/tasks?child="+randomUUID(),{cookieHeader:parent.cookieHeader});
  verify(forbiddenTasksPage.status===200 && forbiddenTasksPage.html.includes("الطفل المطلوب غير مرتبط بحسابك") &&
    !forbiddenTasksPage.html.includes("مهمة معلقة للأول") && !forbiddenTasksPage.html.includes("مهمة لطالب آخر"),
    "Foreign child's task URL does not reveal other children's tasks");
  const homeWithTaskSummary=await request("/parent?child="+encodeURIComponent(child),{cookieHeader:parent.cookieHeader});
  verify(homeWithTaskSummary.status===200 &&
    homeWithTaskSummary.html.includes("بانتظار مراجعة المعلم") &&
    homeWithTaskSummary.html.includes("جميع مهام"),
    "Parent dashboard links detailed tasks and identifies the teacher review state");
  const guestEnter=await request("/api/student-mode/enter",{method:"POST",body:{childId:child}});
  verify(guestEnter.status===401,"Guest must not open student mode");
  const invalidChildEnter=await request("/api/student-mode/enter",{
    method:"POST",cookieHeader:parent.cookieHeader,body:{childId:randomUUID()},
  });
  verify(invalidChildEnter.status===403,"Parent cannot open mode for an unrelated child");
  const studentEnter=await request("/api/student-mode/enter",{
    method:"POST",cookieHeader:parent.cookieHeader,body:{childId:child},
  });
  verify(studentEnter.status===200 && JSON.parse(studentEnter.html).ok===true,
    "Parent can open verified student-mode via real HTTP");
  const encodedCookie=studentEnter.setCookies?.find(c=>c.startsWith("khota_student_session="))?.split(";")[0];
  if(!encodedCookie)fail("Student mode cookie was not issued");
  const studentModeId=decodeURIComponent(encodedCookie.split("=")[1]);
  verify(/^[0-9a-f-]{36}$/i.test(studentModeId),"Student mode cookie contains only opaque session UUID");
  created.studentModes.push(studentModeId);
  const childCookie=parent.cookieHeader+"; "+encodedCookie;
  const studentToday=await request("/student/today",{cookieHeader:childCookie});
  verify(studentToday.status===200 && studentToday.html.includes("طالب اختبار HTTP"),
    "Activated student sees only their own Today dashboard");
  const studentTasks=await request("/student/tasks",{cookieHeader:childCookie});
  verify(studentTasks.status===200 && studentTasks.html.includes("مراجعة مؤقتة"),
    "Student can see their own report-derived tasks");
  verify(!studentTasks.html.includes("مهمة لطالب آخر"),
    "Student cannot see sibling's tasks on student dashboard");
  const studentSchedule=await request("/student/schedule",{cookieHeader:childCookie});
  verify(studentSchedule.status===200 && studentSchedule.html.includes("مجموعة HTTP اختبار"),
    "Student can see only enrolled group schedule");
  const studentParentAttempt=await request("/parent",{cookieHeader:childCookie});
  verify([307,308,302].includes(studentParentAttempt.status) &&
    (studentParentAttempt.location||"").includes("/student/today"),
    "Student-mode session redirects away from parent's dashboard");
  const studentTeacherAttempt=await request("/teacher",{cookieHeader:childCookie});
  verify([307,308,302].includes(studentTeacherAttempt.status) &&
    (studentTeacherAttempt.location||"").includes("/student/today"),
    "Student mode cannot access teacher workspace");
  const studentAdminAttempt=await request("/admin",{cookieHeader:childCookie});
  verify([307,308,302].includes(studentAdminAttempt.status) &&
    (studentAdminAttempt.location||"").includes("/student/today"),
    "Student mode cannot access admin workspace");
  const studentForbiddenPost=await request("/api/session-report/submit",{
    method:"POST",cookieHeader:childCookie,body:payload,
  });
  verify(studentForbiddenPost.status===403,"Student mode forbids teacher POST via proxy allowlist");
  const ownTasks=await admin.from("daily_tasks").select("id,status").eq("child_id",child);
  if(ownTasks.error||!ownTasks.data?.length)fail("Own task fixture missing");
  const ownTask=ownTasks.data.find(t=>t.status==="pending");
  if(!ownTask)fail("Own pending task missing");
  const crossChildToggle=await request("/api/student/tasks/toggle",{
    method:"POST",cookieHeader:childCookie,body:{taskId:siblingTask},
  });
  verify(crossChildToggle.status===403,"Student cannot mutate sibling's task by ID");
  const ownToggle=await request("/api/student/tasks/toggle",{
    method:"POST",cookieHeader:childCookie,body:{taskId:ownTask.id},
  });
  verify(ownToggle.status===200 && JSON.parse(ownToggle.html).status==="done",
    "Student can complete own task with actual HTTP route");
  const {data:taskAfter,error:taskError}=await admin.from("daily_tasks").select("status").eq("id",ownTask.id).single();
  verify(!taskError&&taskAfter?.status==="done","Own task mutation persists in real Staging DB");
  const {error:disableModeError}=await admin.from("student_mode_sessions").update({active:false}).eq("id",studentModeId);
  if(disableModeError)fail("Student mode deactivation fixture failed");
  const deactivatedAttempt=await request("/student/today",{cookieHeader:childCookie});
  verify([307,308,302].includes(deactivatedAttempt.status) &&
    (deactivatedAttempt.location||"").includes("/student"),
    "Deactivated student session cannot load student dashboard even with old cookie");
  const childToParentAfter=await request("/parent",{cookieHeader:childCookie});
  verify(childToParentAfter.status===200&&childToParentAfter.html.includes("طالب اختبار HTTP"),
    "Revoked student cookie restores parent's dashboard access");
  // Actual booking gate -> authenticated parent -> pending-payment-only enrollment.
  // Keep real payments OFF; never invoke activation or manual payment confirmation.
  const publicCheckout=await request("/motabaa/enroll?grade=4&cohort="+created.cohort);
  verify(publicCheckout.status===200 && publicCheckout.html.includes("اسم ولي الأمر") &&
    publicCheckout.html.includes("مجموعة HTTP اختبار"),
    "Open same-grade priced cohort should show enrollment form");
  const wrongGradeCheckout=await request("/motabaa/enroll?grade=8&cohort="+created.cohort);
  verify(wrongGradeCheckout.status===200 &&
    wrongGradeCheckout.html.includes("صف الطالب لا يطابق المجموعة المختارة") &&
    !wrongGradeCheckout.html.includes("اسم ولي الأمر"),
    "Wrong grade cannot collect parent identity before detecting mismatch");
  const missingCheckout=await request("/motabaa/enroll?grade=4&cohort="+randomUUID());
  verify(missingCheckout.status===200 && missingCheckout.html.includes("المجموعة المطلوبة غير موجودة") &&
    !missingCheckout.html.includes("اسم ولي الأمر"),
    "Deleted or fabricated group cannot present enrollment form");
  const guestEnroll=await request("/api/enroll",{
    method:"POST",body:{parentName:"ولي أمر تجريبي",phone:"0500000000",childName:"طالب تجربة",grade:4,cohortId:created.cohort},
  });
  verify(guestEnroll.status===401,"Unverified guest cannot reserve a seat");
  const enrollPayload={parentName:"ولي أمر HTTP",phone:"0500000000",
    childName:"طالب تسجيل مؤقت "+tag,grade:4,cohortId:created.cohort};
  rateLimitKeys.add(limiterKey("enroll:user",parent.id));
  const enrollResponse=await request("/api/enroll",{method:"POST",cookieHeader:parent.cookieHeader,body:enrollPayload});
  const enrolled=enrollResponse.status===200?JSON.parse(enrollResponse.html):{};
  const subscriptionId=enrolled.subscriptionId;
  // Reconcile newly added child even if later assertions fail, before verifying success.
  const {data:enrolledChildren,error:childLookupError}=await admin.from("children")
    .select("id").eq("parent_id",created.parent).eq("first_name",enrollPayload.childName);
  if(childLookupError)fail("Synthetic enrollment child lookup failed");
  for(const row of enrolledChildren||[])if(!created.children.includes(row.id))created.children.push(row.id);
  verify(enrollResponse.status===200 && typeof subscriptionId==="string" &&
    enrolledChildren?.length===1,"Authenticated enrollment creates exactly one synthetic child and a subscription");
  const {data:newSub,error:subError}=await admin.from("subscriptions")
    .select("id,status,parent_id,child_id").eq("id",subscriptionId).maybeSingle();
  verify(!subError && newSub?.status==="pending_payment" &&
    newSub.parent_id===created.parent && newSub.child_id===enrolledChildren[0].id,
    "Enrollment must remain pending payment, never silently activate during payment pause");
  const retryEnroll=await request("/api/enroll",{method:"POST",cookieHeader:parent.cookieHeader,body:enrollPayload});
  verify(retryEnroll.status===200 && JSON.parse(retryEnroll.html).subscriptionId===subscriptionId,
    "Retry with same child/cohort must return same held subscription");
  const {count:enrollmentRows,error:subCountError}=await admin.from("subscriptions")
    .select("id",{head:true,count:"exact"}).eq("child_id",enrolledChildren[0].id).eq("cohort_id",created.cohort);
  verify(!subCountError && enrollmentRows===1,"Idempotent enrollment may not duplicate the seat hold");
  const paymentScreen=await request("/motabaa/enroll/payment?sub="+subscriptionId,{cookieHeader:parent.cookieHeader});
  verify(paymentScreen.status===200 &&
    paymentScreen.html.includes("الدفع الإلكتروني متوقف مؤقتًا") &&
    !paymentScreen.html.includes("تم حجز مقعد طفلك في خُطى"),
    "Payment paused checkout must not claim active subscription or ready first session");
  const subList=await request("/parent/subscriptions",{cookieHeader:parent.cookieHeader});
  verify(subList.status===200 && subList.html.includes("بانتظار الدفع") &&
    subList.html.includes("طالب تسجيل مؤقت"),
    "Parent subscriptions list reflects pending enrollment rather than active");
    console.log("PASS live Staging localhost HTTP integration: "+checks+
    " assertions using actual Next proxy, Supabase SSR cookies, teacher/parent pages, CSRF, role checks, teacher POST, rate limits and DB.");
}catch(e){
  problems.push("test");
  console.error("FAIL live Staging HTTP integration: "+String(e?.message||"unknown"));
}finally{
  try{await cleanup();}catch{problems.push("cleanup-exception");}
  if(childProcess && childProcess.exitCode===null){
    childProcess.kill("SIGTERM");
    await Promise.race([once(childProcess,"exit").catch(()=>{}),sleep(2000)]);
    if(childProcess.exitCode===null)childProcess.kill("SIGKILL");
  }
  if(problems.length)console.error("FAIL Staging HTTP fixture test or cleanup: "+[...new Set(problems)].join(","));
  else console.log("PASS Staging HTTP fixture cleanup (Auth users, student, session, reports and rate-limit counters).");
}
if(problems.length)process.exitCode=1;
