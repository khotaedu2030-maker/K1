import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  riyadhWallClockToUtcInstant,
  getRiyadhCalendarDate,
  addRiyadhCalendarMonths,
  addRiyadhCalendarDays,
  compareRiyadhCalendarDates,
  formatRiyadhCalendarDate,
  getRiyadhWeekdayFromCalendarDate,
} from "@/lib/riyadh-time";

// منطق تفعيل الاشتراك بعد دفع مؤكَّد — مشترك بين Webhook/Callback الدفع الحقيقي (Paylink)
// ومسار "تأكيد يدوي" Dev-only. آلة حالة صريحة على subscription.status:
//   pending_payment → active : يُكمِل التفعيل idempotently (retry-safe).
//   active بالفعل            : يتأكد أن سجل الدفع المرتبط مسجَّل paid فعليًا، يُصلحه إن لزم،
//                               ثم يُعيد alreadyActive بلا أي تكرار.
//   paused/cancelled/expired  : يُرفَض صراحةً — لا يُعاد تفعيله عبر هذا المسار إطلاقًا.
//
// مسار manual-dev (بلا paymentId) ينفّذ تحديث الاشتراك وإدخال الدفعة عبر معاملة Postgres ذرّية
// واحدة (public.activate_subscription_manual_atomic) بدل عمليتين منفصلتين — يمنع هذا بنيويًا
// احتمال "نجح تفعيل الاشتراك ثم فشل إدخال الدفعة" (لا طريقة سابقة لإصلاح ذلك تلقائيًا لهذا
// المسار تحديدًا، إذ لا paymentId معروفًا يُصالَح به كما في مسار Paylink). مسار Paylink
// (paymentId موجود) لم يتغيّر وظيفيًا إطلاقًا.

export type ActivationResult =
  | { ok: true; alreadyActive: true }
  | { ok: true; alreadyActive: false; sessionsCreated: number }
  | { ok: false; status: number; error: string };

type SessionInsertRow = {
  cohort_id: string;
  teacher_id: string | null;
  session_date: string;
  starts_at: string;
  ends_at: string;
  meeting_url: string | null;
  status: string;
};

type SessionPrepResult =
  | { ok: true; sessionsToInsert: SessionInsertRow[]; startDate: string; renewalDate: string }
  | { ok: false; status: number; error: string };

