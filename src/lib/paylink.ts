import "server-only";

// أداة خادم فقط للتكامل مع Paylink API v2. لا Credentials داخل الكود إطلاقًا — كل شيء من
// متغيرات البيئة. كل دالة هنا Fail-closed: أي استجابة غير متوقَّعة (حالة HTTP غير 200، حقل
// ناقص) تُعامَل كفشل صريح، لا كنجاح افتراضي.

function getPaylinkEnv() {
  const baseUrl = process.env.PAYLINK_BASE_URL;
  const apiId = process.env.PAYLINK_API_ID;
  const apiSecret = process.env.PAYLINK_API_SECRET;
  if (!baseUrl || !apiId || !apiSecret) return null;
  return { baseUrl, apiId, apiSecret };
}

type AuthResult = { ok: true; idToken: string } | { ok: false; error: string };

async function authenticatePaylink(): Promise<AuthResult> {
  const env = getPaylinkEnv();
  if (!env) return { ok: false, error: "Paylink غير مُهيَّأ — متغيرات بيئة ناقصة (PAYLINK_BASE_URL/API_ID/API_SECRET)" };

  try {
    const res = await fetch(`${env.baseUrl}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiId: env.apiId, secretKey: env.apiSecret, persistToken: false }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[paylink] فشل /api/auth بحالة ${res.status}`);
      return { ok: false, error: `فشل مصادقة Paylink (${res.status})` };
    }
    const data = await res.json().catch(() => null);
    const idToken = data?.id_token;
    if (!idToken || typeof idToken !== "string") {
      console.error("[paylink] استجابة /api/auth بلا id_token صالح");
      return { ok: false, error: "استجابة مصادقة Paylink غير صالحة" };
    }
    return { ok: true, idToken };
  } catch (err) {
    console.error("[paylink] خطأ اتصال أثناء /api/auth:", err instanceof Error ? err.message : err);
    return { ok: false, error: "تعذّر الاتصال بـPaylink" };
  }
}

export type PaylinkInvoiceResult =
  | { ok: true; invoice: Record<string, unknown> }
  | { ok: false; error: string };

// جلب الفاتورة الفعلية من Paylink مباشرة — هذا هو مصدر التحقق النهائي الوحيد الموثوق به،
// وليس بيانات الـwebhook نفسها.
export async function getPaylinkInvoice(transactionNo: string): Promise<PaylinkInvoiceResult> {
  const env = getPaylinkEnv();
  if (!env) return { ok: false, error: "Paylink غير مُهيَّأ" };

  const auth = await authenticatePaylink();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const res = await fetch(`${env.baseUrl}/api/getInvoice/${encodeURIComponent(transactionNo)}`, {
      headers: { Authorization: `Bearer ${auth.idToken}`, Accept: "application/json", "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[paylink] فشل getInvoice(${transactionNo}) بحالة ${res.status}`);
      return { ok: false, error: `فشل التحقق من الفاتورة (${res.status})` };
    }
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== "object") {
      return { ok: false, error: "استجابة getInvoice غير صالحة" };
    }
    return { ok: true, invoice: data as Record<string, unknown> };
  } catch (err) {
    console.error("[paylink] خطأ اتصال أثناء getInvoice:", err instanceof Error ? err.message : err);
    return { ok: false, error: "تعذّر الاتصال بـPaylink" };
  }
}

export type CreateInvoiceInput = {
  orderNumber: string;
  amount: number;
  clientName: string;
  clientMobile: string;
  clientEmail?: string | null;
  productTitle: string;
  callBackUrl: string;
  cancelUrl: string;
};

export type CreateInvoiceResult =
  | { ok: true; paymentUrl: string; transactionNo: string }
  | { ok: false; error: string };

export async function createPaylinkInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  const env = getPaylinkEnv();
  if (!env) return { ok: false, error: "Paylink غير مُهيَّأ" };

  const auth = await authenticatePaylink();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const res = await fetch(`${env.baseUrl}/api/addInvoice`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.idToken}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        orderNumber: input.orderNumber,
        amount: input.amount,
        currency: "SAR",
        clientName: input.clientName,
        clientMobile: input.clientMobile,
        ...(input.clientEmail ? { clientEmail: input.clientEmail } : {}),
        products: [{ title: input.productTitle, price: input.amount, qty: 1 }],
        callBackUrl: input.callBackUrl,
        cancelUrl: input.cancelUrl,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[paylink] فشل addInvoice بحالة ${res.status}:`, errText.slice(0, 300));
      return { ok: false, error: `فشل إنشاء طلب الدفع (${res.status})` };
    }
    const data = await res.json().catch(() => null);
    const paymentUrl = data?.url;
    const transactionNo = data?.transactionNo;
    if (!paymentUrl || typeof paymentUrl !== "string" || !transactionNo) {
      console.error("[paylink] استجابة addInvoice بلا url أو transactionNo صالحَين");
      return { ok: false, error: "استجابة Paylink غير مكتملة" };
    }
    return { ok: true, paymentUrl, transactionNo: String(transactionNo) };
  } catch (err) {
    console.error("[paylink] خطأ اتصال أثناء addInvoice:", err instanceof Error ? err.message : err);
    return { ok: false, error: "تعذّر الاتصال بـPaylink" };
  }
}
