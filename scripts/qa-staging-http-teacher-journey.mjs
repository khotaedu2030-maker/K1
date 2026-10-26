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
const created = {users:[],teachers:[],parent:null,children:[],cohort:null,sessions:[]};
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
  return {status:r.status,location:r.headers.get("location"),html:payload};
}
async function erase(table,key,id){
  if(!id)return;
  const {error}=await admin.from(table).delete().eq(key,id);
  if(error)problems.push("cleanup-"+table);
}
async function cleanup(){
  // Generated data only; never remove the pre-existing staging sample plan/cohort.
  for(const child of created.children){
    for(const name of ["daily_tasks","makeup_credits","daily_pulse_reports","attendance","recommendations"]){
      await erase(name,"child_id",child);
    }
  }
  for(const sid of created.sessions)await erase("sessions","id",sid);
  for(const child of created.children)await erase("children","id",child);
  if(created.parent)await erase("parents","id",created.parent);
  if(created.cohort)await erase("cohorts","id",created.cohort);
  for(const teacher of created.teachers)await erase("teachers","id",teacher);
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
  const t1=await insert("teachers",{user_id:teacher.id,full_name:"معلم اختبار HTTP",active:true});
  const t2=await insert("teachers",{user_id:unrelated.id,full_name:"معلم بعيد",active:true});
  created.teachers.push(t1,t2);
  created.parent=await insert("parents",{
    user_id:parent.id,full_name:"ولي أمر HTTP",phone:"+966500000000",
  });
  const child=await insert("children",{parent_id:created.parent,first_name:"طالب اختبار HTTP",grade:4});
  created.children.push(child);
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
