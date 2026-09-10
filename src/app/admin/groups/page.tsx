import Link from "next/link";
import Shell from "@/components/Shell";
import CohortOperationsForm from "./CohortOperationsForm";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { formatSeatCount } from "@/lib/plan-display";

export default async function P() {
  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  const { data: adminRow } = user
    ? await authed.from("admins").select("id").eq("user_id", user.id).maybeSingle()
    : { data: null };

  if (!adminRow) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <span className="badge">غير مصرَّح</span>
            <Link className="btn outline" href="/">← الرئيسية</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: cohorts } = await admin
    .from("cohorts")
    .select("id, title, capacity, status, meeting_url, teacher_id")
    .neq("status", "closed");
  const { data: teachers } = await admin.from("teachers").select("id, full_name").eq("active", true);

  const rows = await Promise.all(
    (cohorts ?? []).map(async (c) => {
      // الطلاب النشطون فعليًا فقط — وليس إجمالي الاشتراكات التاريخية لهذه المجموعة
      const { count } = await admin
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("cohort_id", c.id)
        .eq("status", "active");
      return { ...c, activeCount: count ?? 0 };
    })
  );

  const missingOps = rows.filter((r) => !r.meeting_url || !r.teacher_id);
  const singleStudentCohorts = rows.filter((r) => r.activeCount === 1);
  const otherCohorts = rows.filter((r) => r.activeCount !== 1);

  return (
    <Shell>
      <main className="section">
        <div className="container">
          <span className="eyebrow">لوحة الإدارة</span>
          <h1 className="title" style={{ fontSize: 34 }}>المجموعات</h1>

          {missingOps.length > 0 && (
            <div className="dashcard" style={{ marginTop: 20, borderColor: "var(--g)" }}>
              <span className="badge" style={{ color: "var(--n)" }}>يحتاج بيانات تشغيلية</span>
              <p style={{ color: "var(--gray)", marginTop: 8 }}>
                مجموعات بلا رابط جلسة و/أو معلم مُسنَد — لن تعمل جلساتها الفعلية بدون إكمالها.
              </p>
              {missingOps.map((c) => (
                <div key={c.id} style={{ borderBottom: "1px solid var(--line)", padding: "12px 0" }}>
                  <div className="taskline" style={{ borderBottom: 0, padding: 0 }}>
                    <span>{c.title}</span>
                  </div>
                  <CohortOperationsForm
                    cohortId={c.id}
                    currentMeetingUrl={c.meeting_url}
                    currentTeacherId={c.teacher_id}
                    teachers={teachers ?? []}
                  />
                </div>
              ))}
            </div>
          )}

          {singleStudentCohorts.length > 0 && (
            <div className="dashcard" style={{ marginTop: 20, borderColor: "var(--p)" }}>
              <span className="badge" style={{ color: "var(--p)" }}>تنبيه — طالب نشط واحد فقط</span>
              <p style={{ color: "var(--gray)", marginTop: 8 }}>
                هذه مجموعات تستحق دراسة (دمج، إعادة جدولة، أو تعديل) — لا يوجد إجراء تلقائي، القرار للإدارة.
              </p>
              {singleStudentCohorts.map((c) => (
                <div className="taskline" key={c.id}>
                  <span>{c.title}</span>
                  <span>طالب واحد / سعة {c.capacity}</span>
                </div>
              ))}
            </div>
          )}

          <div className="dashcard" style={{ marginTop: 20 }}>
            <b>كل المجموعات النشطة</b>
            {otherCohorts.map((c) => (
              <div key={c.id} style={{ borderBottom: "1px solid var(--line)", padding: "12px 0" }}>
                <div className="taskline" style={{ borderBottom: 0, padding: 0 }}>
                  <span>{c.title}</span>
                  <span>{c.activeCount} من {formatSeatCount(c.capacity)}</span>
                </div>
                <CohortOperationsForm
                  cohortId={c.id}
                  currentMeetingUrl={c.meeting_url}
                  currentTeacherId={c.teacher_id}
                  teachers={teachers ?? []}
                />
              </div>
            ))}
          </div>
        </div>
      </main>
    </Shell>
  );
}
