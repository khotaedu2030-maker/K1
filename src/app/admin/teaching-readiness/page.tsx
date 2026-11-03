import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { pilotActivationEnabled } from "@/lib/pilot-activation-config";
import { teachingReadinessIssues, type CohortForTeaching, type PlanForTeaching, type TeacherForTeaching } from "@/lib/teaching-readiness";

const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default async function TeachingReadinessPage() {
  const identity = await getAdminIdentity("cohort.manage");
  if (!identity) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;

  const admin = createSupabaseAdminClient();
  const [cohortResult, teacherResult, planResult, pendingResult, activeResult, sessionResult] = await Promise.all([
    admin.from("cohorts").select("id,title,status,capacity,teacher_id,meeting_url,plan_id,product,days_of_week,start_time,end_time")
      .in("status", ["open", "closed", "full"]).order("title"),
    admin.from("teachers").select("id,full_name,active,user_id").order("full_name"),
    admin.from("plans").select("id,active,product,days_per_week").eq("product", "motabaa"),
    admin.from("subscriptions").select("id,cohort_id", { count: "exact" }).eq("status", "pending_payment"),
    admin.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
    admin.from("sessions").select("id", { count: "exact", head: true }),
  ]);
  const baseLookupFailed = [cohortResult, teacherResult, planResult, pendingResult, activeResult, sessionResult].some((r) => Boolean(r.error));

  const teachers: (TeacherForTeaching & { full_name: string; authLookupFailed: boolean })[] = await Promise.all((teacherResult.data ?? []).map(async (t) => {
    if (!t.user_id) return { ...t, verifiedLogin: false, authLookupFailed: false };
    const { data: authRecord, error: authError } = await admin.auth.admin.getUserById(t.user_id);
    return { ...t, verifiedLogin: Boolean(authRecord.user?.email_confirmed_at), authLookupFailed: Boolean(authError) };
  }));
  const lookupFailed = baseLookupFailed || teachers.some((t) => t.authLookupFailed);
  const teacherById = new Map(teachers.map((t) => [t.id, t]));
  const planById = new Map((planResult.data ?? []).map((p: PlanForTeaching) => [p.id, p]));
  const pendingByCohort = new Map<string, number>();
  for (const sub of pendingResult.data ?? []) {
    if (sub.cohort_id) pendingByCohort.set(sub.cohort_id, (pendingByCohort.get(sub.cohort_id) ?? 0) + 1);
  }
  const groups = (cohortResult.data ?? []) as CohortForTeaching[];
  const groupChecks = groups.map((cohort) => ({
    cohort,
    issues: teachingReadinessIssues(cohort, cohort.teacher_id ? teacherById.get(cohort.teacher_id) ?? null : null,
      cohort.plan_id ? planById.get(cohort.plan_id) ?? null : null),
  }));
  const readyCount = groupChecks.filter((g) => g.issues.length === 0).length;
  const signedInTeacherCount = teachers.filter((t) => Boolean(t.active && t.user_id && t.verifiedLogin)).length;
  const pilotEnabled = pilotActivationEnabled();

  return (
    <AdminShell adminName={identity.full_name} role={identity.role}>
      <div className="admin-page-head">
        <div>
          <h1>جاهزية التشغيل التعليمي</h1>
          <p style={{ color: "var(--gray)", marginTop: 8 }}>
            قائمة تشغيل حقيقية مبنية على المعلم والمجموعة والاشتراكات والجلسات في بيئة الاختبار.
            لا تُفعَّل أي اشتراكات أو مدفوعات من هذه الصفحة.
          </p>
        </div>
      </div>
      {lookupFailed ? (
        <div className="dashcard" role="alert"><b>تعذّر التحقق من بيانات التشغيل</b><p>لن نعتبر أي مجموعة جاهزة حتى تنجح قراءة البيانات. أعد تحديث الصفحة.</p></div>
      ) : (
        <>
          <div className="admin-kpi-grid" style={{ marginBottom: 20 }}>
            <div className="admin-kpi-card"><strong>{signedInTeacherCount}</strong><span>معلمون بحساب موثّق</span></div>
            <div className="admin-kpi-card"><strong>{readyCount}</strong><span>مجموعات مستوفية للمتطلبات</span></div>
            <div className="admin-kpi-card"><strong>{pendingResult.count ?? 0}</strong><span>طلبات تنتظر التفعيل</span></div>
            <div className="admin-kpi-card"><strong>{activeResult.count ?? 0}</strong><span>اشتراكات نشطة</span></div>
            <div className="admin-kpi-card"><strong>{sessionResult.count ?? 0}</strong><span>جلسات أُنشئت</span></div>
          </div>

          <div className="dashcard" style={{ marginBottom: 18 }}>
            <h2 style={{ fontSize: 18 }}>خطوات بدء التشغيل</h2>
            <ol style={{ paddingInlineStart: 22, fontSize: 14, lineHeight: 2 }}>
              <li><Link href="/teach-with-khota">تقديم طلب معلم ببريد مستقل</Link> عن بريدي ولي الأمر والمدير؛ لا تستخدم حساباتهما.</li>
              <li><Link href="/admin/teacher-applications">مراجعة طلب المعلم واعتماده</Link>، ثم <Link href="/admin/teachers">تجهيز حساب دخوله</Link> والتحقق من البريد.</li>
              <li><Link href="/admin/groups">إسناد المعلم للمجموعة وإضافة رابط اجتماع Teams الفعلي</Link>، والتحقق من الأيام والوقت.</li>
              <li><Link href="/admin/pilot-activations">تفعيل تجربة مجانية باعتماد المدير</Link> بعد اكتمال الشروط، دون أي تحصيل مالي.</li>
              <li><Link href="/admin/sessions">مراجعة جدول الجلسات</Link>، ثم اختبار لوحة المعلم والحضور والتقرير وظهور النتائج لولي الأمر.</li>
            </ol>
            {!pilotEnabled && <p role="alert" style={{ color: "var(--p)" }}>ميزة التفعيل التجريبي مغلقة في إعدادات البيئة، ولا يمكن استخدامها الآن.</p>}
          </div>

          <h2 style={{ fontSize: 18, marginBottom: 12 }}>جاهزية المجموعات</h2>
          {groupChecks.length === 0 && <div className="admin-empty-state">لم تُنشأ مجموعات بعد.</div>}
          {groupChecks.map(({ cohort, issues }) => {
            const teacher = cohort.teacher_id ? teacherById.get(cohort.teacher_id) : null;
            const hasPending = pendingByCohort.get(cohort.id) ?? 0;
            const ready = issues.length === 0;
            return (
              <div key={cohort.id} className="dashcard" style={{ marginBottom: 14 }}>
                <div className="row" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <b>{cohort.title}</b>
                  <span className="badge" style={{ color: ready ? "var(--t)" : "var(--p)" }}>{ready ? "مستوفية للشروط الأولية" : "غير جاهزة للتفعيل"}</span>
                </div>
                <p style={{ color: "var(--gray)", fontSize: 13, lineHeight: 1.9, marginTop: 8 }}>
                  السعة: {cohort.capacity} · طلبات معلّقة: {hasPending} ·
                  المعلم: {teacher?.full_name ?? "غير مسند"} ·
                  الأيام: {(cohort.days_of_week ?? []).map((n) => dayNames[n] ?? n).join("، ") || "غير محددة"} ·
                  الوقت: {cohort.start_time?.slice(0, 5) ?? "—"}–{cohort.end_time?.slice(0, 5) ?? "—"} بتوقيت الرياض
                </p>
                {issues.length ? (
                  <ul style={{ paddingInlineStart: 22, fontSize: 13, margin: "10px 0" }} aria-label="النواقص التشغيلية">
                    {issues.map((issue, i) => <li key={i}>{issue}</li>)}
                  </ul>
                ) : (
                  <p style={{ color: "var(--t)", fontSize: 13 }}>جاهزة للفحص النهائي عند التفعيل. سيتم إنشاء الجلسات بعد الاعتماد فقط.</p>
                )}
                <div className="actions" style={{ marginTop: 12 }}>
                  <Link href="/admin/groups" className="btn small outline">إعداد المجموعة</Link>
                  <Link href="/admin/teachers" className="btn small outline">إعداد المعلم</Link>
                  {ready && pilotEnabled && <Link href="/admin/pilot-activations" className="btn small">مراجعة التفعيل</Link>}
                </div>
              </div>
            );
          })}
        </>
      )}
    </AdminShell>
  );
}
