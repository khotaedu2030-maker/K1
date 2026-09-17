// اختبار تشخيصي محلي آمن لمصادقة Paylink فقط — POST /api/auth، لا أكثر.
// يطبع فقط: HTTP status و success/failure. لا يطبع apiId ولا secretKey ولا id_token إطلاقًا.
//
// الاستخدام: npm run paylink:smoke
// يتوقع أن PAYLINK_BASE_URL / PAYLINK_API_ID / PAYLINK_API_SECRET متاحة في process.env —
// مثال تشغيل يدوي مباشر: node --env-file=.env.local scripts/paylink-smoke.mjs

const baseUrl = process.env.PAYLINK_BASE_URL;
const apiId = process.env.PAYLINK_API_ID;
const apiSecret = process.env.PAYLINK_API_SECRET;

if (!baseUrl || !apiId || !apiSecret) {
  console.log("FAILURE — متغيرات بيئة ناقصة (PAYLINK_BASE_URL / PAYLINK_API_ID / PAYLINK_API_SECRET)");
  process.exit(1);
}

try {
  const res = await fetch(`${baseUrl}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ apiId, secretKey: apiSecret, persistToken: false }),
  });

  console.log(`HTTP status: ${res.status}`);

  if (res.ok) {
    const data = await res.json().catch(() => null);
    const hasToken = Boolean(data && typeof data.id_token === "string" && data.id_token.length > 0);
    console.log(hasToken ? "SUCCESS" : "FAILURE — استجابة 200 بلا id_token صالح");
    process.exit(hasToken ? 0 : 1);
  } else {
    console.log("FAILURE");
    process.exit(1);
  }
} catch (err) {
  console.log("FAILURE — خطأ اتصال");
  process.exit(1);
}
