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

function isRateLimitError(error: { status?: number; message: string }): boolean {
  const message = error.message.toLowerCase();
  return error.status === 429 || message.includes("rate limit") || message.includes("too many");
}

export async function POST(req: Request) {
  if (declaredBodyExceeds(req, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  }

  const parsed = await readJsonBodyLimited(req, MAX_BODY_BYTES);
  if (!parsed.ok) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });

  const email = normalizeEmail(parsed.body?.email);
  const code = typeof parsed.body?.code === "string" ? parsed.body.code.trim() : "";
  if (!email || !code || code.length > 32) {
    return NextResponse.json({ error: "بيانات الطلب غير صالحة" }, { status: 400 });
  }

  const ipLimit = await checkRateLimit({
    request: req,
    scope: "auth:otp-verify:ip",
    limit: 30,
    windowSeconds: 600,
  });
  const ipRejection = rateLimitRejectionResponse(ipLimit);
  if (ipRejection) return ipRejection;

  const emailLimit = await checkRateLimit({
    request: req,
    scope: "auth:otp-verify:email",
    identifier: email,
    limit: 10,
    windowSeconds: 600,
  });
  const emailRejection = rateLimitRejectionResponse(emailLimit);
  if (emailRejection) return emailRejection;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) {
    if (isRateLimitError(error)) {
      return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
    }
    if (error.status === 400 || error.status === 401) {
      return NextResponse.json({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية." }, { status: 401 });
    }
    return NextResponse.json({ error: "تعذّر التحقق من الرمز الآن. حاول مرة أخرى." }, { status: 503 });
  }

  if (!data.user) {
    return NextResponse.json({ error: "تعذّر التحقق من الرمز الآن. حاول مرة أخرى." }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}