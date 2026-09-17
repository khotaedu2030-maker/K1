import AdminShell from "@/components/AdminShell";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const STATUS_LABELS: Record<string, string> = { present: "حاضر", absent: "غائب", late: "متأخر", excused: "معذور" };

export default async function AdminAttendancePage() {
  const admin = await getAdminIdentity();
  if (!admin) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;

  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [{ data: recentAttendance }, { data: recentSessions }] = await Promise.all([
    supabase
      .from("attendance")
      .select("id, status, created_at, children(first_name), sessions(session_date, cohorts(title))")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase.from("sessions").select("id, session_date, cohorts(title)").lt("session_date", today).gte("session_date", weekAgo).eq("status", "completed"),
  ]);

  const recordedSessionIds = new Set((recentAttendance ?? []).map((a: any) => a.sessions?.session_date));
  const unrecorded = (recentSessions ?? []).filter((s: any) => !recordedSessionIds.has(s.session_date));

  return (
    <AdminShell adminName={admin.full_name}>
      <div className="admin-page-head">
        <h1>الحضور</h1>
      </div>

      {unrecorded.length > 0 && (
        <div className="dashcard" style={{ marginBottom: 20, borderColor: "var(--p)" }}>
          <span className="badge" style={{ color: "var(--p)" }}>جلسات قد يكون حضورها غير مسجَّل</span>
          <p style={{ color: "var(--gray)", marginTop: 8, fontSize: 13 }}>
            {unrecorded.length} جلسة مكتملة خلال آخر 7 أيام بلا أي سجل حضور مرتبط ظاهر هنا.
          </p>
        </div>
      )}

      <b style={{ display: "block", marginBottom: 10 }}>آخر تسجيلات الحضور (7 أيام)</b>
      {(recentAttendance ?? []).length === 0 ? (
        <p className="admin-empty-state">لا توجد تسجيلات حضور حديثة.</p>
      ) : (
        <table className="admin-table">
          <thead><tr><th>الطالب</th><th>المجموعة</th><th>التاريخ</th><th>الحالة</th></tr></thead>
          <tbody>
            {(recentAttendance ?? []).map((a: any) => (
              <tr key={a.id}>
                <td>{a.children?.first_name ?? "—"}</td>
                <td>{a.sessions?.cohorts?.title ?? "—"}</td>
                <td>{a.sessions?.session_date ? new Date(a.sessions.session_date).toLocaleDateString("ar-SA") : "—"}</td>
                <td>{STATUS_LABELS[a.status] ?? a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}
