import AdminShell from "@/components/AdminShell";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import AdminUserActions from "./AdminUserActions";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  operations_manager: "مدير العمليات",
  finance_admin: "الإدارة المالية",
  admin_support: "دعم الإدارة",
};

export default async function AdminAdminsPage() {
  const admin = await getAdminIdentity("admin.manage");
  if (!admin) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;

  const supabase = createSupabaseAdminClient();
  const [{ data: admins }, { data: authUsers }] = await Promise.all([
    supabase.from("admins").select("id, user_id, full_name, role, active, created_at").order("created_at", { ascending: true }),
    supabase.auth.admin.listUsers(),
  ]);
  const emailByUserId = new Map((authUsers?.users ?? []).map((user) => [user.id, user.email ?? "—"]));

  return (
    <AdminShell adminName={admin.full_name}>
      <div className="admin-page-head"><h1>الإداريون والصلاحيات</h1></div>
      <p style={{ color: "var(--gray)", fontSize: 13, marginBottom: 16 }}>
        تغيير الدور أو حالة الحساب يمر عبر إجراء ذري موثق. لا يمكن تعطيل آخر Super Admin نشط أو الحساب المستخدم حاليًا.
      </p>
      {(admins ?? []).length === 0 ? <p className="admin-empty-state">لا يوجد إداريون.</p> : (
        <table className="admin-table">
          <thead><tr><th>الاسم</th><th>البريد الإلكتروني</th><th>الدور</th><th>الحالة</th><th>تاريخ الإضافة</th><th>إجراء</th></tr></thead>
          <tbody>{(admins ?? []).map((item: any) => (
            <tr key={item.id}>
              <td>{item.full_name}</td>
              <td dir="ltr" style={{ fontSize: 12 }}>{item.user_id ? emailByUserId.get(item.user_id) ?? "—" : "—"}</td>
              <td>{ROLE_LABELS[item.role] ?? item.role}</td>
              <td>{item.active ? <span style={{ color: "#1f9d55" }}>نشط</span> : <span style={{ color: "var(--p)" }}>مُعطَّل</span>}</td>
              <td>{new Date(item.created_at).toLocaleDateString("ar-SA")}</td>
              <td><AdminUserActions adminId={item.id} currentRole={item.role} active={item.active} isSelf={item.id === admin.id} /></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </AdminShell>
  );
}
