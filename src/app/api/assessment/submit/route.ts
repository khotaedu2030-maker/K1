import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  calculateIndependenceScore,
  validateIndependenceInputs,
  isValidLevelOrNull,
  isValidAssessmentType,
} from "@/lib/independence";

// يكتب تقييمًا تأسيسيًا/دوريًا كاملًا (أكاديمي + استقلالية + نقطة تتبع تقدّم) كـ معاملة واحدة ذرّية
// عبر public.submit_assessment() — إمّا تنجح الكتابات الثلاث معًا أو لا يُكتب شيء إطلاقًا.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const {
    childId,
    assessmentType,
    readingLevel,
    writingSpellingLevel,
    mathematicsLevel,
    englishLevel,
    focusLevel,
    independenceLevel,
    teacherNotes,
    independence, // { task_management, task_initiation, help_seeking, task_completion, time_organization }
  } = body ?? {};

  // ---------- Input validation صارم (لا نعتمد على DB CHECK وحدها) ----------
  if (typeof childId !== "string" || !childId) {
    return NextResponse.json({ error: "childId مطلوب" }, { status: 400 });
  }
  if (!isValidAssessmentType(assessmentType)) {
    return NextResponse.json({ error: "assessmentType غير صالح" }, { status: 400 });
  }
  for (const [name, value] of Object.entries({
    readingLevel,
    writingSpellingLevel,
    mathematicsLevel,
    englishLevel,
    focusLevel,
    independenceLevel,
  })) {
    if (!isValidLevelOrNull(value)) {
      return NextResponse.json({ error: `قيمة غير صالحة لـ ${name}` }, { status: 400 });
    }
  }

  let independenceTotal: number | null = null;
  if (independence !== undefined && independence !== null) {
    const invalid = validateIndependenceInputs(independence);
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 });
    }
    independenceTotal = calculateIndependenceScore(independence);
  }

  // ---------- التحقق من الهوية والصلاحية ----------
  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const admin = createSupabaseAdminClient();

  const { data: teacher } = await admin.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
  if (!teacher) return NextResponse.json({ error: "هذا الحساب ليس حساب معلم" }, { status: 403 });

  const { data: link } = await admin
    .from("subscriptions")
    .select("child_id, cohorts(teacher_id)")
    .eq("child_id", childId)
    .eq("status", "active");
  const belongsToTeacher = (link ?? []).some((l: any) => l.cohorts?.teacher_id === teacher.id);
  if (!belongsToTeacher) {
    return NextResponse.json({ error: "هذا الطالب ليس ضمن مجموعاتك" }, { status: 403 });
  }

  // ---------- الكتابة كمعاملة ذرّية واحدة ----------
  const { data: assessmentId, error } = await admin.rpc("submit_assessment", {
    p_child_id: childId,
    p_teacher_id: teacher.id,
    p_assessment_type: assessmentType,
    p_reading_level: readingLevel ?? null,
    p_writing_spelling_level: writingSpellingLevel ?? null,
    p_mathematics_level: mathematicsLevel ?? null,
    p_english_level: englishLevel ?? null,
    p_focus_level: focusLevel ?? null,
    p_independence_level: independenceLevel ?? null,
    p_teacher_notes: teacherNotes ?? null,
    p_task_management: independence?.task_management ?? null,
    p_task_initiation: independence?.task_initiation ?? null,
    p_help_seeking: independence?.help_seeking ?? null,
    p_task_completion: independence?.task_completion ?? null,
    p_time_organization: independence?.time_organization ?? null,
    p_independence_total: independenceTotal,
  });

  if (error) {
    // فشل أي جزء من المعاملة الثلاثية يعني ROLLBACK تلقائي كامل داخل الدالة — لا كتابات جزئية.
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, assessmentId, independenceTotal });
}
