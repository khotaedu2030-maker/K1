// عميل Supabase بصلاحية service_role — Server-only بشكل صارم.
// يتجاوز RLS بالكامل؛ لا يُستورد هذا الملف أبدًا من أي مكوّن "use client" أو أي كود يصل للمتصفح.
// يُستخدم فقط داخل src/app/api/** لعمليات موثوقة: إنشاء الاشتراك بعد الدفع، القراءات الإدارية المجمّعة.
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY غير موجود في البيئة — لا يمكن تنفيذ عمليات الخادم الموثوقة بدونه."
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
