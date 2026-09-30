import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { checkRateLimit, declaredBodyExceeds, rateLimitRejectionResponse } from "@/lib/api-rate-limit";

// إدراج فقط عبر service_role — لا policy عامة على الجدول إطلاقًا. Teacher application ≠
// teacher access: هذا سجل طلب يراجعه الفريق يدويًا، لا يُنشئ أي حساب معلم تلقائيًا.
export async function POST(req: Request) {
  if (declaredBodyExceeds(req, 16 * 1024)) {
    return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  }

  const ipLimit = await checkRateLimit({ request: req, scope: "teacher-application:ip", limit: 3, windowSeconds: 3600 });
  const ipRejection = rateLimitRejectionResponse(ipLimit);
  if (ipRejection) return ipRejection;

  const body = await req.json().catch(() => null);
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const specialization = typeof body?.specialization === "string" ? body.specialization.trim() : "";
  const yearsExperienceRaw = body?.yearsExperience;
  const cvUrl = typeof body?.cvUrl === "string" ? body.cvUrl.trim() : "";

  if (!fullName || !email || !phone || !specialization) {
    return NextResponse.json({ error: "الاسم والبريد والجوال والتخصص مطلوبة" }, { status: 400 });
  }
  if (fullName.length > 160 || email.length > 320 || phone.length > 32 || specialization.length > 160 || cvUrl.length > 2000) {
    return NextResponse.json({ error: "بيانات الطلب طويلة جدًا" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "البريد الإلكتروني غير صحيح" }, { status: 400 });
  }

  let yearsExperience: number | null = null;
  if (yearsExperienceRaw !== undefined && yearsExperienceRaw !== null && yearsExperienceRaw !== "") {
    const n = Number(yearsExperienceRaw);
    if (!Number.isInteger(n) || n < 0 || n > 60) {
      return NextResponse.json({ error: "سنوات الخبرة غير صحيحة" }, { status: 400 });
    }
    yearsExperience = n;
  }

  if (cvUrl) {
    try {
      const parsed = new URL(cvUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return NextResponse.json({ error: "رابط السيرة الذاتية غير صالح" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "رابط السيرة الذاتية غير صالح" }, { status: 400 });
    }
  }

  const emailLimit = await checkRateLimit({
    request: req,
    scope: "teacher-application:email",
    identifier: email,
    limit: 3,
    windowSeconds: 86400,
  });
  const emailRejection = rateLimitRejectionResponse(emailLimit);
  if (emailRejection) return emailRejection;

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("teacher_applications").insert({
    full_name: fullName,
    email,
    phone,
    specialization,
    years_experience: yearsExperience,
    cv_url: cvUrl || null,
  });

  if (error) {
    console.error("[teacher-applications] فشل حفظ الطلب:", error.message);
    return NextResponse.json({ error: "تعذّر حفظ طلبك، حاول مرة أخرى" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
