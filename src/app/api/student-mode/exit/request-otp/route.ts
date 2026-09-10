import { NextResponse } from "next/server";
import { getActiveStudentSession } from "@/lib/student-mode";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// خطوة إعادة المصادقة قبل الخروج من مساحة الطالب: لا نسمح بالعودة لولي الأمر بضغطة واحدة.
// نرسل رمز OTP إلى رقم جوال ولي الأمر المسجَّل (وليس رقمًا يدخله المستخدم الحالي)، عبر نفس
// آلية Supabase Auth OTP المستخدمة في /login — لا نخترع مصادقة جديدة.
export async function POST() {
  const session = await getActiveStudentSession();
  if (!session) return NextResponse.json({ error: "لا توجد جلسة طالب نشطة" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: child } = await admin.from("children").select("parent_id").eq("id", session.childId).maybeSingle();
  const { data: parent } = child
    ? await admin.from("parents").select("phone").eq("id", child.parent_id).maybeSingle()
    : { data: null };

  if (!parent?.phone) return NextResponse.json({ error: "لا يوجد رقم جوال مسجَّل" }, { status: 500 });

  const { error } = await admin.auth.signInWithOtp({ phone: parent.phone });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // لا نُرجع رقم الجوال الكامل للعميل إطلاقًا — الإخفاء الجزئي فقط للعرض.
  const masked = parent.phone.slice(0, -4).replace(/./g, "•") + parent.phone.slice(-4);
  return NextResponse.json({ ok: true, maskedPhone: masked });
}
