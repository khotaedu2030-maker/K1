import AdminShell from "@/components/AdminShell";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const ACTION_LABELS: Record<string, string> = {
  capacity_change: "تغيير سعة مجموعة",
  registration_status_change: "تغيير حالة تسجيل مجموعة",
  teacher_assignment: "إسناد معلم",
  settings_update: "تحديث الإعدادات",
};

export default async function AdminAuditPage() {
  const admin = await getAdminIdentity();
  if (!admin) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;

  const supabase = createSupabaseAdminClient();
  const { data: actions } = await supabase
    .from("admin_actions")
    .select("id, admin_user_id, action, entity_type, entity_id, old_value, new_value, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <AdminShell adminName={admin.full_name}>
      <div className="admin-page-head">
        <h1>سجل العمليات</h1>
      </div>
      <p style={{ color: "var(--gray)", fontSize: 13, marginBottom: 16 }}>آخر 100 عملية إدارية حساسة.</p>

      {(actions ?? []).length === 0 ? (
        <p className="admin-empty-state">لا يوجد سجل بعد.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead><tr><th>الإجراء</th><th>النوع</th><th>المعرّف</th><th>القديم</th><th>الجديد</th><th>الوقت</th></tr></thead>
            <tbody>
              {(actions ?? []).map((a: { id: string; action: string; entity_type: string; entity_id: string; old_value: unknown; new_value: unknown; created_at: string }) => (
                <tr key={a.id}>
                  <td>{ACTION_LABELS[a.action] ?? a.action}</td>
                  <td>{a.entity_type}</td>
                  <td style={{ fontSize: 12, color: "var(--gray)" }} dir="ltr">{a.entity_id}</td>
                  <td style={{ fontSize: 12 }}>{a.old_value ? JSON.stringify(a.old_value) : "—"}</td>
                  <td style={{ fontSize: 12 }}>{a.new_value ? JSON.stringify(a.new_value) : "—"}</td>
                  <td>{new Date(a.created_at).toLocaleString("ar-SA")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
