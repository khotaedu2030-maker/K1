import { NextResponse } from "next/server";
import { isPilotAuthEnabled, createPilotSessionToken, PILOT_SESSION_COOKIE, PILOT_SESSION_MAX_AGE_SECONDS } from "@/lib/pilot-auth";

// إنشاء جلسة Pilot موقَّعة (HttpOnly cookie) — مستحيل الوصول لهذا المسار في الإنتاج حتى لو
// نُودي يدويًا (curl/Postman): isPilotAuthEnabled() تتحقق من NODE_ENV أولًا قبل أي شيء آخر.
export async function POST() {
  if (!isPilotAuthEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
