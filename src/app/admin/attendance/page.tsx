import AdminShell from "@/components/AdminShell";
import { getAdminIdentity } from "@/lib/admin-identity";
import { adminRoleHasPermission } from "@/lib/admin-permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { supabaseRelationOne, type SupabaseRelation } from "@/lib/supabase-relations";
import AttendanceOverrideButton from "./AttendanceOverrideButton";
import { addRiyadhCalendarDays, formatRiyadhCalendarDate, getRiyadhCalendarDate } from "@/lib/riyadh-time";

const STATUS_LABELS: Record<string, string> = { present: "حاضر", absent: "غائب", late: "متأخر", excused: "معذور" };

type AttendanceRow = {
  id: string;
  session_id: string;
  child_id: string;
  status: string;
  children: SupabaseRelation<{ first_name: string | null }>;
  sessions: SupabaseRelation<{ session_date: string; cohorts: SupabaseRelation<{ title: string | null }> }>;
};

export default async function AdminAttendancePage() {
  const admin = await getAdminIdentity("attendance.read");
  if (!admin) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;
  const canOverride = adminRoleHasPermission(admin.role, "session.manage");

  const supabase = createSupabaseAdminClient();
  const todayCalendar = getRiyadhCalendarDate(new Date());
  const today = formatRiyadhCalendarDate(todayCalendar);
  const weekAgo = formatRiyadhCalendarDate(addRiyadhCalendarDays(todayCalendar, -7));

  const { data: recentSessions } = await supabase
    .from("sessions")
    .select("id, session_date, cohorts(title)")
    .lt("session_date", today)
    .gte("session_date", weekAgo)
    .eq("status", "completed")
    .order("session_date", { ascending: false });

  const recentSessionIds = (recentSessions ?? []).map((s: { id: string }) => s.id);
  const { data: recentAttendance } = recentSessionIds.length
    ? await supabase
        .from("attendance")
        .select("id, session_id, child_id, status, created_at, children(first_name), sessions(session_date, cohorts(title))")
        .in("session_id", recentSessionIds)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] };

  const recordedSessionIds = new Set((recentAttendance ?? []).map((a: { session_id: string }) => a.session_id));
  const unrecorded = (recentSessions ?? []).filter((s: { id: string }) => !recordedSessionIds.has(s.id));

  return (
    <AdminShell adminName={admin.full_name} role={admin.role}>
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
          <thead><tr><th>الطالب</th><th>المجموعة</th><th>التاريخ</th><th>الحالة</th>{canOverride && <th>تصحيح</th>}</tr></thead>
          <tbody>
            {((recentAttendance ?? []) as AttendanceRow[]).map((a) => (
              <tr key={a.id}>
                <td>{supabaseRelationOne(a.children)?.first_name ?? "—"}</td>
                <td>{supabaseRelationOne(supabaseRelationOne(a.sessions)?.cohorts)?.title ?? "—"}</td>
                <td>{supabaseRelationOne(a.sessions)?.session_date ? new Date(supabaseRelationOne(a.sessions)!.session_date).toLocaleDateString("ar-SA") : "—"}</td>
                <td>{STATUS_LABELS[a.status] ?? a.status}</td>
                {canOverride && <td><AttendanceOverrideButton sessionId={a.session_id} childId={a.child_id} currentStatus={a.status} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}
