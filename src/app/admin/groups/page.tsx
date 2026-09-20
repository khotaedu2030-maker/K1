import AdminShell from "@/components/AdminShell";
import CohortOperationsForm from "./CohortOperationsForm";
import CreateCohortForm from "./CreateCohortForm";
import { getAdminIdentity } from "@/lib/admin-identity";
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

// Phase 2 — عرض واضح للدورة المرتبطة، أو تصنيف صريح للبيانات القديمة بلا دورة (nullable عمدًا،
// لا backfill تلقائي).
function cycleLabel(cycleName: string | null | undefined): string {
  return cycleName ?? "بيانات سابقة / غير مصنَّفة";
}

type CohortRow = {
  id: string;
  title: string;
  capacity: number;
  status: string;
  meeting_url: string | null;
  teacher_id: string | null;
  cycle_id: string | null;
  cycles: { name: string }[] | null;
};
type CohortRowWithCount = CohortRow & { activeCount: number };

export default async function P() {
  const adminIdentity = await getAdminIdentity();

  if (!adminIdentity) {
    return (
      <div className="placeholder-page">
        <div className="narrow">
          <span className="badge">غير مصرَّح</span>
        </div>
      </div>
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: cohorts } = await admin
    .from("cohorts")
    .select("id, title, capacity, status, meeting_url, teacher_id, cycle_id, cycles(name)")
    .in("status", ["open", "closed", "full"]) as { data: CohortRow[] | null };
    // مشتقة دائمًا من السعة الفعلية، لا تُخزَّن. نعرض أي صف قديم لا يزال full ليتمكّن الأدمن من
    // إصلاحه مباشرة (اختيار "متاح للتسجيل" يُصحِّحه فورًا) بدل أن يختفي بلا إمكانية إدارة.
  const { data: teachers } = await admin.from("teachers").select("id, full_name").eq("active", true);
  const { data: motabaaPlans } = await admin
    .from("plans")
    .select("id, name, days_per_week")
    .eq("product", "motabaa")
    .eq("active", true);
  const { data: allCycles } = await admin.from("cycles").select("id, name, enabled_grade_bands").order("created_at", { ascending: false });
  // فلترة عرضية فقط (تجربة مستخدم) — الدورات التي لا تشمل المرحلة 4-6 لا تُعرَض كخيار أصلًا،
  // لكن الحماية الفعلية الوحيدة المُعتمَد عليها أمنيًا هي التحقق server-side بـ/api/admin/cohorts.
  const cycles = (allCycles ?? []).filter((c: { enabled_grade_bands: string[] | null }) => ((c.enabled_grade_bands as string[] | null) ?? []).includes("4-6"));

  // Phase 3 — سعة افتراضية عند إنشاء مجموعة جديدة تُقرَأ من الإعدادات، لا مُشفَّرة. القيمة 4
  // تبقى الافتراضي الآمن لو الجدول/الصف غير متاح بعد (يطابق السلوك المُشفَّر سابقًا حرفيًا).
  // Phase 9 Step 9.2A — يقرأ admin_platform_settings، لا platform_settings (جدول إنتاج قديم
  // منفصل غير مرتبط، بصيغة key/value — راجع migrations/20261002_phase9_production_reconciliation.sql).
  const { data: settingsRow } = await admin.from("admin_platform_settings").select("default_capacity_4_6").eq("id", true).maybeSingle();
  const defaultCapacity = settingsRow?.default_capacity_4_6 ?? 4;

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
    <AdminShell adminName={adminIdentity.full_name}>
      <div className="admin-page-head">
        <h1>المجموعات</h1>
      </div>

      <div style={{ marginBottom: 20 }}>
        <CreateCohortForm teachers={teachers ?? []} plans={motabaaPlans ?? []} cycles={cycles ?? []} defaultCapacity={defaultCapacity} />
      </div>

      {missingOps.length > 0 && (
        <div className="dashcard" style={{ marginBottom: 20, borderColor: "var(--g)" }}>
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
        <div className="dashcard" style={{ marginBottom: 20, borderColor: "var(--p)" }}>
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

      <div className="dashcard">
        <b>كل المجموعات النشطة</b>
        {otherCohorts.map((c: CohortRowWithCount) => (
          <div key={c.id} style={{ borderBottom: "1px solid var(--line)", padding: "12px 0" }}>
            <div className="taskline" style={{ borderBottom: 0, padding: 0 }}>
              <span>{c.title}</span>
              <span>
                المسجلون: {c.activeCount} من {formatSeatCount(c.capacity)} — {registrationLabel(c.status, c.capacity - c.activeCount)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 8 }}>الدورة: {cycleLabel(c.cycles?.[0]?.name ?? null)}</div>
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
    </AdminShell>
  );
}