// يُولِّد جلسات الشهر الأول (idempotent عبر upsert + ignoreDuplicates) ويُعيد تواريخ البداية
// والتجديد المحسوبة بتقويم الرياض. استُخرِجت من المنطق المشترك بين Paylink وmanual-dev بلا أي
// تغيير في الخطوات أو الترتيب أو شروط الرفض — استخراج بحت، لا تعديل سلوك.
async function prepareSessionsForActivation(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  subscription: { id: string; plan_id: string; cohort_id: string | null }
): Promise<SessionPrepResult> {
  const { data: plan, error: planFetchError } = await supabase
    .from("plans")
    .select("price_sar, days_per_week")
    .eq("id", subscription.plan_id)
    .single();

  if (planFetchError) {
    // مهم بشكل خاص هنا: فشل صامت بهذا الاستعلام كان سيُسقِط لاحقًا فحص تطابق أيام المجموعة مع
    // الخطة (لأن plan?.days_per_week تصبح undefined، فيتخطّى الشرط الفحص كليًا بصمت) — خطأ
    // استعلام حقيقي يجب أن يُوقِف التنفيذ بوضوح، لا أن يُعطِّل تحققًا أمنيًا بصمت.
    console.error(`[activate] خطأ استعلام مؤقت أثناء جلب الخطة ${subscription.plan_id}:`, planFetchError.message);
    return { ok: false, status: 503, error: "خطأ مؤقت، يُعاد المحاولة تلقائيًا" };
  }

  if (!subscription.cohort_id) {
    return { ok: false, status: 400, error: "لا توجد مجموعة مرتبطة بهذا الاشتراك" };
  }

  const { data: cohort, error: cohortFetchError } = await supabase
    .from("cohorts")
    .select("id, teacher_id, capacity, days_of_week, start_time, end_time, meeting_url")
    .eq("id", subscription.cohort_id)
    .single();

  if (cohortFetchError && cohortFetchError.code !== "PGRST116") {
    console.error(`[activate] خطأ استعلام مؤقت أثناء جلب المجموعة ${subscription.cohort_id}:`, cohortFetchError.message);
    return { ok: false, status: 503, error: "خطأ مؤقت، يُعاد المحاولة تلقائيًا" };
  }
  if (!cohort) {
    return { ok: false, status: 400, error: "المجموعة غير موجودة" };
  }

  const cohortDaysCount = (cohort.days_of_week as number[] | null)?.length ?? 0;
  if (plan?.days_per_week != null && cohortDaysCount !== plan.days_per_week) {
    return { ok: false, status: 500, error: "تعارض بيانات داخلي بين المجموعة وباقتها — لم يُفعَّل الاشتراك حتى تتم المراجعة." };
  }

  const { data: seatsAvailable, error: seatsError } = await supabase.rpc("cohort_available_seats", {
    p_cohort_id: cohort.id,
  });
  if (seatsError) {
    // فشل استعلام حقيقي — لا نفترض صمتًا أن المقاعد سليمة (كانت ستُعامَل كـ0 < 0 = false،
    // فتُتابَع العملية وكأن كل شيء سليم). هذا فحص أمان لسعة المجموعة، لا نتجاوزه بصمت عند فشل
    // الاستعلام نفسه.
    console.error(`[activate] فشل استعلام cohort_available_seats للمجموعة ${cohort.id}:`, seatsError.message);
    return { ok: false, status: 503, error: "خطأ مؤقت، يُعاد المحاولة تلقائيًا" };
  }
  if ((seatsAvailable ?? 0) < 0) {
    return { ok: false, status: 409, error: "اكتمل عدد المقاعد في هذه المجموعة أثناء إتمام الدفع" };
  }

  // كل هذا القسم يعمل على تواريخ تقويمية صرفة بالرياض (RiyadhCalendarDate) فقط، لا كائنات Date
  // محلية — "اليوم" نفسه يُستخرَج بتقويم الرياض الفعلي (لا UTC الخام ولا منطقة بيئة التشغيل)،
  // والتقدُّم يومًا بيوم حساب حسابي صرف عبر Date.UTC()/getUTC*، لا setDate/getDate المحليَّين.
  // يمنع هذا أي انزياح يوم كامل قرب حدود منتصف الليل إن اختلف تقويم UTC عن الرياض.
  const startCal = getRiyadhCalendarDate(new Date());
  const renewalCal = addRiyadhCalendarMonths(startCal, 1);

  const sessionsToInsert: SessionInsertRow[] = [];

  const [startH, startM] = String(cohort.start_time).slice(0, 5).split(":").map(Number);
  const [endH, endM] = String(cohort.end_time).slice(0, 5).split(":").map(Number);

  let cursorCal = startCal;
  while (compareRiyadhCalendarDates(cursorCal, renewalCal) <= 0) {
    if ((cohort.days_of_week as number[]).includes(getRiyadhWeekdayFromCalendarDate(cursorCal))) {
      const starts = riyadhWallClockToUtcInstant(cursorCal, startH, startM);
      const ends = riyadhWallClockToUtcInstant(cursorCal, endH, endM);

      sessionsToInsert.push({
        cohort_id: cohort.id,
        teacher_id: cohort.teacher_id,
        session_date: formatRiyadhCalendarDate(cursorCal),
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        meeting_url: cohort.meeting_url,
        status: "scheduled",
      });
    }
    cursorCal = addRiyadhCalendarDays(cursorCal, 1);
  }

  if (sessionsToInsert.length > 0) {
    const { error: sessionsError } = await supabase
      .from("sessions")
      .upsert(sessionsToInsert, { onConflict: "cohort_id,starts_at", ignoreDuplicates: true });
    if (sessionsError) return { ok: false, status: 500, error: sessionsError.message };
  }

  return {
    ok: true,
    sessionsToInsert,
    startDate: formatRiyadhCalendarDate(startCal),
    renewalDate: formatRiyadhCalendarDate(renewalCal),
  };
}

