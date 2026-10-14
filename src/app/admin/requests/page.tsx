import AdminShell from "@/components/AdminShell";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { adminRoleHasPermission } from "@/lib/admin-permissions";
import RequestStatusActions from "./RequestStatusActions";

export default async function AdminRequestsPage() {
  const admin = await getAdminIdentity("request.read");
  if (!admin) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;

  const supabase = createSupabaseAdminClient();
  const canManage = adminRoleHasPermission(admin.role, "support.manage");
  const [{ data: contactRequests }, { data: premiumRequests }] = await Promise.all([
    supabase.from("contact_requests").select("id, full_name, email, phone, message, status, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("premium_requests").select("id, product, full_name, phone, goal, status, created_at").order("created_at", { ascending: false }).limit(50),
  ]);

  return (
    <AdminShell adminName={admin.full_name} role={admin.role}>
      <div className="admin-page-head">
        <h1>طلبات التسجيل والتواصل</h1>
      </div>

      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <strong>{(contactRequests ?? []).filter((r) => r.status === "new").length}</strong>
          <span>رسائل جديدة</span>
        </div>
        <div className="admin-kpi-card">
          <strong>{(contactRequests ?? []).filter((r) => r.status === "reviewing").length}</strong>
          <span>تحت المراجعة</span>
        </div>
        <div className="admin-kpi-card">
          <strong>{(premiumRequests ?? []).filter((r) => r.status === "new").length}</strong>
          <span>طلبات اهتمام جديدة</span>
        </div>
        <div className="admin-kpi-card">
          <strong>{(premiumRequests ?? []).filter((r) => r.status === "contacted").length}</strong>
          <span>تم التواصل معها</span>
        </div>
      </div>

      <b style={{ display: "block", marginBottom: 10 }}>رسائل التواصل</b>
      {(contactRequests ?? []).length === 0 ? (
        <p className="admin-empty-state" style={{ marginBottom: 20 }}>لا توجد رسائل.</p>
      ) : (
        <table className="admin-table" style={{ marginBottom: 24 }}>
          <thead><tr><th>الاسم</th><th>البريد</th><th>الجوال</th><th>الرسالة</th><th>الحالة</th><th>التاريخ</th></tr></thead>
          <tbody>
            {(contactRequests ?? []).map((r: { id: string; full_name: string; email: string; phone: string | null; message: string; status: string; created_at: string }) => (
              <tr key={r.id}>
                <td>{r.full_name}</td>
                <td dir="ltr" style={{ fontSize: 12 }}>{r.email}</td>
                <td dir="ltr">{r.phone ?? "—"}</td>
                <td style={{ maxWidth: 260 }}>{r.message}</td>
                <td>
                  {canManage
                    ? <RequestStatusActions id={r.id} kind="contact" currentStatus={r.status} />
                    : r.status}
                </td>
                <td>{new Date(r.created_at).toLocaleDateString("ar-SA")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <b style={{ display: "block", marginBottom: 10 }}>طلبات الاهتمام (Premium)</b>
      {(premiumRequests ?? []).length === 0 ? (
        <p className="admin-empty-state">لا توجد طلبات.</p>
      ) : (
        <table className="admin-table">
          <thead><tr><th>الاسم</th><th>الجوال</th><th>المنتج</th><th>الهدف</th><th>الحالة</th><th>التاريخ</th></tr></thead>
          <tbody>
            {(premiumRequests ?? []).map((r: { id: string; product: string; full_name: string | null; phone: string; goal: string | null; status: string; created_at: string }) => (
              <tr key={r.id}>
                <td>{r.full_name ?? "—"}</td>
                <td dir="ltr">{r.phone}</td>
                <td>{r.product}</td>
                <td>{r.goal ?? "—"}</td>
                <td>
                  {canManage
                    ? <RequestStatusActions id={r.id} kind="premium" currentStatus={r.status} />
                    : r.status}
                </td>
                <td>{new Date(r.created_at).toLocaleDateString("ar-SA")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}
