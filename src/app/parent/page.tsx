import Link from "next/link";
import Shell from "@/components/Shell";
import { resolveParentContext } from "@/lib/pilot-parent";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import PilotLogoutButton from "./PilotLogoutButton";

const links = [
  ["الأبناء", "/parent/children"],
  ["الجدول", "/parent/schedule"],
  ["التقارير", "/parent/reports"],
  ["الرسائل", "/parent/messages"],
  ["التوصيات", "/parent/recommendations"],
  ["الاشتراك", "/parent/subscriptions"],
];
// "المدفوعات" (/parent/payments) أُزيلت من هذه القائمة عمدًا — الصفحة لا تزال "قيد التطوير"
// فعليًا (تحقّق مباشر من محتواها)، وتفاصيل الاشتراك/السعر المتاحة فعليًا موجودة بالفعل في
// "الاشتراك" أعلاه. المسار نفسه لم يُحذَف، فقط أُزيل من التنقّل الأساسي لولي الأمر.

export default async function P() {
  const context = await resolveParentContext();

  if (!context) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <span className="badge">تسجيل الدخول مطلوب</span>
            <h1 className="title" style={{ fontSize: 32, marginTop: 16 }}>لوحة ولي الأمر</h1>
            <p className="lead">سجّل الدخول برقم جوالك لمتابعة أبنائك.</p>
            <Link className="btn" href="/login">تسجيل الدخول ←</Link>
          </div>
        </main>
      </Shell>
    );
  }

  // بعد التحقق من الهوية (جلسة Supabase حقيقية أو جلسة Pilot موقَّعة) نقرأ البيانات عبر
  // service_role بفلترة صريحة بـ parentId المُتحقَّق منه أعلاه فقط — نفس نمط الأمان المستخدم
  // في مسارات API الحساسة في هذا المشروع (تفويض أولًا، ثم قراءة مُقيَّدة صراحةً، لا اعتماد
  // ضمني على RLS وحدها التي لا تغطي مسار Pilot أصلًا).
  const admin = createSupabaseAdminClient();
  const parent = { id: context.parentId, full_name: context.fullName };

  const { data: children } = await admin.from("children").select("id, first_name").eq("parent_id", parent.id);

  const firstChild = children?.[0] ?? null;

  const { data: tasks } = firstChild
    ? await admin.from("daily_tasks").select("title, status").eq("child_id", firstChild.id).order("created_at", { ascending: false }).limit(5)
    : { data: [] };

  const { data: recommendation } = firstChild
    ? await admin.from("recommendations").select("reason").eq("child_id", firstChild.id).eq("status", "open").limit(1).maybeSingle()
    : { data: null };

  const { data: pulse } = firstChild
    ? await admin
        .from("daily_pulse_reports")
        .select("tasks_completed, independence_rating, focus_rating, tomorrow_readiness, readiness_status, remaining_review, created_at")
        .eq("child_id", firstChild.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: weeklyGoal } = firstChild
    ? await admin
        .from("weekly_goals")
        .select("title, status, progress")
        .eq("child_id", firstChild.id)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: latestIndependence } = firstChild
    ? await admin
        .from("independence_assessments")
        .select("total_score")
        .eq("child_id", firstChild.id)
        .order("assessment_date", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const readinessLabel: Record<string, string> = {
    ready: "جاهز ✓",
    needs_light_review: "يحتاج مراجعة خفيفة",
    needs_attention: "يحتاج انتباهًا",
  };
  const goalStatusLabel: Record<string, string> = {
    achieved: "تحققت ✓",
    active: "قيد التنفيذ",
    partially_achieved: "تحققت جزئيًا",
    carried_forward: "يُرحَّل للأسبوع القادم",
  };

  return (
    <Shell>
      <main className="section">
        <div className="app-dashboard">
          {context.isPilot && (
            <div className="badge" style={{ marginBottom: 16 }}>
              وضع تجريبي — بيانات تجريبية
              <PilotLogoutButton />
            </div>
          )}
          <h1 className="title" style={{ fontSize: "clamp(26px,3.6vw,36px)" }}>
            مرحبًا {parent?.full_name ?? ""}
            {firstChild ? ` — هذه خُطى ${firstChild.first_name} هذا الأسبوع.` : ""}
          </h1>

          {!firstChild ? (
            <div className="dashcard" style={{ marginTop: 20 }}>
              <p>لا يوجد أبناء مسجّلون بعد على هذا الحساب.</p>
              <Link className="btn" href="/motabaa/plans">تسجيل طفل ←</Link>
            </div>
          ) : (
            <div className="app-dashboard-grid">
              {/* العمود الرئيسي: بطاقة الإنجاز اليومية كعنصر Hero */}
              <div>
                {pulse ? (
                  <div className="dashcard next-session-hero">
                    <span className="badge">بطاقة الإنجاز اليومية</span>
                    <p style={{ color: "var(--gray)", marginTop: 8 }}>
                      آخر تحديث: {new Date(pulse.created_at).toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "short" })}
                    </p>
                    {(pulse.tasks_completed ?? []).length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        {(pulse.tasks_completed as string[]).map((t, i) => (
                          <div className="taskline" key={i}>
                            <span className="ok">✓</span>
                            <span>{t}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="skillbars" style={{ marginTop: 16 }}>
                      <div className="skillbar">
                        <b><span>مؤشر الاستقلالية</span><span>{pulse.independence_rating ?? "—"} / 5</span></b>
                        <div className="skillbar-track">
                          <div style={{ width: `${((pulse.independence_rating ?? 0) / 5) * 100}%` }} />
                        </div>
                      </div>
                      <div className="skillbar">
                        <b><span>التركيز</span><span>{pulse.focus_rating ?? "—"} / 5</span></b>
                        <div className="skillbar-track">
                          <div style={{ width: `${((pulse.focus_rating ?? 0) / 5) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                    {pulse.readiness_status ? (
                      <p style={{ marginTop: 14 }}>
                        <b>الجاهزية للغد: </b>
                        {readinessLabel[pulse.readiness_status] ?? pulse.readiness_status}
                        {pulse.remaining_review ? ` — ${pulse.remaining_review}` : ""}
                      </p>
                    ) : pulse.tomorrow_readiness ? (
                      <p style={{ marginTop: 14 }}>
                        <b>الجاهزية للغد: </b>
                        {pulse.tomorrow_readiness}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="dashcard" style={{ textAlign: "center", padding: "36px 24px" }}>
                    <p style={{ margin: 0, color: "var(--gray)" }}>لا توجد بطاقة إنجاز بعد — ستظهر هنا بعد أول جلسة.</p>
                  </div>
                )}

                <div style={{ marginTop: 20 }}>
                  <div className="dashcard">
                    <b>ماذا أنجز مؤخرًا؟</b>
                    {tasks && tasks.length > 0 ? (
                      tasks.map((t: { title: string; status: string }, i: number) => (
                        <div className="taskline" key={i}>
                          <span className={t.status === "done" ? "ok" : "warn"}>{t.status === "done" ? "✓" : "△"}</span>
                          <span>{t.title}</span>
                        </div>
                      ))
                    ) : (
                      <p style={{ color: "var(--gray)" }}>لا توجد مهام مسجّلة بعد.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* العمود الجانبي: خطوة الأسبوع، مؤشر الاستقلالية، التوصيات، تنقّل سريع */}
              <div className="app-dashboard-side">
                <div className="dashcard">
                  <b>خطوة هذا الأسبوع</b>
                  {weeklyGoal ? (
                    <>
                      <p style={{ marginTop: 8 }}>{weeklyGoal.title}</p>
                      <span className="badge">{goalStatusLabel[weeklyGoal.status] ?? weeklyGoal.status}</span>
                    </>
                  ) : (
                    <p style={{ color: "var(--gray)" }}>لم يُحدَّد هدف لهذا الأسبوع بعد.</p>
                  )}
                </div>
                <div className="dashcard">
                  <b>KHOTA Independence Score</b>
                  {latestIndependence ? (
                    <>
                      <strong style={{ display: "block", fontSize: 32, color: "var(--t)", marginTop: 8 }}>
                        {latestIndependence.total_score}%
                      </strong>
                      <p style={{ color: "var(--gray)", fontSize: 13 }}>مؤشر متابعة داخلي — وليس قياسًا معياريًا</p>
                    </>
                  ) : (
                    <p style={{ color: "var(--gray)" }}>لا يوجد تقييم استقلالية بعد.</p>
                  )}
                </div>
                <div className="dashcard">
                  <b>توصية مفتوحة</b>
                  {recommendation ? (
                    <>
                      <p style={{ color: "var(--gray)" }}>{recommendation.reason}</p>
                      <Link className="btn small" href="/parent/recommendations">عرض التوصية ←</Link>
                    </>
                  ) : (
                    <p style={{ color: "var(--gray)" }}>لا توجد توصيات مفتوحة حاليًا.</p>
                  )}
                </div>
                <div className="dashcard">
                  <b>روابط سريعة</b>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                    {links.map((l) => (
                      <Link key={l[1]} href={l[1]} style={{ color: "var(--t)", fontWeight: 700, fontSize: 14.5 }}>{l[0]} ←</Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </Shell>
  );
}
