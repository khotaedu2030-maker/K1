import AdminShell from "@/components/AdminShell";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export default async function AdminRequestsPage() {
  const admin = await getAdminIdentity();
  if (!admin) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;

  const supabase = createSupabaseAdminClient();
  const [{ data: contactRequests }, { data: premiumRequests }] = await Promise.all([
    supabase.from("contact_requests").select("id, full_name, email, phone, message, status, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("premium_requests").select("id, product, full_name, phone, goal, status, created_at").order("created_at", { ascending: false }).limit(50),
  ]);

  return (
    <AdminShell adminName={admin.full_name}>
      <div className="admin-page-head">
        <h1>طلبات التسجيل والتواصل</h1>
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
                <td>{r.status}</td>
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
                <td>{r.status}</td>
                <td>{new Date(r.created_at).toLocaleDateString("ar-SA")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}