export async function activateSubscriptionAfterPayment(
  subscriptionId: string,
  payment: { provider: string; providerRef?: string | null; paymentId?: string }
): Promise<ActivationResult> {
  const supabase = createSupabaseAdminClient();

  const { data: subscription, error: subFetchError } = await supabase
    .from("subscriptions")
    .select("id, parent_id, plan_id, cohort_id, status")
    .eq("id", subscriptionId)
    .single();

  if (subFetchError) {
    // single() يُرجِع خطأً أيضًا عند "لا صفوف" (PGRST116) — نميّز هذه الحالة (نهائية، 404) عن
    // أي خطأ استعلام حقيقي آخر (مؤقت، يستحق إعادة محاولة لاحقة بدل رفض نهائي بـ404 مضلِّل).
    if (subFetchError.code === "PGRST116") {
      return { ok: false, status: 404, error: "اشتراك غير موجود" };
    }
    console.error(`[activate] خطأ استعلام مؤقت أثناء جلب الاشتراك ${subscriptionId}:`, subFetchError.message);
    return { ok: false, status: 503, error: "خطأ مؤقت، يُعاد المحاولة تلقائيًا" };
  }
  if (!subscription) {
    return { ok: false, status: 404, error: "اشتراك غير موجود" };
  }

  if (["paused", "cancelled", "expired"].includes(subscription.status)) {
    console.error(`[activate] رفض — الاشتراك ${subscriptionId} بحالة "${subscription.status}"، لا يُعاد تفعيله بهذا المسار.`);
    return { ok: false, status: 409, error: "حالة الاشتراك الحالية لا تسمح بهذا الإجراء" };
  }

  // =============================== مسار Paylink (paymentId) ===============================
  // دون تغيير وظيفي عن السابق: نفس الخطوات، نفس الترتيب، نفس شروط الرفض — توليد الجلسات فقط
  // استُخرِج إلى prepareSessionsForActivation() أعلاه (استخراج بحت بلا أي تعديل منطق).
  if (payment.paymentId) {
    // مصالحة (reconciliation) لسجل الدفع — فشلها يجب أن يُبقي العملية بأكملها "غير ناجحة" (503)
    // حتى لو كان الاشتراك نفسه active فعليًا، لأن الهدف هو ضمان أن Webhook يُعيد استجابة غير-200
    // عند أي فشل مؤقت هنا، فيُعيد Paylink المحاولة لاحقًا بدل اعتبار العملية منتهية بينما سجل
    // الدفع لا يزال pending.
    async function reconcilePaymentToPaid(): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
      if (!payment.paymentId) return { ok: true };
      const { data: paymentRow, error: fetchError } = await supabase
        .from("payments")
        .select("id, status")
        .eq("id", payment.paymentId)
        .maybeSingle();
      if (fetchError) {
        console.error(`[activate] خطأ استعلام مؤقت أثناء قراءة payment ${payment.paymentId} للمصالحة:`, fetchError.message);
        return { ok: false, status: 503, error: "خطأ مؤقت، يُعاد المحاولة تلقائيًا" };
      }
      if (paymentRow && paymentRow.status !== "paid") {
        const { error } = await supabase
          .from("payments")
          .update({ status: "paid", provider_ref: payment.providerRef ?? null, paid_at: new Date().toISOString() })
          .eq("id", payment.paymentId);
        if (error) {
          console.error(`[activate] فشل تحديث payment ${payment.paymentId} إلى paid أثناء المصالحة:`, error.message);
          return { ok: false, status: 503, error: "خطأ مؤقت، يُعاد المحاولة تلقائيًا" };
        }
      }
      return { ok: true };
    }

    if (subscription.status === "active") {
      // تفعيل سابق بالفعل — لا نكرر توليد الجلسات، لكن نتأكد أن سجل الدفع نفسه مسجَّل paid
      // فعليًا (يعالج حالة: الاشتراك فُعِّل بنجاح بمحاولة سابقة، لكن تحديث payment فشل حينها).
      const reconcileResult = await reconcilePaymentToPaid();
      if (!reconcileResult.ok) return reconcileResult;
      return { ok: true, alreadyActive: true };
    }

    // من هنا: subscription.status === "pending_payment" فقط.
    const prep = await prepareSessionsForActivation(supabase, subscription);
    if (!prep.ok) return prep;

    // تفعيل الاشتراك — تحديث مشروط بـ status="pending_payment" وقت التنفيذ تحديدًا، يحمي من
    // Race Condition بين طلبَين متزامنَين (Webhook + Callback لنفس العملية) يحاولان التفعيل معًا.
    const { error: activateError } = await supabase
      .from("subscriptions")
      .update({ status: "active", start_date: prep.startDate, renewal_date: prep.renewalDate })
      .eq("id", subscription.id)
      .eq("status", "pending_payment");
    if (activateError) return { ok: false, status: 500, error: activateError.message };
    // ملاحظة: لا نتحقق من عدد الصفوف المتأثرة هنا — إن كان طلب مزامن آخر قد سبقنا بالتفعيل
    // فعليًا، فهذا التحديث لن يُغيّر شيئًا، وهذا سلوك صحيح ومقصود؛ نكمل بأمان لمصالحة سجل الدفع
    // بالأسفل بغض النظر عمَّن نجح بالتفعيل فعليًا — سلوك Paylink الأصلي، بلا أي تغيير.
    const reconcileResult = await reconcilePaymentToPaid();
    if (!reconcileResult.ok) return reconcileResult;

    return { ok: true, alreadyActive: false, sessionsCreated: prep.sessionsToInsert.length };
  }

  // =============================== مسار Dev اليدوي (manual-dev) ===============================
  // لا تحديث وإدخال منفصلَين بعد الآن — معاملة Postgres ذرّية واحدة
  // (public.activate_subscription_manual_atomic) تقفل صف الاشتراك (FOR UPDATE) وتتخذ القرار
  // الكامل (رفض/تفعيل+دفعة/already_active/تعارض) وتُنفِّذه داخل نفس الـtransaction — فإمّا تنجح
  // كل خطواتها معًا أو ROLLBACK كامل تلقائي. هذا يغلق تمامًا فجوة "نجح تحديث الاشتراك ثم فشل
  // إدخال الدفعة" التي كانت ممكنة سابقًا بين عمليتين منفصلتين على مستوى التطبيق.
  let sessionsCreatedCount = 0;
  let startDateParam: string | null = null;
  let renewalDateParam: string | null = null;

  if (subscription.status === "pending_payment") {
    // لا نُولِّد جلسات ولا تواريخ إطلاقًا إن كانت الحالة active بالفعل — الدالة الذرّية تتحقق من
    // active أولًا قبل أي استخدام لهذين البارامترين، وتتجاهلهما كليًا في تلك الحالة.
    const prep = await prepareSessionsForActivation(supabase, subscription);
    if (!prep.ok) return prep;
    sessionsCreatedCount = prep.sessionsToInsert.length;
    startDateParam = prep.startDate;
    renewalDateParam = prep.renewalDate;
  }

  const { data: rpcRows, error: rpcError } = await supabase.rpc("activate_subscription_manual_atomic", {
    p_subscription_id: subscription.id,
    p_start_date: startDateParam,
    p_renewal_date: renewalDateParam,
  });

  if (rpcError) {
    console.error(`[activate] فشل استدعاء RPC الذرّية manual-dev للاشتراك ${subscription.id}:`, rpcError.message);
    return { ok: false, status: 503, error: "خطأ مؤقت، يُعاد المحاولة تلقائيًا" };
  }

  const rpcResult = rpcRows?.[0] as
    | { ok: boolean; already_active: boolean; payment_id: string | null; error_code: string | null }
    | undefined;

  if (!rpcResult || !rpcResult.ok) {
    // لا نُبلِّغ نجاحًا زائفًا أبدًا هنا — كل فرع يُعيد فشلًا صريحًا بحالة HTTP مناسبة لسببه.
    const code = rpcResult?.error_code ?? "unknown";
    const messages: Record<string, { status: number; error: string }> = {
      subscription_not_found: { status: 404, error: "اشتراك غير موجود" },
      invalid_status: { status: 409, error: "حالة الاشتراك الحالية لا تسمح بهذا الإجراء" },
      missing_dates: { status: 500, error: "تعذّر حساب تواريخ التفعيل" },
      active_without_manual_payment: {
        status: 409,
        error: "الاشتراك مُفعَّل بالفعل عبر مسار دفع آخر (ليس manual-dev) — لا يمكن إنشاء دفعة يدوية بأثر رجعي",
      },
    };
    const mapped = messages[code];
    console.error(`[activate] RPC manual-dev رفضت العملية للاشتراك ${subscription.id}: ${code}`);
    return { ok: false, status: mapped?.status ?? 500, error: mapped?.error ?? "تعذّر تفعيل الاشتراك" };
  }

  if (rpcResult.already_active) {
    return { ok: true, alreadyActive: true };
  }

  return { ok: true, alreadyActive: false, sessionsCreated: sessionsCreatedCount };
}
