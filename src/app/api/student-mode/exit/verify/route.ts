import { NextResponse } from "next/server";
import { getActiveStudentSession } from "@/lib/student-mode";
import { STUDENT_SESSION_COOKIE } from "@/lib/student-mode-constants";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// يتحقق من رمز OTP المُرسَل للبريد الإلكتروني، وعند صحته يُنهي جلسة الطالب فعليًا (لا مجرد
// إخفاء بصري) ويمسح الكوكي. العميل يرسل "code" فقط — لا نثق بأي "email" قادم من الطلب؛
// نعيد اشتقاق بريد ولي الأمر من جلسة الطالب النشطة نفسها، بنفس مسار request-otp تمامًا.
export async function POST(req: Request) {
  const session = await getActiveStudentSession();
  if (!session) return NextResponse.json({ error: "لا توجد جلسة طالب نشطة" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const code = body?.code as string | undefined;
  if (!code) return NextResponse.json({ error: "الرمز مطلوب" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: child } = await admin.from("children").select("parent_id").eq("id", session.childId).maybeSingle();
  const { data: parent } = child
    ? await admin.from("parents").select("email").eq("id", child.parent_id).maybeSingle()
    : { data: null };

  if (!parent?.email) return NextResponse.json({ error: "لا يوجد بريد إلكتروني مسجَّل لهذا الحساب" }, { status: 500 });

  const { error } = await admin.auth.verifyOtp({ email: parent.email, token: code, type: "email" });
  if (error) return NextResponse.json({ error: "رمز غير صحيح" }, { status: 401 });

  await admin.from("student_mode_sessions").update({ active: false }).eq("id", session.sessionId);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(STUDENT_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
