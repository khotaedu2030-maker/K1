import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { checkRateLimit, rateLimitRejectionResponse } from "@/lib/api-rate-limit";

// يحدّد دور المستخدم المصادَق فعليًا بعد OTP — لا يُربَط Teacher أو Admin تلقائيًا كـParent.
// لا يكشف أي بيانات حساسة، فقط الدور نفسه.
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ role: "none" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit({
    request: req,
    scope: "auth:resolve-role:user",
    identifier: user.id,
    limit: 30,
    windowSeconds: 60,
  });
  const rejection = rateLimitRejectionResponse(rateLimit);
  if (rejection) return rejection;

  const admin = createSupabaseAdminClient();

  const { data: adminRow, error: adminError } = await admin.from("admins").select("id").eq("user_id", user.id).eq("active", true).maybeSingle();
  if (adminError) {
    console.error("[resolve-role] admin lookup failed:", adminError.message);
    return NextResponse.json({ role: "none", error: "تعذّر التحقق من نوع الحساب" }, { status: 503 });
  }
  if (adminRow) return NextResponse.json({ role: "admin" });

  const { data: teacherRow, error: teacherError } = await admin.from("teachers").select("id").eq("user_id", user.id).eq("active", true).maybeSingle();
  if (teacherError) {
    console.error("[resolve-role] teacher lookup failed:", teacherError.message);
    return NextResponse.json({ role: "none", error: "تعذّر التحقق من نوع الحساب" }, { status: 503 });
  }
  if (teacherRow) return NextResponse.json({ role: "teacher" });

  const { data: parentRow, error: parentError } = await admin.from("parents").select("id").eq("user_id", user.id).maybeSingle();
  if (parentError) {
    console.error("[resolve-role] parent lookup failed:", parentError.message);
    return NextResponse.json({ role: "none", error: "تعذّر التحقق من نوع الحساب" }, { status: 503 });
  }
  if (parentRow) return NextResponse.json({ role: "parent" });

  return NextResponse.json({ role: "none" });
}
