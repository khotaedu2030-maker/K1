// Pilot Auth — طبقة دخول تجريبية لبيئة التطوير فقط، لاختبار رحلة العميل كاملة بدون SMS/WhatsApp.
// هذا الملف "نقي" عمدًا (بلا next/headers، بلا عملاء Supabase) لأن middleware.ts يحتاج التحقق
// من الكوكي وهو يعمل على Edge runtime — Web Crypto (crypto.subtle) متاح في Edge وNode.js معًا،
// بعكس وحدة crypto التقليدية في Node التي لا تعمل على Edge.
//
// مستحيل تفعيله في الإنتاج: isPilotAuthEnabled() تتحقق من NODE_ENV بالإضافة إلى متغير بيئة
// صريح — إن غاب أي شرط منهما يبقى النظام كما هو تمامًا، بلا أي تغيير سلوك.

export const PILOT_SESSION_COOKIE = "khota_pilot_session";
export const PILOT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 6; // 6 ساعات

export function isPilotAuthEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.KHOTA_PILOT_AUTH === "true";
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getHmacKey(): Promise<CryptoKey> {
  const secret = process.env.KHOTA_PILOT_SECRET;
  if (!secret) {
    throw new Error("KHOTA_PILOT_SECRET غير معرَّف في البيئة — لا يمكن إنشاء/التحقق من جلسة Pilot بدونه.");
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// القيمة المخزَّنة في الكوكي لا تحمل أي بيانات حساسة — فقط دور ثابت وطابع زمني، وهي موقَّعة
// (HMAC-SHA256) بمفتاح سري لا يظهر في الكوكي نفسه، فلا يمكن تزويرها بدون معرفة KHOTA_PILOT_SECRET.
export async function createPilotSessionToken(): Promise<string> {
  const key = await getHmacKey();
  const payload = JSON.stringify({ role: "pilot-parent", iat: Date.now() });
  const payloadB64 = base64url(new TextEncoder().encode(payload));
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const signatureB64 = base64url(new Uint8Array(signature));
  return `${payloadB64}.${signatureB64}`;
}

export async function verifyPilotSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, signatureB64] = parts;

  try {
    const key = await getHmacKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlToBytes(signatureB64),
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) return false;

    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)));
    if (typeof payload.iat !== "number") return false;

    const ageMs = Date.now() - payload.iat;
    return ageMs >= 0 && ageMs <= PILOT_SESSION_MAX_AGE_SECONDS * 1000;
  } catch {
    return false;
  }
}
