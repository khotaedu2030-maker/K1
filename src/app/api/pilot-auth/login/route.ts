import { NextResponse } from "next/server";
import { isPilotAuthEnabled, getConfiguredPilotParentId, createPilotSessionToken, PILOT_SESSION_COOKIE, PILOT_SESSION_MAX_AGE_SECONDS } from "@/lib/pilot-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// إنشاء جلسة Pilot موقَّعة (HttpOnly cookie) — مستحيل الوصول لهذا المسار في الإنتاج حتى لو
// نُودي يدويًا (curl/Postman): isPilotAuthEnabled() تتحقق من NODE_ENV أولًا قبل أي شيء آخر.
export async function POST() {
  if (!isPilotAuthEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parentId = getConfiguredPilotParentId();
  if (!parentId) return NextResponse.json({ error: "Pilot parent not configured" }, { status: 503 });

  // The demo identity is fixed by server configuration, never by request data.
  const admin = createSupabaseAdminClient();
  const { data: demoParent, error: parentError } = await admin
    .from("parents")
    .select("id, user_id")
    .eq("id", parentId)
    .is("user_id", null)
    .maybeSingle();
  if (parentError) {
    console.error("[pilot-auth] demo parent lookup failed:", parentError.message);
    return NextResponse.json({ error: "Pilot identity unavailable" }, { status: 503 });
  }
  if (!demoParent) {
    return NextResponse.json({ error: "Pilot demo account unavailable" }, { status: 503 });
  }

  let token: string;
  try {
    token = await createPilotSessionToken();
  } catch {
    // KHOTA_PILOT_SECRET غير معرَّف في .env.local — لا نكشف تفاصيل السبب للعميل
    return NextResponse.json({ error: "Pilot auth غير مهيَّأ بالكامل (راجع .env.local)" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(PILOT_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PILOT_SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
