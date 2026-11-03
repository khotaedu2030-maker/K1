import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { preparePilotSessionSchedule } from "@/lib/activate-subscription";
import { pilotActivationEnabled } from "@/lib/pilot-activation-config";
import { checkRateLimit, declaredBodyExceeds, readJsonBodyLimited, rateLimitRejectionResponse } from "@/lib/api-rate-limit";

// This is a FREE administrative entitlement, not manual or Paylink payment.
// Closed in every environment except the separately owned staging project.

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export async function POST(req: Request) {
  if (!pilotActivationEnabled()) {
    return NextResponse.json({ error: "تفعيل التجربة المجانية غير متاح في هذه البيئة" }, { status: 403 });
  }
  const adminCheck=await requirePermission("pilot.activate");
  if (!adminCheck.ok) return adminCheck.response;
  if (declaredBodyExceeds(req,4096)) {
    return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  }
  const parsed=await readJsonBodyLimited(req,4096);
  if (!parsed.ok) return NextResponse.json({ error: "تعذّر قراءة الطلب" }, { status: 400 });
  const body=parsed.body;
  const subscriptionId=typeof body?.subscriptionId==="string"?body.subscriptionId.trim():"";
  const reason=typeof body?.reason==="string"?body.reason.trim():"";
  if (!UUID.test(subscriptionId) || reason.length<20 || reason.length>500) {
    return NextResponse.json({ error: "حدد اشتراكًا صحيحًا وسببًا واضحًا من 20 إلى 500 حرف" }, { status: 400 });
  }

  const limit=await checkRateLimit({
    request:req,scope:"pilot-activation:admin",identifier:adminCheck.userId,limit:5,windowSeconds:600,
  });
  const denied=rateLimitRejectionResponse(limit);
  if (denied) return denied;
  const perSubscription=await checkRateLimit({
    request:req,scope:"pilot-activation:subscription",identifier:subscriptionId,limit:5,windowSeconds:600,
  });
  const deniedSubscription=rateLimitRejectionResponse(perSubscription);
  if (deniedSubscription) return deniedSubscription;

  const supabase=createSupabaseAdminClient();
  const {data:sub,error:subError}=await supabase.from("subscriptions")
    .select("id,plan_id,cohort_id,status").eq("id",subscriptionId).maybeSingle();
  if (subError) return NextResponse.json({ error:"تعذّر قراءة بيانات الاشتراك" },{status:503});
  if (!sub) return NextResponse.json({ error:"الاشتراك غير موجود" },{status:404});

  // Always call the atomic RPC for retries; it can distinguish a previously granted
  // pilot from a paid active subscription and never creates duplicate audit entries.
  let schedule:{
    startDate:string;renewalDate:string;
    sessionsToInsert:Array<{cohort_id:string;teacher_id:string|null;session_date:string;
      starts_at:string;ends_at:string;meeting_url:string|null;status:string}>;
  }|null=null;
  if (sub.status==="pending_payment") {
    const prep=await preparePilotSessionSchedule(supabase,sub);
    if (!prep.ok) return NextResponse.json({error:prep.error},{status:prep.status});
    schedule=prep;
  }
  const {data,error}=await supabase.rpc("activate_pilot_trial_atomic",{
    p_subscription_id:subscriptionId,
    p_admin_user_id:adminCheck.userId,
    p_reason:reason,
    p_start_date:schedule?.startDate??null,
    p_renewal_date:schedule?.renewalDate??null,
    p_sessions:schedule?.sessionsToInsert??[],
  });
  if (error) {
    console.error("[pilot-activation] atomic RPC error:",error.code||"unknown");
    return NextResponse.json({error:"تعذّر تفعيل الاشتراك التجريبي. لم تُسجّل دفعة مالية."},{status:503});
  }
  const row=(Array.isArray(data)?data[0]:null) as
    |{ok:boolean;already_active:boolean;error_code:string|null;sessions_created:number}|null;
  if (!row?.ok) {
    const codes:Record<string,[number,string]>={
      not_authorized:[403,"ليست لديك صلاحية التفعيل"],
      invalid_reason:[400,"سبب التفعيل غير مكتمل"],
      not_found:[404,"الاشتراك غير موجود"],
      already_active_non_pilot:[409,"الاشتراك نشط بطريق مختلف ولا يمكن منحه تجربة مجانية"],
      invalid_status:[409,"حالة الاشتراك لا تسمح بالتفعيل"],
      expired_hold:[409,"انتهت صلاحية حجز المقعد"],
      missing_cohort_child:[409,"بيانات المجموعة أو الطالب ناقصة"],
      child_parent_mismatch:[409,"بيانات ولي الأمر والطالب غير متطابقة"],
      cohort_unavailable:[409,"المجموعة غير متاحة"],
      invalid_plan:[409,"بيانات الباقة لا تسمح بالتفعيل"],
      teacher_not_ready:[409,"يجب تعيين معلم نشط للمجموعة"],
      teams_link_missing:[409,"يجب إعداد رابط Teams صالح للمجموعة"],
      pilot_quota_full:[409,"اكتمل الحد الأقصى للتجربة (20 طالبًا)"],
      cohort_full:[409,"لا توجد مقاعد متاحة"],
      invalid_schedule:[409,"جدول الجلسات غير مكتمل"],
      invalid_schedule_rows:[409,"مواعيد الجلسات غير مطابقة للمجموعة"],
      duplicate_schedule:[409,"توجد مواعيد مكررة"],
    };
    const [status,message]=codes[row?.error_code??""]??[503,"تعذّر اعتماد الاشتراك"];
    return NextResponse.json({error:message},{status});
  }
  return NextResponse.json({
    ok:true,alreadyActive:row.already_active,freePilot:true,
    sessionsCreated:row.sessions_created,
  },{headers:{"Cache-Control":"no-store"}});
}
