import { redirect } from "next/navigation";
import StudentShell from "@/components/StudentShell";
import { getActiveStudentSession } from "@/lib/student-mode";
import { getToneLevel } from "@/lib/grade-config";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const statusLabel: Record<string, string> = {
  scheduled: "قادمة",
  completed: "انتهت ✓",
  cancelled: "أُلغيت",
};

export default async function P() {
  const session = await getActiveStudentSession();
  if (!session) redirect("/student");

  const tone = getToneLevel(session.grade);
  const junior = tone === "junior";
  const admin = createSupabaseAdminClient();

  const { data: subs } = await admin
    .from("subscriptions")
    .select("cohort_id")
    .eq("child_id", session.childId)
    .eq("status", "active");
  const cohortIds = (subs ?? []).map((s) => s.cohort_id).filter(Boolean) as string[];

  const { data: sessions } = cohortIds.length
    ? await admin
        .from("sessions")
        .select("id, starts_at, status, cohorts(title, teacher_id, teachers(full_name))")
        .in("cohort_id", cohortIds)
        .gte("starts_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order("starts_at", { ascending: true })
        .limit(14)
    : { data: [] };

  return (
    <StudentShell firstName={session.firstName} grade={session.grade}>
      <h1 className="title" style={{ fontSize: junior ? 26 : 22, marginBottom: 16 }}>جدولي</h1>

      {(!sessions || sessions.length === 0) && (
        <div className="student-card student-empty">
          <span className="icon">📅</span>
          <p>لا توجد جلسات قادمة مجدولة حاليًا.</p>
        </div>
      )}

      {(sessions ?? []).map((s: any) => (
        <div className="student-card" key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <b style={{ fontSize: junior ? 18 : 15 }}>
              {new Date(s.starts_at).toLocaleDateString("ar-SA", { weekday: "long" })}
            </b>
            <p style={{ margin: "4px 0 0", color: "var(--gray)" }}>
              {new Date(s.starts_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
              {!junior && s.cohorts?.title ? ` • ${s.cohorts.title}` : ""}
              {!junior && s.cohorts?.teachers?.full_name ? ` • ${s.cohorts.teachers.full_name}` : ""}
            </p>
          </div>
          <span className="badge">{statusLabel[s.status] ?? s.status}</span>
        </div>
      ))}
    </StudentShell>
  );
}
