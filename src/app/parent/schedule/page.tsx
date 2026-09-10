import Link from "next/link";
import Shell from "@/components/Shell";
import RedeemCreditCard from "./RedeemCreditCard";
import ParentDashboardHeader from "./ParentDashboardHeader";
import NextSessionCard, { type NextSession } from "./NextSessionCard";
import WeeklySummary from "./WeeklySummary";
import ChildJourney, { type PulseSnapshot } from "./ChildJourney";
import UpcomingSessions, { type SessionRow } from "./UpcomingSessions";
import { resolveParentContext } from "@/lib/pilot-parent";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { formatDaysList, formatSessionCount } from "@/lib/plan-display";

// حدود الأسبوع الحالي بتوقيت الرياض (UTC+3 بلا توقيت صيفي — إزاحة ثابتة دائمًا في السعودية).
function riyadhWeekStartUTC(now: Date): Date {
  const shifted = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const dow = shifted.getUTCDay(); // 0 = الأحد
  const riyadhMidnightShifted = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - dow, 0, 0, 0));
  return new Date(riyadhMidnightShifted.getTime() - 3 * 60 * 60 * 1000);
}

export default async function P() {
  let context;
  try {
    context = await resolveParentContext();
  } catch {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <p className="lead">تعذّر تحميل بياناتك الآن.</p>
            <Link className="btn" href="/parent/schedule">إعادة المحاولة</Link>
          </div>
        </main>
      </Shell>
    );
  }

  if (!context) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <span className="badge">تسجيل الدخول مطلوب</span>
            <h1 className="title" style={{ fontSize: 32, marginTop: 16 }}>لوحة ولي الأمر</h1>
            <Link className="btn" href="/login">تسجيل الدخول ←</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const admin = createSupabaseAdminClient();
  const parentId = context.parentId;

  const { data: children } = await admin.from("children").select("id, first_name").eq("parent_id", parentId);
  const childIds = (children ?? []).map((c) => c.id);
  const childName = new Map((children ?? []).map((c) => [c.id, c.first_name]));

  const { data: subs } = childIds.length
    ? await admin
        .from("subscriptions")
        .select("child_id, cohort_id, plans(name, price_sar, sessions_per_month), cohorts(days_of_week)")
        .in("child_id", childIds)
        .eq("status", "active")
    : { data: [] };

  const cohortIds = [...new Set((subs ?? []).map((s) => s.cohort_id).filter(Boolean))] as string[];
  const childByCohort = new Map((subs ?? []).map((s) => [s.cohort_id, s.child_id]));

  // ملخّص "الخطة الحالية" — من أول اشتراك فعّال يحمل بيانات خطة كاملة، لعرض متّسق مع بقية
  // الرحلة (نفس الحقول: الخطة/الأيام/عدد الجلسات/السعر) بلا أي تغيير في منطق الاشتراكات نفسه.
  const firstSubWithPlan: any = (subs ?? []).find((s: any) => s.plans);
  const currentPlan = firstSubWithPlan
    ? {
        name: firstSubWithPlan.plans?.name ?? null,
        days: firstSubWithPlan.cohorts?.days_of_week ? formatDaysList(firstSubWithPlan.cohorts.days_of_week as number[]) : null,
        sessionsPerMonth: firstSubWithPlan.plans?.sessions_per_month ?? null,
        priceSar: firstSubWithPlan.plans?.price_sar ?? null,
      }
    : null;

  // لا يوجد اشتراك فعّال إطلاقًا — Empty State مخصَّص، وليس لوحة فارغة بلا تفسير
  if (cohortIds.length === 0) {
    return (
      <Shell>
        <main className="section">
          <div className="container">
            <ParentDashboardHeader parentName={context.isPilot ? null : context.fullName} isPilot={context.isPilot} />
            <div className="dashcard" style={{ textAlign: "center", padding: "36px 24px" }}>
              <p style={{ margin: 0, fontWeight: 800 }}>لا يوجد اشتراك نشط حاليًا.</p>
              <Link className="btn" href="/motabaa/plans" style={{ marginTop: 16, display: "inline-flex" }}>تعرّف على خُطى ←</Link>
            </div>
          </div>
        </main>
      </Shell>
    );
  }

  const now = new Date();

  const { data: rawSessions } = await admin
    .from("sessions")
    .select("id, cohort_id, starts_at, ends_at, status, meeting_url, cohorts(title)")
    .in("cohort_id", cohortIds)
    .gte("starts_at", new Date(now.getTime() - 60 * 60 * 1000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(40);

  // Defensive dedup في طبقة العرض — ليس بديلًا عن الإصلاح الفعلي (قيد UNIQUE + upsert في
  // /api/payment/confirm)، بل حماية إضافية بسيطة بمفتاح واضح (cohort_id + starts_at) تحسبًا
  // لأي بيانات قديمة لم تشملها Migration التنظيف، أو أي مصدر تكرار مستقبلي غير متوقَّع.
  const seen = new Set<string>();
  const sessions = (rawSessions ?? []).filter((s: any) => {
    const key = `${s.cohort_id}:${s.starts_at}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const upcoming = sessions.filter((s: any) => s.status === "scheduled" && new Date(s.starts_at) >= now);
  const nextRow: any = upcoming[0] ?? null;

  const nextSession: NextSession | null = nextRow
    ? {
        id: nextRow.id,
        cohortId: nextRow.cohort_id,
        childId: childByCohort.get(nextRow.cohort_id) ?? null,
        childName: (() => {
          const cid = childByCohort.get(nextRow.cohort_id);
          return cid ? childName.get(cid) ?? null : null;
        })(),
        programTitle: nextRow.cohorts?.title ?? null,
        startsAt: nextRow.starts_at,
        endsAt: nextRow.ends_at,
        meetingUrl: nextRow.meeting_url,
      }
    : null;

  const upcomingRows: SessionRow[] = upcoming.slice(1).map((s: any) => {
    const cid = childByCohort.get(s.cohort_id);
    return {
      id: s.id,
      startsAt: s.starts_at,
      programTitle: s.cohorts?.title ?? null,
      childName: cid ? childName.get(cid) ?? null : null,
      status: s.status,
    };
  });

  // ---------- ملخص هذا الأسبوع (بيانات حقيقية فقط) ----------
  const weekStart = riyadhWeekStartUTC(now);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekSessions = sessions.filter((s: any) => {
    const t = new Date(s.starts_at);
    return t >= weekStart && t < weekEnd;
  });

  let weeklyStats = null;
  if (weekSessions.length > 0) {
    const weekSessionIds = weekSessions.map((s: any) => s.id);
    const { data: weekAttendance } = await admin
      .from("attendance")
      .select("session_id, status")
      .in("session_id", weekSessionIds);
    const attendedCount = (weekAttendance ?? []).filter((a) => a.status === "present").length;
    const upcomingThisWeek = weekSessions.filter((s: any) => s.status === "scheduled" && new Date(s.starts_at) >= now).length;
    weeklyStats = { totalSessions: weekSessions.length, attended: attendedCount, upcoming: upcomingThisWeek };
  }

  // ---------- رحلة الطفل (أحدث بطاقة إنجاز حقيقية لأول طفل) ----------
  const firstChildId = children?.[0]?.id ?? null;
  const { data: pulseRow } = firstChildId
    ? await admin
        .from("daily_pulse_reports")
        .select("tasks_completed, readiness_status, remaining_review, created_at")
        .eq("child_id", firstChildId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const pulse: PulseSnapshot = pulseRow
    ? {
        tasksCompletedCount: (pulseRow.tasks_completed ?? []).length,
        readinessStatus: pulseRow.readiness_status,
        remainingReview: pulseRow.remaining_review,
        updatedAt: pulseRow.created_at,
      }
    : null;

  // ---------- أرصدة التعويض المتاحة (ميزة قائمة، بلا تغيير في منطقها) ----------
  const { data: credits } = childIds.length
    ? await admin.from("makeup_credits").select("id, child_id, expires_at, status").in("child_id", childIds).eq("status", "available")
    : { data: [] };

  const { data: eligibleSessions } = (credits ?? []).length
    ? await admin
        .from("sessions")
        .select("id, starts_at, cohorts(title)")
        .eq("makeup_eligible", true)
        .eq("status", "scheduled")
        .gte("starts_at", now.toISOString())
        .order("starts_at", { ascending: true })
        .limit(10)
    : { data: [] };

  const eligibleList = (eligibleSessions ?? []).map((s: any) => ({
    id: s.id,
    startsAt: s.starts_at,
    title: s.cohorts?.title ?? "جلسة تعويضية",
  }));

  return (
    <Shell>
      <main className="section">
        <div className="app-dashboard">
          <ParentDashboardHeader parentName={context.isPilot ? null : context.fullName} isPilot={context.isPilot} />

          <div className="app-dashboard-grid">
            {/* العمود الرئيسي (الأوسع): الجلسة القادمة كعنصر Hero، ثم الجلسات القادمة كـTimeline */}
            <div>
              <NextSessionCard session={nextSession} />
              <div style={{ marginTop: 20 }}>
                <UpcomingSessions sessions={upcomingRows} />
              </div>
            </div>

            {/* العمود الجانبي: ملخص الأسبوع + رحلة الطفل + أرصدة التعويض إن وُجدت */}
            <div className="app-dashboard-side">
              {currentPlan && (
                <div className="dashcard">
                  <b>الخطة الحالية</b>
                  <div style={{ marginTop: 10 }}>
                    <div className="taskline" style={{ justifyContent: "space-between" }}><span style={{ color: "var(--gray)" }}>الخطة</span><span>{currentPlan.name ?? "—"}</span></div>
                    {currentPlan.days && <div className="taskline" style={{ justifyContent: "space-between" }}><span style={{ color: "var(--gray)" }}>الأيام</span><span>{currentPlan.days}</span></div>}
                    {currentPlan.sessionsPerMonth && (
                      <div className="taskline" style={{ justifyContent: "space-between" }}><span style={{ color: "var(--gray)" }}>عدد الجلسات</span><span>{formatSessionCount(currentPlan.sessionsPerMonth)} شهريًا</span></div>
                    )}
                    {currentPlan.priceSar && <div className="taskline" style={{ justifyContent: "space-between" }}><span style={{ color: "var(--gray)" }}>السعر</span><span style={{ fontWeight: 800 }}>{currentPlan.priceSar} ر.س / شهريًا</span></div>}
                  </div>
                </div>
              )}
              <WeeklySummary stats={weeklyStats} />
              <ChildJourney pulse={pulse} />
              {(credits ?? []).map((c) => (
                <RedeemCreditCard
                  key={c.id}
                  creditId={c.id}
                  childName={childName.get(c.child_id) ?? "طفلك"}
                  expiresAt={c.expires_at}
                  eligibleSessions={eligibleList}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </Shell>
  );
}
