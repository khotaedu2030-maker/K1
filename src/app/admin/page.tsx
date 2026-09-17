import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

async function getOverviewData() {
  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { count: children },
    { count: activeSubs },
    { count: pausedSubs },
    { data: todaySessions },
    { count: pendingApplications },
    { count: newContactRequests },
    { count: newPremiumRequests },
    { count: unusedMakeupCredits },
    { count: activeTeachers },
    { count: unrecordedAttendanceSessions },
  ] = await Promise.all([
    supabase.from("children").select("*", { count: "exact", head: true }),
    supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "paused"),
    supabase
      .from("sessions")
      .select("id, starts_at, ends_at, status, cohort_id, teacher_id, cohorts(title)")
      .eq("session_date", today)
      .order("starts_at", { ascending: true }),
    supabase.from("teacher_applications").select("*", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("contact_requests").select("*", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("premium_requests").select("*", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("makeup_credits").select("*", { count: "exact", head: true }).eq("status", "available"),
    supabase.from("teachers").select("*", { count: "exact", head: true }).eq("active", true),
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .lt("session_date", today)
      .gte("session_date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)),
  ]);

  return {
    children: children ?? 0,
    activeSubs: activeSubs ?? 0,
    pausedSubs: pausedSubs ?? 0,
    todaySessions: todaySessions ?? [],
    pendingApplications: pendingApplications ?? 0,
    newContactRequests: newContactRequests ?? 0,
    newPremiumRequests: newPremiumRequests ?? 0,
    unusedMakeupCredits: unusedMakeupCredits ?? 0,
    activeTeachers: activeTeachers ?? 0,
    unrecordedAttendanceSessions: unrecordedAttendanceSessions ?? 0,
  };
}

export default async function AdminOverviewPage() {
  const admin = await getAdminIdentity();
  if (!admin) {
    return (
      <div className="placeholder-page">
        <div className="narrow">
          <span className="badge">غير مصرَّح</span>
          <h1 className="title" style={{ fontSize: 32, marginTop: 16 }}>هذه الصفحة لحسابات الإدارة فقط</h1>
          <Link className="btn outline" href="/">← الرئيسية</Link>
        </div>
      </div>
    );
  }

  const d = await getOverviewData();

  const actionQueue = [
    d.pendingApplications > 0 && { label: `${d.pendingApplications} طلب معلم جديد بانتظار المراجعة`, href: "/admin/teacher-applications" },
    d.newContactRequests > 0 && { label: `${d.newContactRequests} رسالة تواصل جديدة`, href: "/admin/requests" },
    d.newPremiumRequests > 0 && { label: `${d.newPremiumRequests} طلب اهتمام جديد`, href: "/admin/requests" },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <AdminShell adminName={admin.full_name}>
      <div className="admin-page-head">
        <h1>نظرة عامة</h1>
      </div>

      <div className="admin-kpi-grid">
        <div className="admin-kpi-card"><strong>{d.children}</strong><span>الأبناء المسجّلون</span></div>
        <div className="admin-kpi-card"><strong>{d.activeSubs}</strong><span>اشتراكات فعّالة</span></div>
        <div className="admin-kpi-card"><strong>{d.pausedSubs}</strong><span>اشتراكات موقوفة</span></div>
        <div className="admin-kpi-card"><strong>{d.activeTeachers}</strong><span>معلمون نشطون</span></div>
        <div className="admin-kpi-card"><strong>{d.todaySessions.length}</strong><span>جلسات اليوم</span></div>
        <div className="admin-kpi-card"><strong>{d.unusedMakeupCredits}</strong><span>أرصدة تعويض غير مستخدَمة</span></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 20 }}>
        <div className="dashcard">
          <b>يحتاج إجراء</b>
          {actionQueue.length === 0 ? (
            <p className="admin-empty-state" style={{ marginTop: 12 }}>لا يوجد شيء يحتاج إجراءً الآن.</p>
          ) : (
            <div style={{ marginTop: 10 }}>
              {actionQueue.map((item) => (
                <Link key={item.href + item.label} href={item.href} className="taskline" style={{ textDecoration: "none", color: "inherit" }}>
                  <span>{item.label}</span>
                  <span>←</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="dashcard">
          <b>جلسات اليوم</b>
          {d.todaySessions.length === 0 ? (
            <p className="admin-empty-state" style={{ marginTop: 12 }}>لا توجد جلسات مجدولة اليوم.</p>
          ) : (
            <div style={{ marginTop: 10 }}>
              {d.todaySessions.slice(0, 8).map((s: { id: string; starts_at: string; status: string; cohorts: { title: string } | null }) => (
                <div className="taskline" key={s.id}>
                  <span>{new Date(s.starts_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })} — {s.cohorts?.title ?? "—"}</span>
                  <span>{s.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {d.unrecordedAttendanceSessions > 0 && (
        <div className="dashcard" style={{ marginTop: 20, borderColor: "var(--p)" }}>
          <span className="badge" style={{ color: "var(--p)" }}>تنبيه تشغيلي</span>
          <p style={{ marginTop: 8 }}>
            {d.unrecordedAttendanceSessions} جلسة خلال آخر 7 أيام قد لا يكون حضورها مسجَّلًا بالكامل —
            راجع <Link href="/admin/attendance" style={{ color: "var(--t)", fontWeight: 700 }}>صفحة الحضور</Link>.
          </p>
        </div>
      )}
    </AdminShell>
  );
}
