import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeSaudiStoredPhoneInput, SAUDI_PHONE_ERROR } from "@/lib/phone";
import { checkRateLimit, declaredBodyExceeds, rateLimitRejectionResponse, readJsonBodyLimited } from "@/lib/api-rate-limit";

export async function POST(req: Request) {
  const authed = await createSupabaseServerClient();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const limit = await checkRateLimit({ request: req, scope: "parent:profile", identifier: user.id, limit: 10, windowSeconds: 600 });
  const rejection = rateLimitRejectionResponse(limit);
  if (rejection) return rejection;
  if (declaredBodyExceeds(req, 8 * 1024)) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const parsed = await readJsonBodyLimited(req, 8 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const fullName = typeof parsed.body?.fullName === "string" ? parsed.body.fullName.trim() : "";
  const phone = typeof parsed.body?.phone === "string" ? normalizeSaudiStoredPhoneInput(parsed.body.phone) : null;
  if (fullName.length < 2 || fullName.length > 100) return NextResponse.json({ error: "أدخل اسمًا صحيحًا" }, { status: 400 });
  if (!phone) return NextResponse.json({ error: SAUDI_PHONE_ERROR }, { status: 400 });
  const email = user.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "تعذّر تحديد بريد الحساب" }, { status: 500 });

  const admin = createSupabaseAdminClient();
  const { data: parent, error: findError } = await admin.from("parents").select("id").eq("user_id", user.id).maybeSingle();
  if (findError || !parent) return NextResponse.json({ error: "ملف ولي الأمر غير موجود" }, { status: 404 });
  const { error } = await admin.from("parents").update({ full_name: fullName, phone, email }).eq("id", parent.id).eq("user_id", user.id);
  if (error) {
    console.error(`[parent-profile] فشل تحديث الملف ${parent.id}:`, error.message);
    return NextResponse.json({ error: "تعذّر حفظ البيانات" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
