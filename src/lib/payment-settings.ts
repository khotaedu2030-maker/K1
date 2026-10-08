import "server-only";

// الدفع متوقف افتراضيًا. لا يُفتح إلا بقرار تشغيلي صريح في بيئة الخادم.
// هذا القفل يُستخدم في الواجهة وAPI معًا، لذلك لا يمكن تجاوزه بطلب مباشر.
export function areOnlinePaymentsEnabled(): boolean {
  return process.env.KHOTA_PAYMENTS_ENABLED === "true";
}
