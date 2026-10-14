import { NextResponse } from "next/server";
import { getActiveStudentSession } from "@/lib/student-mode";
import { STUDENT_SESSION_COOKIE } from "@/lib/student-mode-constants";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { checkRateLimit, declaredBodyExceeds, rateLimitRejectionResponse, readJsonBodyLimited } from "@/lib/api-rate-limit";

// يتحقق من رمز OTP المُرسَل للبريد الإلكتروني، وعند صحته يُنهي جلسة الطالب فعليًا (لا مجرد
// إخفاء بصري) ويمسح الكوكي. العميل يرسل "code" فقط — لا نثق بأي "email" قادم من الطلب؛
// نعيد اشتقاق بريد ولي الأمر من جلسة الطالب النشطة نفسها، بنفس مسار request-otp تمامًا.
export async function POST(req: Request) {
  const session = await getActiveStudentSession();
  if (!session) return NextResponse.json({ error: "لا توجد جلسة طالب نشطة" }, { status: 401 });

  if (declaredBodyExceeds(req, 4 * 1024)) {
    return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  }

  const parsed = await readJsonBodyLimited(req, 4 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const body = parsed.body;
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!/^\d{6,8}$/.test(code)) return NextResponse.json({ error: "الرمز مطلوب أو غير صالح" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: child, error: childError } = await admin.from("children").select("parent_id").eq("id", session.childId).maybeSingle();
  if (childError) return NextResponse.json({ error: "تعذّر التحقق من حساب الطالب" }, { status: 503 });
  const { data: parent, error: parentError } = child
    ? await admin.from("parents").select("email").eq("id", child.parent_id).maybeSingle()
    : { data: null, error: null };
  if (parentError) return NextResponse.json({ error: "تعذّر التحقق من حساب ولي الأمر" }, { status: 503 });

  if (!parent?.email) return NextResponse.json({ error: "لا يوجد بريد إلكتروني مسجَّل لهذا الحساب" }, { status: 500 });

  const sessionLimit = await checkRateLimit({
    request: req,
    scope: "student-exit-otp:verify:session",
    identifier: session.sessionId,
    limit: 5,
    windowSeconds: 600,
  });
  const sessionRejection = rateLimitRejectionResponse(sessionLimit);
  if (sessionRejection) return sessionRejection;

  const emailLimit = await checkRateLimit({
    request: req,
    scope: "student-exit-otp:verify:email",
    identifier: parent.email,
    limit: 10,
    windowSeconds: 600,
  });
  const emailRejection = rateLimitRejectionResponse(emailLimit);
  if (emailRejection) return emailRejection;

  const { error } = await admin.auth.verifyOtp({ email: parent.email, token: code, type: "email" });
  if (error) {
    if (error.status !== 400 && error.status !== 401) {
      console.error("[student-mode] exit OTP verification failed:", error.message);
      return NextResponse.json({ error: "تعذّر التحقق من الرمز الآن" }, { status: 503 });
    }
    return NextResponse.json({ error: "رمز غير صحيح" }, { status: 401 });
  }

  const { data: deactivated, error: deactivateError } = await admin
    .from("student_mode_sessions")
    .update({ active: false })
    .eq("id", session.sessionId)
    .eq("active", true)
    .select("id")
    .maybeSingle();
  if (deactivateError) {
    console.error("[student-mode] exit deactivation failed:", deactivateError.message);
    return NextResponse.json({ error: "تعذّر إنهاء جلسة الطالب" }, { status: 503 });
  }
  if (!deactivated) {
    return NextResponse.json({ error: "جلسة الطالب تغيّرت بالفعل" }, { status: 409 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(STUDENT_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
