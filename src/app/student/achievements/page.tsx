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

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: subs } = await admin.from("subscriptions").select("cohort_id").eq("child_id", session.childId).eq("status", "active");
  const cohortIds = (subs ?? []).map((s) => s.cohort_id).filter(Boolean) as string[];

  const { data: recentSessions } = cohortIds.length
    ? await admin.from("sessions").select("id").in("cohort_id", cohortIds).gte("session_date", weekAgo.toISOString().slice(0, 10))
    : { data: [] };
  const sessionIds = (recentSessions ?? []).map((s) => s.id);

  const { data: attendanceRows } = sessionIds.length
    ? await admin.from("attendance").select("status").eq("child_id", session.childId).in("session_id", sessionIds)
    : { data: [] };
  const regularAttendance = sessionIds.length > 0 && (attendanceRows ?? []).filter((a) => a.status === "present").length / sessionIds.length >= 0.75;

  const { data: weekTasks } = await admin
    .from("daily_tasks")
    .select("status, subject")
    .eq("child_id", session.childId)
    .gte("created_at", weekAgo.toISOString());
  const allTasksDone = (weekTasks ?? []).length > 0 && (weekTasks ?? []).every((t) => t.status === "done");
  const readingCommitment = (weekTasks ?? []).some((t) => t.status === "done" && (t.subject?.includes("قراءة") || t.subject?.includes("Reading")));

  const { data: goal } = await admin
    .from("weekly_goals")
    .select("status")
    .eq("child_id", session.childId)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  const goalAchieved = goal?.status === "achieved";

  const { data: independenceRows } = await admin
    .from("independence_assessments")
    .select("total_score")
    .eq("child_id", session.childId)
    .order("assessment_date", { ascending: false })
    .limit(2);
  const moreIndependent = (independenceRows ?? []).length >= 2 && independenceRows![0].total_score > independenceRows![1].total_score;

  const achievements = [
    { emoji: "🏅", title: "أكملت مهام الأسبوع", earned: allTasksDone, hint: "أنجز كل مهامك هذا الأسبوع" },
    { emoji: "⭐", title: "حضرت جلساتك بانتظام", earned: regularAttendance, hint: "احضر معظم جلساتك هذا الأسبوع" },
    { emoji: "🎯", title: "حققت هدف الأسبوع", earned: goalAchieved, hint: "حقق خطوة الأسبوع مع معلمك" },
    { emoji: "🌱", title: "أصبحت أكثر استقلالية", earned: moreIndependent, hint: "استمر بإنجاز مهامك بنفسك" },
    { emoji: "📚", title: "التزمت بالقراءة", earned: readingCommitment, hint: "أكمل مهمة قراءة" },
  ];

  return (
    <StudentShell firstName={session.firstName} grade={session.grade}>
      <h1 className="title" style={{ fontSize: junior ? 26 : 22, marginBottom: 16 }}>إنجازاتي 🏅</h1>
      <div className="badge-grid">
        {achievements.map((a) => (
          <div className={`achievement ${a.earned ? "earned" : "locked"}`} key={a.title}>
            <span className="emoji">{a.emoji}</span>
            <b>{a.title}</b>
            {!a.earned && <small>{junior ? "قريب! 💪" : a.hint}</small>}
          </div>
        ))}
      </div>
    </StudentShell>
  );
}
