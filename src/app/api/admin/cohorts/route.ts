import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getRiyadhDayOfWeek, getRiyadhMinutesSinceMidnight } from "@/lib/riyadh-time";
import { getRuntimeSettings } from "@/lib/platform-settings";
import { resolveGradeBand } from "@/lib/grade-config";

export async function POST(req: Request) {
  const adminCheck = await requirePermission("cohort.manage");
  if (!adminCheck.ok) return adminCheck.response;

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const grade = Number(body?.grade);
  const planId = typeof body?.planId === "string" ? body.planId.trim() : "";
  const teacherId = typeof body?.teacherId === "string" ? body.teacherId.trim() : "";
  const settings = await getRuntimeSettings();
  const requestedCapacity = body?.capacity;
  const defaultCapacityByGrade = grade >= 1 && grade <= 3
    ? settings.defaultCapacity1_3
    : grade >= 4 && grade <= 6
      ? settings.defaultCapacity4_6
      : grade >= 7 && grade <= 9
        ? settings.defaultCapacity7_9
        : settings.defaultCapacity10_12;
  const capacity = requestedCapacity === undefined ? defaultCapacityByGrade : Number(requestedCapacity);
  const daysOfWeek = Array.isArray(body?.daysOfWeek) ? body.daysOfWeek.map((d: unknown) => Number(d)) : [];
  const startTime = typeof body?.startTime === "string" ? body.startTime : "";
  const endTime = typeof body?.endTime === "string" ? body.endTime : "";
  const meetingUrl = typeof body?.meetingUrl === "string" ? body.meetingUrl.trim() : "";
  const status = body?.status === "closed" ? "closed" : "open";

  if (!title) return NextResponse.json({ error: "اسم المجموعة مطلوب" }, { status: 400 });
  let gradeBand: string;
  try {
    gradeBand = resolveGradeBand(grade);
  } catch {
    return NextResponse.json({ error: "الصف يجب أن يكون بين 1 و12" }, { status: 400 });
  }
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) {
    return NextResponse.json({ error: "السعة يجب أن تكون رقمًا صحيحًا بين 1 و20" }, { status: 400 });
  }
  if (daysOfWeek.length === 0 || daysOfWeek.some((d: number) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return NextResponse.json({ error: "أيام الأسبوع غير صالحة" }, { status: 400 });
  }
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return NextResponse.json({ error: "وقت البداية/النهاية غير صالح" }, { status: 400 });
  }
  if (!planId) return NextResponse.json({ error: "الباقة مطلوبة" }, { status: 400 });

  const admin = createSupabaseAdminClient();

  // الباقة يجب أن تكون فعّالة، من نفس المنتج (motabaa)، وعدد أيامها يطابق أيام المجموعة
  // المُدخَلة بالضبط — قيد قاعدة البيانات (enforce_cohort_days_match_plan) يرفض غير ذلك
  // برسالة خام؛ نتحقق هنا أولًا لرسالة عربية واضحة بدل خطأ Trigger خام.
  const { data: plan } = await admin.from("plans").select("id, product, active, days_per_week").eq("id", planId).maybeSingle();
  if (!plan || !plan.active || plan.product !== "motabaa") {
    return NextResponse.json({ error: "باقة غير صالحة" }, { status: 400 });
  }
  if (plan.days_per_week != null && plan.days_per_week !== daysOfWeek.length) {
    return NextResponse.json({ error: `هذه الباقة تتطلب ${plan.days_per_week} أيام بالضبط` }, { status: 400 });
  }

  const { data: existingTitle } = await admin.from("cohorts").select("id").eq("title", title).maybeSingle();
  if (existingTitle) return NextResponse.json({ error: "يوجد بالفعل مجموعة بنفس الاسم" }, { status: 409 });

  let teacherIdFinal: string | null = null;
  if (teacherId) {
    const { data: teacher } = await admin.from("teachers").select("id").eq("id", teacherId).eq("active", true).maybeSingle();
    if (!teacher) return NextResponse.json({ error: "معلم غير موجود أو غير نشط" }, { status: 400 });

    // فحص تعارض المعلم — نفس منطق التحقق بمعلم الجلسة البديل (بيانات جلسات فعلية موثوقة)،
    // مُطبَّق هنا وقائيًا على أي جلسات مستقبلية قد تتداخل زمنيًا مع أيام/وقت المجموعة الجديدة.
    const { data: teacherSessions } = await admin
      .from("sessions")
      .select("starts_at, ends_at")
      .eq("teacher_id", teacherId)
      .eq("status", "scheduled")
      .gte("session_date", new Date().toISOString().slice(0, 10));
    const [newStartH, newStartM] = startTime.split(":").map(Number);
    const [newEndH, newEndM] = endTime.split(":").map(Number);
    const hasConflict = (teacherSessions ?? []).some((s: { starts_at: string | null; ends_at: string | null }) => {
      if (!s.starts_at || !s.ends_at) return false;
      const sStart = new Date(s.starts_at);
      const sEnd = new Date(s.ends_at);
      // آمن زمنيًا: نستخرج اليوم/الدقائق بتوقيت الرياض الصريح، لا المنطقة الزمنية المحلية
      // لبيئة التشغيل (عادة UTC على Vercel) — استخدام getDay()/getHours() مباشرة هنا كان
      // يُنتج فروقًا خاطئة بمقدار +3 ساعات (وأحيانًا يومًا خاطئًا قرب منتصف الليل)، ما قد يُخفي
      // تعارضًا حقيقيًا بدل رفضه.
      if (!daysOfWeek.includes(getRiyadhDayOfWeek(sStart))) return false;
      const sStartMin = getRiyadhMinutesSinceMidnight(sStart);
      const sEndMin = getRiyadhMinutesSinceMidnight(sEnd);
      const newStartMin = newStartH * 60 + newStartM;
      const newEndMin = newEndH * 60 + newEndM;
      return newStartMin < sEndMin && newEndMin > sStartMin;
    });
    if (hasConflict) {
      return NextResponse.json({ error: "هذا المعلم لديه جلسات أخرى قد تتعارض مع هذا الموعد" }, { status: 409 });
    }
    teacherIdFinal = teacherId;
  }

  const { data: created, error } = await admin
    .from("cohorts")
    .insert({
      product: "motabaa",
      plan_id: planId,
      title,
      grade,
      grade_band: gradeBand,
      teacher_id: teacherIdFinal,
      capacity,
      days_of_week: daysOfWeek,
      start_time: startTime,
      end_time: endTime,
      meeting_url: meetingUrl || null,
      status,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[admin-cohorts] فشل إنشاء مجموعة:", error.message);
    return NextResponse.json({ error: "تعذّر إنشاء المجموعة" }, { status: 500 });
  }

  const { error: auditError } = await admin.from("admin_actions").insert({
    admin_user_id: adminCheck.userId,
    action: "cohort_create",
    entity_type: "cohort",
    entity_id: created.id,
    new_value: { title, grade, capacity, teacher_id: teacherIdFinal },
  });
  if (auditError) console.error("[admin-cohorts] فشل تسجيل admin_actions (غير حاجب):", auditError.message);

  return NextResponse.json({ ok: true, id: created.id });
}
