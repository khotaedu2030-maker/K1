import AdminShell from "@/components/AdminShell";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export default async function AdminAdminsPage() {
  const admin = await getAdminIdentity("admin.manage");
  if (!admin) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;

  const supabase = createSupabaseAdminClient();
  const { data: admins } = await supabase.from("admins").select("id, user_id, full_name, created_at").order("created_at", { ascending: true });

  return (
    <AdminShell adminName={admin.full_name}>
      <div className="admin-page-head">
        <h1>الإداريون والصلاحيات</h1>
      </div>
      <p style={{ color: "var(--gray)", fontSize: 13, marginBottom: 16 }}>
        كل الحسابات المُدرَجة هنا لديها صلاحية إدارة كاملة (Full Admin) — لا نظام أدوار فرعية
        بعد. إضافة/حذف حساب إداري يتم حاليًا من قاعدة البيانات مباشرة، وليس من هذه الواجهة —
        إجراء حسّاس أمنيًا مُتروك عمدًا خارج الواجهة إلى أن يُصمَّم نظام صلاحيات فرعي حقيقي.
      </p>
      {(admins ?? []).length === 0 ? (
        <p className="admin-empty-state">لا يوجد إداريون.</p>
      ) : (
        <table className="admin-table">
          <thead><tr><th>الاسم</th><th>معرّف المستخدم</th><th>تاريخ الإضافة</th></tr></thead>
          <tbody>
            {(admins ?? []).map((a: { id: string; user_id: string; full_name: string; created_at: string }) => (
              <tr key={a.id}>
                <td>{a.full_name}</td>
                <td dir="ltr" style={{ fontSize: 12, color: "var(--gray)" }}>{a.user_id}</td>
                <td>{new Date(a.created_at).toLocaleDateString("ar-SA")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}
