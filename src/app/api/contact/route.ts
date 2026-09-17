import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// الحفظ في Supabase هو مصدر الحقيقة — نجاح الطلب لا يعتمد على أي خدمة بريد خارجية إطلاقًا.
// إشعار بريد اختياري (Resend) يُحاوَل بعد نجاح الحفظ فقط، وفشله لا يُفشِل الاستجابة للمستخدم.
const NOTIFY_RECIPIENTS = ["khota.edu2030@gmail.com", "abdullahalmou@hotmail.com"];

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!fullName || !email || !message) {
    return NextResponse.json({ error: "الاسم والبريد والرسالة مطلوبة" }, { status: 400 });
  }
  if (!email.includes("@")) {
    return NextResponse.json({ error: "البريد الإلكتروني غير صحيح" }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "الرسالة طويلة جدًا" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("contact_requests").insert({
    full_name: fullName,
    email,
    phone: phone || null,
    message,
  });

  if (error) {
    console.error("[contact] فشل حفظ الرسالة:", error.message);
    return NextResponse.json({ error: "تعذّر إرسال الرسالة، حاول مرة أخرى" }, { status: 500 });
  }

  // إشعار بريد اختياري بعد نجاح الحفظ — best-effort تمامًا، لا يؤثر على استجابة النجاح للمستخدم
  // مهما حدث (مفتاح ناقص، فشل شبكة، أي خطأ) لأن الحفظ الفعلي في Supabase تم بالفعل بنجاح.
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const fromEmail = process.env.CONTACT_FROM_EMAIL || "خُطى | KHOTA <onboarding@resend.dev>";
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          to: NOTIFY_RECIPIENTS,
          subject: `رسالة تواصل جديدة من ${fullName} — موقع خُطى`,
          text: [`الاسم: ${fullName}`, `البريد: ${email}`, phone ? `الجوال: ${phone}` : null, "", "الرسالة:", message]
            .filter((line) => line !== null)
            .join("\n"),
        }),
      });
    } catch (err) {
      console.error("[contact] فشل إشعار البريد الاختياري (الرسالة محفوظة فعليًا بقاعدة البيانات):", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ ok: true });
}
