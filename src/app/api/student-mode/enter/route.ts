import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { STUDENT_SESSION_COOKIE, STUDENT_SESSION_TTL_HOURS } from "@/lib/student-mode-constants";

// الدخول لمساحة الطالب: يتحقق أن الطفل تابع فعلًا لولي الأمر المسجّل دخوله، ثم ينشئ
// student_mode_sessions ويضع معرّفها في كوكي httpOnly — لا نضع childId نفسه في أي كوكي أو state عميل.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const childId = body?.childId as string | undefined;
  if (!childId) return NextResponse.json({ error: "childId مطلوب" }, { status: 400 });

  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: parent } = await admin.from("parents").select("id").eq("user_id", user.id).maybeSingle();
  if (!parent) return NextResponse.json({ error: "لا يوجد سجل ولي أمر لهذا الحساب" }, { status: 403 });

  const { data: child } = await admin.from("children").select("id, parent_id").eq("id", childId).maybeSingle();
  if (!child || child.parent_id !== parent.id) {
    return NextResponse.json({ error: "هذا الطفل غير تابع لحسابك" }, { status: 403 });
  }

  const expiresAt = new Date(Date.now() + STUDENT_SESSION_TTL_HOURS * 60 * 60 * 1000);
  const { data: session, error } = await admin
    .from("student_mode_sessions")
    .insert({ parent_user_id: user.id, child_id: childId, expires_at: expiresAt.toISOString() })
    .select("id")
    .single();
  if (error || !session) return NextResponse.json({ error: error?.message ?? "تعذّر الدخول" }, { status: 500 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(STUDENT_SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: STUDENT_SESSION_TTL_HOURS * 60 * 60,
  });
  return res;
}
