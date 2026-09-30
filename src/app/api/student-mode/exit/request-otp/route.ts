import { NextResponse } from "next/server";
import { getActiveStudentSession } from "@/lib/student-mode";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitRejectionResponse } from "@/lib/api-rate-limit";

// خطوة إعادة المصادقة قبل الخروج من مساحة الطالب: لا نسمح بالعودة لولي الأمر بضغطة واحدة.
// نرسل رمز OTP إلى البريد الإلكتروني المسجَّل لولي الأمر (Email OTP، يطابق /login الآن)،
// عبر نفس آلية Supabase Auth OTP — لا نخترع مصادقة جديدة، ولا نثق ببريد يدخله المستخدم الحالي.
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  return `${local[0] ?? "•"}***@${domain}`;
}

export async function POST(req: Request) {
  const session = await getActiveStudentSession();
  if (!session) return NextResponse.json({ error: "لا توجد جلسة طالب نشطة" }, { status: 401 });

  const sessionLimit = await checkRateLimit({
    request: req,
    scope: "student-exit-otp:request:session",
    identifier: session.sessionId,
    limit: 3,
    windowSeconds: 900,
  });
  const sessionRejection = rateLimitRejectionResponse(sessionLimit);
  if (sessionRejection) return sessionRejection;

  const admin = createSupabaseAdminClient();
  const { data: child } = await admin.from("children").select("parent_id").eq("id", session.childId).maybeSingle();
  const { data: parent } = child
    ? await admin.from("parents").select("email").eq("id", child.parent_id).maybeSingle()
    : { data: null };

  if (!parent?.email) return NextResponse.json({ error: "لا يوجد بريد إلكتروني مسجَّل لهذا الحساب" }, { status: 500 });

  const emailLimit = await checkRateLimit({
    request: req,
    scope: "student-exit-otp:request:email",
    identifier: parent.email,
    limit: 5,
    windowSeconds: 86400,
  });
  const emailRejection = rateLimitRejectionResponse(emailLimit);
  if (emailRejection) return emailRejection;

  // shouldCreateUser: false — هذا المسار يُستخدَم فقط للتحقق من هوية ولي أمر معروف مسبقًا
  // (لديه صف parent مرتبط بطفل بجلسة طالب نشطة فعليًا) — لا يجوز أن يُنشئ حساب Auth جديدًا
  // بالخطأ لبريد Legacy لم يسجّل دخول عبر OTP من قبل إطلاقًا.
  const { error } = await admin.auth.signInWithOtp({ email: parent.email, options: { shouldCreateUser: false } });
  if (error) {
    console.error("[student-mode] exit OTP request failed:", error.message);
    return NextResponse.json({ error: "تعذّر إرسال رمز التحقق" }, { status: 500 });
  }

  // لا نُرجع البريد الكامل للعميل إطلاقًا — الإخفاء الجزئي فقط للعرض.
  return NextResponse.json({ ok: true, maskedEmail: maskEmail(parent.email) });
}
