// تحقّق وتحويل رقم الجوال السعودي — الواجهة تعرض وتقبل الصيغة المحلية 05XXXXXXXX فقط،
// ولا يُحوَّل إلى +966XXXXXXXXX إلا داخليًا قبل إرساله لـ Supabase Auth / OTP مباشرة.
// المستخدم لا يرى ولا يكتب +966 في أي مكان.

export const SAUDI_PHONE_ERROR = "أدخل رقم جوال سعودي صحيح يبدأ بـ 05";

// يقبل فقط 05 متبوعة بـ 8 أرقام (10 أرقام إجمالًا)
const SAUDI_LOCAL_PHONE_REGEX = /^05\d{8}$/;

export function isValidSaudiLocalPhone(phone: string): boolean {
  return SAUDI_LOCAL_PHONE_REGEX.test(phone.replace(/\D/g, ""));
}

// يحوّل 0559992028 -> +966559992028. يرمي خطأً واضحًا إن كانت الصيغة غير صحيحة —
// لا تحويل صامت لقيمة غير صالحة.
export function normalizeSaudiPhone(phone: string): string {
  const local = phone.replace(/\D/g, "");

  if (!SAUDI_LOCAL_PHONE_REGEX.test(local)) {
    throw new Error(SAUDI_PHONE_ERROR);
  }

  return `+966${local.slice(1)}`;
}

// خاص ببوابة الدفع Paylink فقط — لا علاقة له بـAuth/OTP/enroll، ولا يُستخدَم فيها. الجوال
// يُخزَّن دائمًا بصيغة +966XXXXXXXXX (عبر normalizeSaudiPhone أعلاه)، لكن Paylink يتوقّع الصيغة
// المحلية 05XXXXXXXX. يقبل الصيغتين المخزَّنتين المحتملتين (محلية أو دولية) ويرفض غيرهما
// fail-closed — لا افتراض/تخمين لصيغة غير معروفة.
export function toPaylinkSaudiMobile(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (/^05\d{8}$/.test(digits)) {
    return digits;
  }
  if (/^9665\d{8}$/.test(digits)) {
    return `0${digits.slice(3)}`;
  }

  throw new Error("رقم جوال غير صالح لبوابة الدفع");
}
