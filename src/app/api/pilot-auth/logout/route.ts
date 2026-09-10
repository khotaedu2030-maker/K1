import { NextResponse } from "next/server";
import { isPilotAuthEnabled, PILOT_SESSION_COOKIE } from "@/lib/pilot-auth";

// يمسح كوكي Pilot فقط — لا علاقة له بجلسة Supabase Auth الحقيقية إطلاقًا (لا يلمسها بأي شكل).
export async function POST() {
  if (!isPilotAuthEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PILOT_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
