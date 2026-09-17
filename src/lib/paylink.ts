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

// حالات مؤقتة فعليًا (مشكلة عند Paylink نفسها، لا في طلبنا) — تستحق إعادة محاولة قصيرة.
// لا إعادة محاولة على 400/401/403 (خطأ في الطلب/بيانات الاعتماد نفسها — إعادة المحاولة لن تغيّر شيئًا).
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const RETRY_BACKOFF_MS = [300, 900]; // محاولتان إضافيتان فقط بعد المحاولة الأصلية

// رسالة عربية عامة مطمئنة للمستخدم النهائي دائمًا — التفاصيل التقنية (الحالة، جزء من الجسم)
// تُسجَّل server-side فقط عبر console.error، ولا تُعرَض له أبدًا.
function userFacingPaylinkError(): string {
  return "بوابة الدفع غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.";
}

async function authenticatePaylink(): Promise<AuthResult> {
  const env = getPaylinkEnv();
  if (!env) return { ok: false, error: "Paylink غير مُهيَّأ — متغيرات بيئة ناقصة (PAYLINK_BASE_URL/API_ID/API_SECRET)" };

  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt++) {
    try {
      const res = await fetch(`${env.baseUrl}/api/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        // ⚠️ لا نُسجِّل apiId أو secretKey أو id_token أبدًا في أي console.error بهذا الملف —
        // فقط الحالة (status) وأول 300 حرف من جسم استجابة الخطأ (بيانات Paylink، لا بياناتنا).
        body: JSON.stringify({ apiId: env.apiId, secretKey: env.apiSecret, persistToken: false }),
        cache: "no-store",
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        console.error(`[paylink] فشل /api/auth بحالة ${res.status} (محاولة ${attempt + 1}):`, bodyText.slice(0, 300));

        if (RETRYABLE_STATUS.has(res.status) && attempt < RETRY_BACKOFF_MS.length) {
          await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[attempt]));
          continue;
        }
        return { ok: false, error: userFacingPaylinkError() };
      }

      const data = await res.json().catch(() => null);
      const idToken = data?.id_token;
      if (!idToken || typeof idToken !== "string") {
        console.error("[paylink] استجابة /api/auth بلا id_token صالح");
        return { ok: false, error: userFacingPaylinkError() };
      }
      return { ok: true, idToken };
    } catch (err) {
      console.error(`[paylink] خطأ اتصال أثناء /api/auth (محاولة ${attempt + 1}):`, err instanceof Error ? err.message : err);
      if (attempt < RETRY_BACKOFF_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[attempt]));
        continue;
      }
      return { ok: false, error: userFacingPaylinkError() };
    }
  }
  return { ok: false, error: userFacingPaylinkError() };
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
      return { ok: false, error: userFacingPaylinkError() };
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
  | { ok: false; error: string; ambiguous: boolean };

export async function createPaylinkInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  const env = getPaylinkEnv();
  if (!env) return { ok: false, error: "Paylink غير مُهيَّأ", ambiguous: false };

  const auth = await authenticatePaylink();
  if (!auth.ok) return { ok: false, error: auth.error, ambiguous: false };

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
      // حالة غامضة حقيقية: الفاتورة قد تكون أُنشئت فعليًا لدى Paylink رغم استجابة خطأ لنا
      // (انقطاع مؤقت وقت الرد تحديدًا). 502/503/504 تحديدًا تستدعي مصالحة قبل أي قرار "failed"
      // نهائي — لا نفترض الفشل التام هنا. 400/401/403 ليست غامضة (الطلب نفسه رُفض بوضوح).
      const ambiguous = res.status === 502 || res.status === 503 || res.status === 504;
      return { ok: false, error: userFacingPaylinkError(), ambiguous };
    }
    const data = await res.json().catch(() => null);
    const paymentUrl = data?.url;
    const transactionNo = data?.transactionNo;
    if (!paymentUrl || typeof paymentUrl !== "string" || !transactionNo) {
      console.error("[paylink] استجابة addInvoice بلا url أو transactionNo صالحَين");
      return { ok: false, error: "استجابة Paylink غير مكتملة", ambiguous: false };
    }
    return { ok: true, paymentUrl, transactionNo: String(transactionNo) };
  } catch (err) {
    // خطأ اتصال (انقطاع الشبكة قبل استلام أي رد) — الحالة الغامضة الكلاسيكية: قد تكون
    // الفاتورة أُنشئت فعليًا لدى Paylink ولم يصلنا الرد فقط. تستدعي مصالحة دائمًا.
    console.error("[paylink] خطأ اتصال أثناء addInvoice:", err instanceof Error ? err.message : err);
    return { ok: false, error: "تعذّر الاتصال بـPaylink", ambiguous: true };
  }
}

// مصالحة الحالة الغامضة: هل أُنشئت الفاتورة فعليًا لدى Paylink رغم أننا لم نستلم ردًّا واضحًا؟
// GET /api/getTransactionsOfOrderNumber/{orderNumber} — orderNumber هنا هو payments.id نفسه
// (نفس القيمة المُرسَلة أصلًا في addInvoice)، لا حاجة لتخمين transactionNo.
export type PaylinkTransactionsResult =
  | { ok: true; transactions: Record<string, unknown>[] }
  | { ok: false; error: string };

export async function getPaylinkTransactionsByOrderNumber(orderNumber: string): Promise<PaylinkTransactionsResult> {
  const env = getPaylinkEnv();
  if (!env) return { ok: false, error: "Paylink غير مُهيَّأ" };

  const auth = await authenticatePaylink();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const res = await fetch(`${env.baseUrl}/api/getTransactionsOfOrderNumber/${encodeURIComponent(orderNumber)}`, {
      headers: { Authorization: `Bearer ${auth.idToken}`, Accept: "application/json", "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[paylink] فشل getTransactionsOfOrderNumber(${orderNumber}) بحالة ${res.status}`);
      return { ok: false, error: userFacingPaylinkError() };
    }
    const data = await res.json().catch(() => null);
    // الاستجابة قد تكون مصفوفة مباشرة أو كائنًا يحوي مصفوفة — نتعامل مع الاحتمالين دفاعيًا.
    const transactions = Array.isArray(data) ? data : Array.isArray(data?.transactions) ? data.transactions : [];
    return { ok: true, transactions };
  } catch (err) {
    console.error("[paylink] خطأ اتصال أثناء getTransactionsOfOrderNumber:", err instanceof Error ? err.message : err);
    return { ok: false, error: "تعذّر الاتصال بـPaylink" };
  }
}
