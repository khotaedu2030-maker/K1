import AdminShell from "@/components/AdminShell";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { SCORECARD_POLICY } from "@/lib/policies";

const MIN_SESSIONS_FOR_STATUS = 3;
const WINDOW_DAYS = 30;

// Scorecard Philosophy (V3): لا نجمع المؤشرات في رقم واحد سحري بلا Policy أوزان واضحة.
// نعرضها منفصلة، مع Status مختصر مشتق من قواعد موثَّقة هنا فقط:
//   Critical  : الالتزام < 70% أو دقة التسليم < 50%
//   Attention : الالتزام < 90% أو دقة التسليم < 80%
//   Healthy   : غير ذلك
//   Insufficient data: أقل من 3 جلسات مكتملة خلال آخر 30 يومًا
function deriveStatus(commitmentRate: number | null, timelinessRate: number | null, completedCount: number) {
  if (completedCount < MIN_SESSIONS_FOR_STATUS) return "insufficient";
  if ((commitmentRate ?? 1) < 0.7 || (timelinessRate ?? 1) < 0.5) return "critical";
  if ((commitmentRate ?? 1) < 0.9 || (timelinessRate ?? 1) < 0.8) return "attention";
  return "healthy";
}

const statusMeta: Record<string, { label: string; color: string }> = {
  healthy: { label: "Healthy", color: "var(--t)" },
  attention: { label: "Attention", color: "var(--g)" },
  critical: { label: "Critical", color: "var(--p)" },
  insufficient: { label: "Insufficient data", color: "var(--gray)" },
};

export default async function P() {
  const adminIdentity = await getAdminIdentity("teacher.manage");

  if (!adminIdentity) {
    return (
      <div className="placeholder-page">
        <div className="narrow">
          <span className="badge">غير مصرَّح</span>
          <h1 className="title" style={{ fontSize: 32, marginTop: 16 }}>هذه الصفحة لحسابات الإدارة فقط</h1>
        </div>
      </div>
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: teachers } = await admin.from("teachers").select("id, full_name").eq("active", true);

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);

  const rows = await Promise.all(
    (teachers ?? []).map(async (t: { id: string; full_name: string }) => {
      const { data: sessions } = await admin
        .from("sessions")
        .select("id, status, cancelled_by, ends_at")
        .eq("teacher_id", t.id)
        .gte("session_date", windowStart.toISOString().slice(0, 10));

      const completed = (sessions ?? []).filter((s: { status: string; cancelled_by: string | null }) => s.status === "completed");
      const teacherCancelled = (sessions ?? []).filter((s: { status: string; cancelled_by: string | null }) => s.status === "cancelled" && s.cancelled_by === "teacher");
      const commitmentDenominator = completed.length + teacherCancelled.length;
      const commitmentRate = commitmentDenominator > 0 ? completed.length / commitmentDenominator : null;

      let onTimeCount = 0;
      for (const s of completed) {
        const { data: pulse } = await admin
          .from("daily_pulse_reports")
          .select("created_at")
          .eq("session_id", s.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (pulse) {
          const hoursLate = (new Date(pulse.created_at).getTime() - new Date(s.ends_at).getTime()) / 3600000;
          if (hoursLate <= SCORECARD_POLICY.REPORT_SLA_HOURS) onTimeCount++;
        }
      }
      const timelinessRate = completed.length > 0 ? onTimeCount / completed.length : null;

      const { data: cohorts } = await admin.from("cohorts").select("id").eq("teacher_id", t.id);
      const cohortIds = (cohorts ?? []).map((c: { id: string }) => c.id);
      const { data: activeSubs } = cohortIds.length
        ? await admin.from("subscriptions").select("child_id").in("cohort_id", cohortIds).eq("status", "active")
        : { data: [] };
      const activeStudents = new Set((activeSubs ?? []).map((s: { child_id: string }) => s.child_id)).size;

      const status = deriveStatus(commitmentRate, timelinessRate, completed.length);

      return {
        id: t.id,
        name: t.full_name,
        commitmentRate,
        timelinessRate,
        assignedCohorts: cohortIds.length,
        activeStudents,
        status,
      };
    })
  );

  return (
    <AdminShell adminName={adminIdentity.full_name}>
      <div className="admin-page-head">
        <h1>جودة المعلمين</h1>
      </div>
      <p style={{ color: "var(--gray)", marginBottom: 20 }}>
        آخر {WINDOW_DAYS} يومًا. لا يوجد ترتيب علني بين المعلمين — هذه أداة دعم قرار داخلي فقط.
      </p>

      <div>
        {rows.map((r: { id: string; name: string; commitmentRate: number | null; timelinessRate: number | null; assignedCohorts: number; activeStudents: number; status: string }) => (
          <div className="dashcard" key={r.id} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b>{r.name}</b>
              <span className="badge" style={{ color: statusMeta[r.status].color }}>
                {statusMeta[r.status].label}
              </span>
            </div>
            <div className="kpi" style={{ marginTop: 14 }}>
              <div>
                <strong>{r.commitmentRate !== null ? `${Math.round(r.commitmentRate * 100)}%` : "—"}</strong>
                <span>الالتزام بالجلسات</span>
              </div>
              <div>
                <strong>{r.timelinessRate !== null ? `${Math.round(r.timelinessRate * 100)}%` : "—"}</strong>
                <span>دقة تسليم التقرير</span>
              </div>
              <div>
                <strong>{r.assignedCohorts}</strong>
                <span>مجموعات مسندة</span>
              </div>
              <div>
                <strong>{r.activeStudents}</strong>
                <span>طلاب نشطون</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
