import Link from "next/link";
import Shell from "@/components/Shell";
import { resolveParentContext } from "@/lib/pilot-parent";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import ParentChildTabs from "@/components/ParentChildTabs";
import { resolveOwnedChild } from "@/lib/parent-child-selection";
import { getRiyadhCalendarDate, addRiyadhCalendarDays, formatRiyadhCalendarDate, riyadhWallClockToUtcInstant } from "@/lib/riyadh-time";

const dimLabels: Record<string, string> = {
  reading_score: "القراءة",
  writing_spelling_score: "الإملاء",
  mathematics_score: "الرياضيات",
  english_score: "الإنجليزية",
  focus_score: "التركيز",
  independence_score: "الاستقلالية",
};

type ProgressSnapshot = {
  reading_score: number | null;
  writing_spelling_score: number | null;
  mathematics_score: number | null;
  english_score: number | null;
  focus_score: number | null;
  independence_score: number | null;
};

// خُطى الأسبوعي — يُولَّد بالكامل من بيانات حقيقية عند كل طلب، ولا يُخزَّن كنص ثابت.
export default async function P({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const context = await resolveParentContext();

  if (!context) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <span className="badge">تسجيل الدخول مطلوب</span>
            <Link className="btn" href="/login">تسجيل الدخول ←</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: children } = await supabase.from("children").select("id, first_name").eq("parent_id", context.parentId);
  const firstChild = resolveOwnedChild(children ?? [], (await searchParams).child);

  if (!firstChild) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <p className="lead">{(children ?? []).length ? "الطفل المطلوب غير مرتبط بحسابك." : "لا يوجد أبناء مسجّلون بعد."}</p>
          </div>
        </main>
      </Shell>
    );
  }

  const todayInRiyadh = getRiyadhCalendarDate(new Date());
  const weekAgoInRiyadh = addRiyadhCalendarDays(todayInRiyadh, -7);
  const weekAgoStr = formatRiyadhCalendarDate(weekAgoInRiyadh);
  const createdAfter = riyadhWallClockToUtcInstant(weekAgoInRiyadh, 0, 0).toISOString();

  // الحضور خلال الأسبوع
  const { data: subs } = await supabase.from("subscriptions").select("cohort_id").eq("child_id", firstChild.id).eq("status", "active");
  const cohortIds = (subs ?? []).map((s) => s.cohort_id).filter(Boolean) as string[];

  const { data: weekSessions } = cohortIds.length
    ? await supabase.from("sessions").select("id").in("cohort_id", cohortIds).gte("session_date", weekAgoStr)
    : { data: [] };
  const sessionIds = (weekSessions ?? []).map((s) => s.id);

  const { data: attendanceRows } = sessionIds.length
    ? await supabase.from("attendance").select("status").eq("child_id", firstChild.id).in("session_id", sessionIds)
    : { data: [] };
  const attendedCount = (attendanceRows ?? []).filter((a) => a.status === "present").length;

  // المهام
  const { data: taskRows } = await supabase
    .from("daily_tasks")
    .select("status")
    .eq("child_id", firstChild.id)
    .gte("created_at", createdAfter);
  const doneTasks = (taskRows ?? []).filter((t) => t.status === "done").length;

  // هدف الأسبوع
  const { data: goal } = await supabase
    .from("weekly_goals")
    .select("title, status")
    .eq("child_id", firstChild.id)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  const goalStatusLabel: Record<string, string> = {
    achieved: "تحقّق ✓",
    partially_achieved: "تحقّق جزئيًا",
    active: "قيد التنفيذ",
    carried_forward: "مُرحّل للأسبوع القادم",
    cancelled: "—",
  };

  // أقوى تقدم / يحتاج متابعة (من آخر نقطتَي تتبع)
  const { data: snapshots } = await supabase
    .from("child_progress_snapshots")
    .select("*")
    .eq("child_id", firstChild.id)
    .order("snapshot_date", { ascending: true });

  let strongest: string | null = null;
  let weakest: string | null = null;
  if (snapshots && snapshots.length >= 2) {
    const first = snapshots[0] as ProgressSnapshot;
    const latest = snapshots[snapshots.length - 1] as ProgressSnapshot;
    let bestDelta = -Infinity;
    let worstDelta = Infinity;
    for (const key of Object.keys(dimLabels) as (keyof ProgressSnapshot)[]) {
      const firstScore = first[key];
      const latestScore = latest[key];
      if (firstScore == null || latestScore == null) continue;
      const delta = latestScore - firstScore;
      if (delta > bestDelta) { bestDelta = delta; strongest = dimLabels[key]; }
      if (delta < worstDelta) { worstDelta = delta; weakest = dimLabels[key]; }
    }
  }

  // الاستقلالية
  const { data: independence } = await supabase
    .from("independence_assessments")
    .select("total_score")
    .eq("child_id", firstChild.id)
    .order("assessment_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  // تاريخ الجاهزية للغد
  const { data: readinessRows } = await supabase
    .from("daily_pulse_reports")
    .select("readiness_status")
    .eq("child_id", firstChild.id)
    .gte("created_at", createdAfter);
  const readyCount = (readinessRows ?? []).filter((r) => r.readiness_status === "ready").length;

  // آخر توصية معلم
  const { data: recommendation } = await supabase
    .from("recommendations")
    .select("reason")
    .eq("child_id", firstChild.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">خُطى الأسبوعي</span>
          <h1 className="title" style={{ fontSize: 34 }}>{firstChild.first_name}</h1>
          {(children ?? []).length > 1 && <ParentChildTabs children={children ?? []} selectedId={firstChild.id} basePath="/parent/reports/weekly" />}
          <p className="lead">
            الفترة: {weekAgoStr} — {formatRiyadhCalendarDate(todayInRiyadh)}
          </p>

          <div className="dashcard">
            <div className="taskline"><span>الحضور</span><span>{attendedCount} / {sessionIds.length}</span></div>
            <div className="taskline"><span>المهام</span><span>{doneTasks} / {(taskRows ?? []).length}</span></div>
            <div className="taskline">
              <span>هدف الأسبوع</span>
              <span>{goal ? `${goal.title} — ${goalStatusLabel[goal.status] ?? goal.status}` : "لم يُحدَّد"}</span>
            </div>
            <div className="taskline"><span>أقوى تقدم</span><span>{strongest ?? "لا توجد بيانات كافية بعد"}</span></div>
            <div className="taskline"><span>يحتاج متابعة</span><span>{weakest ?? "لا توجد بيانات كافية بعد"}</span></div>
            <div className="taskline"><span>الاستقلالية</span><span>{independence ? `${independence.total_score}%` : "—"}</span></div>
            <div className="taskline"><span>جاهزية الغد (هذا الأسبوع)</span><span>{readyCount} / {(readinessRows ?? []).length}</span></div>
          </div>

          <div className="summary" style={{ marginTop: 20 }}>
            <strong>توصية خُطى: </strong>
            <span>{recommendation ? recommendation.reason : "لا توجد توصية جديدة هذا الأسبوع — الأداء مستقر."}</span>
          </div>
        </div>
      </main>
    </Shell>
  );
}
