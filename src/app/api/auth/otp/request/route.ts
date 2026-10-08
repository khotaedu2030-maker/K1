import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  checkRateLimit,
  declaredBodyExceeds,
  rateLimitRejectionResponse,
  readJsonBodyLimited,
} from "@/lib/api-rate-limit";

const MAX_BODY_BYTES = 4 * 1024;
const RATE_LIMIT_MESSAGE = "محاولات كثيرة متتالية — انتظر قليلًا ثم أعد المحاولة.";

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export async function POST(req: Request) {
  if (declaredBodyExceeds(req, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  }

  const parsed = await readJsonBodyLimited(req, MAX_BODY_BYTES);
  if (!parsed.ok) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });

  const email = normalizeEmail(parsed.body?.email);
  const mode = parsed.body?.mode;
  if (!email || (mode !== "parent" && mode !== "staff" && mode !== "signup")) {
    return NextResponse.json({ error: "بيانات الطلب غير صالحة" }, { status: 400 });
  }

  const ipLimit = await checkRateLimit({
    request: req,
    scope: "auth:otp-request:ip",
    limit: 10,
    windowSeconds: 900,
  });
  const ipRejection = rateLimitRejectionResponse(ipLimit);
  if (ipRejection) return ipRejection;

  const emailLimit = await checkRateLimit({
    request: req,
    scope: "auth:otp-request:email",
    identifier: email,
    limit: 5,
    windowSeconds: 3600,
  });
  const emailRejection = rateLimitRejectionResponse(emailLimit);
  if (emailRejection) return emailRejection;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: mode === "signup" },
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (error.status === 429 || message.includes("rate limit") || message.includes("too many")) {
      return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
    }
    return NextResponse.json({ error: "تعذّر إرسال رمز التحقق." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}