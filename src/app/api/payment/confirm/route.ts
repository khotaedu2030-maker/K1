import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isPilotAuthEnabled } from "@/lib/pilot-auth";

// ⚠️ نقطة تكامل الدفع الحقيقي — لم تُربط بمزوّد دفع فعلي بعد (Moyasar/Tap/HyperPay/...).
// في الإنتاج: هذا المسار يجب أن يُستدعى من Webhook موقّع من المزوّد (وليس مباشرة من المتصفح كما هنا)،
// بالتدفق التالي فقط:
//   verify signature → verify transaction → verify amount → mark payment paid
//   → activate subscription → create sessions
// النسخة الحالية "تأكيد يدوي Dev-only" لأغراض العرض فقط — ولهذا محجوبة صراحة في production أدناه.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "هذا المسار Dev-only ولا يعمل في الإنتاج. يتطلب ربط Webhook موقّع من مزوّد دفع حقيقي." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const { subscriptionId } = body ?? {};

  if (!subscriptionId) {
    return NextResponse.json({ error: "subscriptionId مطلوب" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: subscription, error: subFetchError } = await supabase
    .from("subscriptions")
    .select("id, parent_id, plan_id, cohort_id, status")
    .eq("id", subscriptionId)
    .single();

  if (subFetchError || !subscription) {
    return NextResponse.json({ error: "اشتراك غير موجود" }, { status: 404 });
  }

  if (subscription.status === "active") {
    // تأكيد سابق بالفعل — لا نكرر توليد الجلسات (idempotency)
    return NextResponse.json({ ok: true, alreadyActive: true });
  }

  const { data: plan } = await supabase
    .from("plans")
    .select("price_sar, days_per_week")
    .eq("id", subscription.plan_id)
    .single();

  if (!subscription.cohort_id) {
    return NextResponse.json({ error: "لا توجد مجموعة مرتبطة بهذا الاشتراك" }, { status: 400 });
  }

  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id, teacher_id, capacity, days_of_week, start_time, end_time, meeting_url")
    .eq("id", subscription.cohort_id)
    .single();

  if (!cohort) {
    return NextResponse.json({ error: "المجموعة غير موجودة" }, { status: 400 });
  }

  // P0: توليد الجلسات يعتمد بالكامل على cohort.days_of_week — يجب أن يطابق دائمًا أيام باقة
  // هذا الاشتراك تحديدًا قبل توليد أي جلسة، وإلا سيرى ولي الأمر أيامًا لا تخص خطته الفعلية.
  // قيد enforce_cohort_days_match_plan في قاعدة البيانات يمنع هذا أصلًا عند إنشاء/تعديل أي
  // مجموعة، لكن هذا الفحص هنا هو خط دفاع أخير قبل توليد جلسات فعلية — فشل واضح بدل تجاهل صامت.
  const cohortDaysCount = (cohort.days_of_week as number[] | null)?.length ?? 0;
  if (plan?.days_per_week != null && cohortDaysCount !== plan.days_per_week) {
    return NextResponse.json(
      { error: "تعارض بيانات داخلي بين المجموعة وباقتها — لم يُفعَّل الاشتراك حتى تتم المراجعة." },
      { status: 500 }
    );
  }

  // إعادة تحقق أخيرة من المقعد قبل التفعيل النهائي (قد يكون مضى وقت منذ خطوة enroll)
  const { data: seatsAvailable } = await supabase.rpc("cohort_available_seats", {
    p_cohort_id: cohort.id,
  });
  if ((seatsAvailable ?? 0) < 0) {
    return NextResponse.json({ error: "اكتمل عدد المقاعد في هذه المجموعة أثناء إتمام الدفع" }, { status: 409 });
  }

  // 1) تسجيل الدفعة
  const { error: paymentError } = await supabase.from("payments").insert({
    subscription_id: subscription.id,
    parent_id: subscription.parent_id,
    amount_sar: plan?.price_sar ?? 0,
    status: "paid",
    provider: "manual-dev", // TODO: استبدلها باسم المزوّد الفعلي عند الربط (Moyasar/Tap/HyperPay...)
    paid_at: new Date().toISOString(),
  });
  if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 });

  // 2) تفعيل الاشتراك بتواريخ محسوبة (شهر اشتراك من اليوم)
  const startDate = new Date();
  const renewalDate = new Date(startDate);
  renewalDate.setMonth(renewalDate.getMonth() + 1);

  const { error: activateError } = await supabase
    .from("subscriptions")
    .update({
      status: "active",
      start_date: startDate.toISOString().slice(0, 10),
      renewal_date: renewalDate.toISOString().slice(0, 10),
    })
    .eq("id", subscription.id);
  if (activateError) return NextResponse.json({ error: activateError.message }, { status: 500 });

  // 3) توليد جلسات الشهر الأول: كل يوم من days_of_week للمجموعة، حتى تاريخ التجديد.
  // الجلسة تخص المجموعة (Cohort) نفسها وليس طفلًا بعينه — كل أطفال المجموعة يحضرون نفس الجلسات،
  // وحضور كل طفل يُسجَّل لاحقًا بشكل منفصل في جدول attendance عند دخوله الفعلي.
  const sessionsToInsert: {
    cohort_id: string;
    teacher_id: string | null;
    session_date: string;
    starts_at: string;
    ends_at: string;
    meeting_url: string | null;
    status: string;
  }[] = [];

  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  const endWindow = new Date(renewalDate);

  const [startH, startM] = String(cohort.start_time).slice(0, 5).split(":").map(Number);
  const [endH, endM] = String(cohort.end_time).slice(0, 5).split(":").map(Number);

  while (cursor <= endWindow) {
    if ((cohort.days_of_week as number[]).includes(cursor.getDay())) {
      const starts = new Date(cursor);
      starts.setHours(startH, startM, 0, 0);
      const ends = new Date(cursor);
      ends.setHours(endH, endM, 0, 0);

      sessionsToInsert.push({
        cohort_id: cohort.id,
        teacher_id: cohort.teacher_id,
        session_date: cursor.toISOString().slice(0, 10),
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        meeting_url: cohort.meeting_url,
        status: "scheduled",
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (sessionsToInsert.length > 0) {
    // upsert مع ignoreDuplicates بدل insert صريح: لو كانت مجموعة أخرى بنفس cohort_id فعَّلت
    // اشتراكًا آخر وولَّدت جلسات هذا الشهر مسبقًا، هذا الاستدعاء يتجاهل ما هو موجود فعليًا بدل
    // تكراره أو الفشل بخطأ قيد UNIQUE — هذا هو الإصلاح الفعلي لمنبع تكرار الجلسات.
    const { error: sessionsError } = await supabase
      .from("sessions")
      .upsert(sessionsToInsert, { onConflict: "cohort_id,starts_at", ignoreDuplicates: true });
    if (sessionsError) return NextResponse.json({ error: sessionsError.message }, { status: 500 });
  }

  // كوكي اختيارية: تربط جلسة Pilot اللاحقة بهذا الاشتراك تحديدًا بدل الرجوع إلى "أحدث ولي أمر
  // ضيف" العام — أدق وأضيق نطاقًا. لا قيمة حساسة (معرّف اشتراك فقط). نستخدم isPilotAuthEnabled()
  // بدل مقارنة NODE_ENV هنا: الحارس أعلى الدالة يمنع production فعليًا بالفعل (return مبكر)،
  // فمقارنة NODE_ENV مرة أخرى هنا زائدة (ومرفوضة من TypeScript: TS2367 — النوع مُضيَّق مسبقًا
  // ليستبعد "production" أصلًا) — الشرط الصحيح دلاليًا هو: هل Pilot Auth مفعَّلة فعلًا؟
  const res = NextResponse.json({ ok: true, sessionsCreated: sessionsToInsert.length });
  if (isPilotAuthEnabled()) {
    res.cookies.set("khota_pilot_last_subscription", subscription.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 30, // 30 دقيقة — نافذة كافية لإكمال رحلة الدفع ثم الدخول التجريبي مباشرة
    });
  }
  return res;
}