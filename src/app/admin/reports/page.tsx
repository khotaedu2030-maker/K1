import AdminShell from "@/components/AdminShell";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export default async function AdminReportsPage() {
  const admin = await getAdminIdentity();
  if (!admin) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;

  const supabase = createSupabaseAdminClient();
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const [
    { count: activeSubs },
    { count: pausedSubs },
    { count: cancelledSubs },
    { count: paidPaymentsMonth },
    { data: paidAmounts },
    { count: completedSessionsMonth },
    { count: cancelledSessionsMonth },
    { count: makeupUsedMonth },
  ] = await Promise.all([
    supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "paused"),
    supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "cancelled"),
    supabase.from("payments").select("*", { count: "exact", head: true }).eq("status", "paid").gte("paid_at", monthAgo),
    supabase.from("payments").select("amount_sar").eq("status", "paid").gte("paid_at", monthAgo),
    supabase.from("sessions").select("*", { count: "exact", head: true }).eq("status", "completed").gte("session_date", monthAgo.slice(0, 10)),
    supabase.from("sessions").select("*", { count: "exact", head: true }).eq("status", "cancelled").gte("session_date", monthAgo.slice(0, 10)),
    supabase.from("makeup_credits").select("*", { count: "exact", head: true }).eq("status", "used").gte("issued_at", monthAgo),
  ]);

  const totalRevenue = (paidAmounts ?? []).reduce((sum: number, p: { amount_sar: number }) => sum + Number(p.amount_sar), 0);

  return (
    <AdminShell adminName={admin.full_name}>
      <div className="admin-page-head">
        <h1>التقارير</h1>
      </div>
      <p style={{ color: "var(--gray)", fontSize: 13, marginBottom: 20 }}>ملخص آخر 30 يومًا.</p>

      <div className="admin-kpi-grid">
        <div className="admin-kpi-card"><strong>{activeSubs ?? 0}</strong><span>اشتراكات فعّالة</span></div>
        <div className="admin-kpi-card"><strong>{pausedSubs ?? 0}</strong><span>اشتراكات موقوفة</span></div>
        <div className="admin-kpi-card"><strong>{cancelledSubs ?? 0}</strong><span>اشتراكات ملغاة</span></div>
        <div className="admin-kpi-card"><strong>{paidPaymentsMonth ?? 0}</strong><span>مدفوعات ناجحة</span></div>
        <div className="admin-kpi-card"><strong>{totalRevenue.toLocaleString("ar-SA")} ر.س</strong><span>إيراد الشهر</span></div>
        <div className="admin-kpi-card"><strong>{completedSessionsMonth ?? 0}</strong><span>جلسات مكتملة</span></div>
        <div className="admin-kpi-card"><strong>{cancelledSessionsMonth ?? 0}</strong><span>جلسات ملغاة</span></div>
        <div className="admin-kpi-card"><strong>{makeupUsedMonth ?? 0}</strong><span>أرصدة تعويض مُستخدَمة</span></div>
      </div>

      <div className="admin-unavailable">
        <span className="badge">قيد التطوير</span>
        <p style={{ marginTop: 8 }}>تصدير CSV وتقارير أعمق (استخدام المعلمين، معدلات التسجيل) لم تُبنَ بعد.</p>
      </div>
    </AdminShell>
  );
}
