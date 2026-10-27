import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeParentEmail } from "@/lib/parent-identity";

// Admin-only preflight: automatic teacher provisioning must create a dedicated
// identity. It cannot safely claim any pre-existing parent/admin/auth account.
// No role mutations, account deletions, or email contents leave the server.
export async function checkNewTeacherEmail(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  emailRaw: string,
): Promise<{ ok: true } | { ok: false; status: number; reason: string }> {
  const email = normalizeParentEmail(emailRaw);
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, status: 409, reason: "بريد طلب المعلم غير صالح؛ راجع بيانات الطلب." };
  }
  const pageSize = 1000;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: pageSize });
    if (error || !data) {
      return { ok: false, status: 503, reason: "تعذّر التأكد من استقلال بريد المعلم. حاول مرة أخرى." };
    }
    if (data.users.some((u) => u.email?.trim().toLowerCase() === email)) {
      return {
        ok: false, status: 409,
        reason: "البريد مرتبط بحساب موجود مسبقًا في خُطى. استخدم بريدًا جديدًا مستقلًا للمعلم؛ لا يمكن استخدام حساب ولي أمر أو مدير.",
      };
    }
    if (data.users.length < pageSize) return { ok: true };
  }
  return { ok: false, status: 503, reason: "تعذّر إكمال فحص جميع حسابات الدخول؛ لا يمكن قبول الطلب حاليًا." };
}
