import Link from "next/link";
import Shell from "@/components/Shell";
import CohortOperationsForm from "./CohortOperationsForm";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { formatSeatCount } from "@/lib/plan-display";

// حالة التسجيل المعروضة مشتقة دائمًا، لا تُختار يدويًا: closed تعني مغلق يدويًا، seats<=0 مع
// open تعني "مكتملة" تلقائيًا، وإلا "متاحة" — لا قيمة "full" منفصلة تُخزَّن أو تُختار من الإدارة.
function registrationLabel(status: string, seatsAvailable: number): string {
  if (status === "full") return "⚠ حالة قديمة (full) — تحتاج تصحيح: اختر \"متاح للتسجيل\" لتحديثها";
  if (status === "closed") return "التسجيل مغلق";
  if (seatsAvailable <= 0) return "مكتملة";
  return "متاحة";
}

type CohortRow = { id: string; title: string; capacity: number; status: string; meeting_url: string | null; teacher_id: string | null };
type CohortRowWithCount = CohortRow & { activeCount: number };

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
    .in("status", ["open", "closed", "full"]); // "full" هنا Legacy فقط — القيمة الجديدة "مكتملة"
    // مشتقة دائمًا من السعة الفعلية، لا تُخزَّن. نعرض أي صف قديم لا يزال full ليتمكّن الأدمن من
    // إصلاحه مباشرة (اختيار "متاح للتسجيل" يُصحِّحه فورًا) بدل أن يختفي بلا إمكانية إدارة.
  const { data: teachers } = await admin.from("teachers").select("id, full_name").eq("active", true);

  const rows = await Promise.all(
    (cohorts ?? []).map(async (c: CohortRow) => {
      // نفس دالة الاحتساب المركزية الواحدة (cohort_occupied_seats) المستخدَمة في كل مكان آخر
      // فعليًا (cohort_available_seats، public_cohorts_catalog، enroll_subscription_atomic،
      // admin_update_cohort_operations_atomic) — لا صيغة مكرَّرة هنا قد تنحرف عنها لاحقًا.
      const { data: occupiedCount } = await admin.rpc("cohort_occupied_seats", { p_cohort_id: c.id });
      return { ...c, activeCount: occupiedCount ?? 0 };
    })
  );

  const missingOps = rows.filter((r: CohortRowWithCount) => !r.meeting_url || !r.teacher_id);
  const singleStudentCohorts = rows.filter((r: CohortRowWithCount) => r.activeCount === 1);
  const otherCohorts = rows.filter((r: CohortRowWithCount) => r.activeCount !== 1);

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
              {missingOps.map((c: CohortRowWithCount) => (
                <div key={c.id} style={{ borderBottom: "1px solid var(--line)", padding: "12px 0" }}>
                  <div className="taskline" style={{ borderBottom: 0, padding: 0 }}>
                    <span>{c.title}</span>
                    <span>{registrationLabel(c.status, c.capacity - c.activeCount)}</span>
                  </div>
                  <CohortOperationsForm
                    cohortId={c.id}
                    currentMeetingUrl={c.meeting_url}
                    currentTeacherId={c.teacher_id}
                    currentCapacity={c.capacity}
                    currentStatus={c.status}
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
              {singleStudentCohorts.map((c: CohortRowWithCount) => (
                <div className="taskline" key={c.id}>
                  <span>{c.title}</span>
                  <span>طالب واحد / سعة {c.capacity}</span>
                </div>
              ))}
            </div>
          )}

          <div className="dashcard" style={{ marginTop: 20 }}>
            <b>كل المجموعات النشطة</b>
            {otherCohorts.map((c: CohortRowWithCount) => (
              <div key={c.id} style={{ borderBottom: "1px solid var(--line)", padding: "12px 0" }}>
                <div className="taskline" style={{ borderBottom: 0, padding: 0 }}>
                  <span>{c.title}</span>
                  <span>
                    المسجلون: {c.activeCount} من {formatSeatCount(c.capacity)} — {registrationLabel(c.status, c.capacity - c.activeCount)}
                  </span>
                </div>
                <CohortOperationsForm
                  cohortId={c.id}
                  currentMeetingUrl={c.meeting_url}
                  currentTeacherId={c.teacher_id}
                  currentCapacity={c.capacity}
                  currentStatus={c.status}
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
