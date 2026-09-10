import Link from "next/link";
import Shell from "@/components/Shell";
import { createSupabaseServerClient } from "@/lib/supabase-server";
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
  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  const { data: adminRow } = user
    ? await authed.from("admins").select("full_name").eq("user_id", user.id).maybeSingle()
    : { data: null };

  if (!adminRow) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <span className="badge">غير مصرَّح</span>
            <h1 className="title" style={{ fontSize: 32, marginTop: 16 }}>هذه الصفحة لحسابات الإدارة فقط</h1>
            <Link className="btn outline" href="/">← الرئيسية</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: teachers } = await admin.from("teachers").select("id, full_name").eq("active", true);

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);

  const rows = await Promise.all(
    (teachers ?? []).map(async (t) => {
      const { data: sessions } = await admin
        .from("sessions")
        .select("id, status, cancelled_by, ends_at")
        .eq("teacher_id", t.id)
        .gte("session_date", windowStart.toISOString().slice(0, 10));

      const completed = (sessions ?? []).filter((s) => s.status === "completed");
      const teacherCancelled = (sessions ?? []).filter((s) => s.status === "cancelled" && s.cancelled_by === "teacher");
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
      const cohortIds = (cohorts ?? []).map((c) => c.id);
      const { data: activeSubs } = cohortIds.length
        ? await admin.from("subscriptions").select("child_id").in("cohort_id", cohortIds).eq("status", "active")
        : { data: [] };
      const activeStudents = new Set((activeSubs ?? []).map((s) => s.child_id)).size;

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
    <Shell>
      <main className="section">
        <div className="container">
          <span className="eyebrow">لوحة الإدارة</span>
          <h1 className="title" style={{ fontSize: 34 }}>جودة المعلمين</h1>
          <p className="lead">
            آخر {WINDOW_DAYS} يومًا. لا يوجد ترتيب علني بين المعلمين — هذه أداة دعم قرار داخلي فقط.
          </p>

          <div style={{ marginTop: 24 }}>
            {rows.map((r) => (
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
        </div>
      </main>
    </Shell>
  );
}
