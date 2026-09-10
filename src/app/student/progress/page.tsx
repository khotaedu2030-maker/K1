import { redirect } from "next/navigation";
import StudentShell from "@/components/StudentShell";
import { getActiveStudentSession } from "@/lib/student-mode";
import { getToneLevel } from "@/lib/grade-config";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export default async function P() {
  const session = await getActiveStudentSession();
  if (!session) redirect("/student");

  const tone = getToneLevel(session.grade);
  const junior = tone === "junior";
  const admin = createSupabaseAdminClient();

  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const { data: subs } = await admin.from("subscriptions").select("cohort_id").eq("child_id", session.childId).eq("status", "active");
  const cohortIds = (subs ?? []).map((s) => s.cohort_id).filter(Boolean) as string[];

  const { data: recentSessions } = cohortIds.length
    ? await admin.from("sessions").select("id").in("cohort_id", cohortIds).gte("session_date", monthAgo.toISOString().slice(0, 10))
    : { data: [] };
  const sessionIds = (recentSessions ?? []).map((s) => s.id);

  const { data: attendanceRows } = sessionIds.length
    ? await admin.from("attendance").select("status").eq("child_id", session.childId).in("session_id", sessionIds)
    : { data: [] };
  const attendanceRate = sessionIds.length
    ? Math.round(((attendanceRows ?? []).filter((a) => a.status === "present").length / sessionIds.length) * 100)
    : null;

  const { data: taskRows } = await admin
    .from("daily_tasks")
    .select("status")
    .eq("child_id", session.childId)
    .gte("created_at", monthAgo.toISOString());
  const tasksRate = (taskRows ?? []).length
    ? Math.round(((taskRows ?? []).filter((t) => t.status === "done").length / (taskRows ?? []).length) * 100)
    : null;

  const { data: goal } = await admin
    .from("weekly_goals")
    .select("status")
    .eq("child_id", session.childId)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  const goalRate = goal ? (goal.status === "achieved" ? 100 : goal.status === "partially_achieved" ? 50 : 20) : null;

  const { data: independence } = await admin
    .from("independence_assessments")
    .select("total_score")
    .eq("child_id", session.childId)
    .order("assessment_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const items: { label: string; value: number | null }[] = [
    { label: "الحضور", value: attendanceRate },
    { label: "إنجاز المهام", value: tasksRate },
    { label: "هدف الأسبوع", value: goalRate },
    { label: "الاستقلالية", value: independence?.total_score ?? null },
  ];

  const hasAnyData = items.some((i) => i.value !== null);

  return (
    <StudentShell firstName={session.firstName} grade={session.grade}>
      <h1 className="title" style={{ fontSize: junior ? 26 : 22, marginBottom: 6 }}>أنا أتقدّم 🌱</h1>
      <p style={{ color: "var(--gray)", marginBottom: 16 }}>مؤشرات بسيطة، مو أرقام معقّدة.</p>

      {!hasAnyData ? (
        <div className="student-card student-empty">
          <span className="icon">🌱</span>
          <p>لا توجد بيانات كافية بعد — سيظهر تقدّمك هنا قريبًا.</p>
        </div>
      ) : (
        <div className="student-card">
          <div className="progress-ring-wrap">
            {items.map((item) => (
              <div className="progress-item" key={item.label}>
                <b>{item.value !== null ? `${Math.round(item.value)}%` : "—"}</b>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${item.value ?? 0}%` }} />
                </div>
                <span style={{ fontSize: 13, color: "var(--gray)" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </StudentShell>
  );
}
