import { redirect } from "next/navigation";
import StudentShell from "@/components/StudentShell";
import StudentSessionCard from "./StudentSessionCard";
import { getActiveStudentSession } from "@/lib/student-mode";
import { getToneLevel } from "@/lib/grade-config";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export default async function P() {
  const session = await getActiveStudentSession();
  if (!session) redirect("/student");

  const tone = getToneLevel(session.grade);
  const junior = tone === "junior";
  const admin = createSupabaseAdminClient();

  // أقرب جلسة اليوم (أو القادمة إن لم توجد جلسة اليوم)
  const { data: subs } = await admin
    .from("subscriptions")
    .select("cohort_id")
    .eq("child_id", session.childId)
    .eq("status", "active");
  const cohortIds = (subs ?? []).map((s) => s.cohort_id).filter(Boolean) as string[];

  const { data: sessions } = cohortIds.length
    ? await admin
        .from("sessions")
        .select("id, starts_at, ends_at, cohorts(title)")
        .in("cohort_id", cohortIds)
        .gte("starts_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order("starts_at", { ascending: true })
        .limit(1)
    : { data: [] };

  const nextSession = sessions?.[0]
    ? {
        id: sessions[0].id,
        startsAt: sessions[0].starts_at,
        endsAt: sessions[0].ends_at,
        title: (sessions[0] as any).cohorts?.title ?? "جلستك",
      }
    : null;

  // أهم مهمة معلَّقة اليوم
  const { data: topTask } = await admin
    .from("daily_tasks")
    .select("id, title, subject")
    .eq("child_id", session.childId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // هدف الأسبوع
  const { data: goal } = await admin
    .from("weekly_goals")
    .select("title, status")
    .eq("child_id", session.childId)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  // تشجيع بسيط: آخر بطاقة إنجاز (Tomorrow Ready) إن وجدت
  const { data: lastPulse } = await admin
    .from("daily_pulse_reports")
    .select("readiness_status, created_at")
    .eq("child_id", session.childId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <StudentShell firstName={session.firstName} grade={session.grade}>
      <StudentSessionCard session={nextSession} junior={junior} />

      <div className="student-card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>{junior ? "شنو أسوي اليوم؟" : "المهمة الأهم اليوم"}</h3>
        {topTask ? (
          <p style={{ fontSize: junior ? 20 : 16, fontWeight: 800 }}>{topTask.title}</p>
        ) : (
          <div className="student-empty">
            <span className="icon">✅</span>
            <p>ما عليك مهام معلَّقة الآن — أحسنت!</p>
          </div>
        )}
      </div>

      <div className="student-card">
        <h3 style={{ marginTop: 0 }}>🎯 هدف هذا الأسبوع</h3>
        {goal ? (
          <p style={{ fontSize: junior ? 18 : 15 }}>{goal.title}</p>
        ) : (
          <p style={{ color: "var(--gray)" }}>لم يُحدَّد هدف بعد — اسأل معلمك!</p>
        )}
      </div>

      {lastPulse?.readiness_status === "ready" && (
        <div className="student-card" style={{ background: "var(--teal-light)", border: "none" }}>
          <p style={{ margin: 0, fontWeight: 800 }}>
            {tone === "focus" ? "جاهز ليوم الغد." : "🌟 جاهز تمامًا ليوم الغد — استمر هيك!"}
          </p>
        </div>
      )}
    </StudentShell>
  );
}
