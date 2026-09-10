import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// تحديث الحد الأدنى التشغيلي لمجموعة: رابط الجلسة (meeting_url) وإسناد المعلم (teacher_id) —
// الحقول الوحيدة التي كانت تتطلب فتح Supabase يدويًا لكل مجموعة جديدة. تحقق صريح من صلاحية
// Admin على الخادم قبل أي كتابة — لا اعتماد على إخفاء الرابط في الواجهة.
export async function POST(req: Request) {
  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: adminRow } = await admin.from("admins").select("id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) return NextResponse.json({ error: "هذا الحساب ليس حساب إدارة" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const cohortId = body?.cohortId as string | undefined;
  const meetingUrlRaw = body?.meetingUrl as string | undefined;
  const teacherIdRaw = body?.teacherId as string | undefined;

  if (!cohortId) return NextResponse.json({ error: "cohortId مطلوب" }, { status: 400 });

  const meetingUrl = meetingUrlRaw?.trim() || null;
  if (meetingUrl) {
    try {
      new URL(meetingUrl);
    } catch {
      return NextResponse.json({ error: "رابط الجلسة غير صالح" }, { status: 400 });
    }
  }

  const teacherId = teacherIdRaw?.trim() || null;
  if (teacherId) {
    const { data: teacher } = await admin.from("teachers").select("id").eq("id", teacherId).maybeSingle();
    if (!teacher) return NextResponse.json({ error: "معلم غير موجود" }, { status: 400 });
  }

  const { error } = await admin
    .from("cohorts")
    .update({ meeting_url: meetingUrl, teacher_id: teacherId })
    .eq("id", cohortId);

  if (error) return NextResponse.json({ error: "تعذّر حفظ التعديل" }, { status: 500 });

  // الجلسات تحتفظ بنسخة من meeting_url وقت توليدها (وقت تأكيد الدفع) — لو كانت المجموعة بلا
  // رابط وقتها ثم أضافه الأدمن الآن، الجلسات المستقبلية المجدولة فعلًا يجب تحديثها أيضًا،
  // وإلا يبقى ولي الأمر بلا رابط رغم إضافته هنا. لا نلمس الجلسات الماضية أو المكتملة.
  if (meetingUrl) {
    await admin
      .from("sessions")
      .update({ meeting_url: meetingUrl })
      .eq("cohort_id", cohortId)
      .eq("status", "scheduled")
      .gte("starts_at", new Date().toISOString());
  }

  return NextResponse.json({ ok: true });
}
