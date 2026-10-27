import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { supabaseRelationOne, type SupabaseRelation } from "@/lib/supabase-relations";
import { pilotActivationEnabled } from "@/lib/pilot-activation-config";
import {
  teachingReadinessIssues,
  type CohortForTeaching,
  type TeacherForTeaching,
  type PlanForTeaching,
} from "@/lib/teaching-readiness";
import ActivateTrialForm from "./ActivateTrialForm";

type PendingTrial = {
  id: string;
  created_at: string | null;
  hold_expires_at: string | null;
  children: SupabaseRelation<{ first_name: string | null; grade: number | null }>;
  parents: SupabaseRelation<{ full_name: string | null }>;
  cohorts: SupabaseRelation<CohortForTeaching>;
};

export default async function PilotActivationAdminPage() {
  const identity = await getAdminIdentity("pilot.activate");
  if (!identity) return (
    <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>
  );

  const enabled = pilotActivationEnabled();
  const admin = createSupabaseAdminClient();
  const { data, error } = enabled ? await admin.from("subscriptions")
    .select("id,created_at,hold_expires_at,children(first_name,grade),parents(full_name),cohorts(id,title,status,capacity,teacher_id,meeting_url,plan_id,product,days_of_week,start_time,end_time)")
    .eq("status", "pending_payment")
    .order("created_at", { ascending: true })
    .limit(50)
    : { data: [], error: null };

  const trials = (data ?? []) as PendingTrial[];
  const teacherIds = [...new Set(trials.map((sub) => supabaseRelationOne(sub.cohorts)?.teacher_id).filter((x): x is string => Boolean(x)))];
  const planIds = [...new Set(trials.map((sub) => supabaseRelationOne(sub.cohorts)?.plan_id).filter((x): x is string => Boolean(x)))];
  const [teacherResult, planResult] = await Promise.all([
    enabled && teacherIds.length
      ? admin.from("teachers").select("id,active,user_id").in("id", teacherIds)
      : Promise.resolve({ data: [] as { id: string; active: boolean | null; user_id: string | null }[], error: null }),
    enabled && planIds.length
      ? admin.from("plans").select("id,active,product,days_per_week").in("id", planIds)
      : Promise.resolve({ data: [] as PlanForTeaching[], error: null }),
  ]);

  // Preflight fails closed on lookup errors, rather than showing a usable
  // activation control. The RPC independently rechecks everything atomically.
  let lookupFailed = Boolean(teacherResult.error || planResult.error);
  const teachers: TeacherForTeaching[] = await Promise.all((teacherResult.data ?? []).map(async (teacher) => {
    if (!teacher.user_id) return { ...teacher, verifiedLogin: false };
    const { data: authRecord, error: authError } = await admin.auth.admin.getUserById(teacher.user_id);
    if (authError) lookupFailed = true;
    return { ...teacher, verifiedLogin: Boolean(authRecord.user?.email_confirmed_at) };
  }));
  const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const planById = new Map((planResult.data ?? []).map((plan) => [plan.id, plan]));

  return (
    <AdminShell adminName={identity.full_name} role={identity.role}>
      <div className="admin-page-head">
        <h1>تفعيل التجربة المجانية</h1>
        <p>تفعيل إداري دون تحصيل أو تسجيل دفعة مالية. الحد الأقصى 20 اشتراكًا؛ كل اعتماد يُسجَّل مع سببه ومعتمده.</p>
      </div>
      <p className="kh-settings-note" style={{ marginBottom: 16 }}>
        <Link href="/admin/teaching-readiness">افتح جاهزية التشغيل التعليمي ←</Link>
        {" "}لتجهيز حساب المعلم وجدول المجموعة ورابط Teams قبل الاعتماد.
      </p>
      {!enabled && <p className="admin-empty-state">التفعيل التجريبي مغلق في هذه البيئة.</p>}
      {enabled && error && <p role="alert" className="admin-empty-state">تعذّر قراءة الاشتراكات. لم تُجرَ أي عملية تفعيل.</p>}
      {enabled && lookupFailed && <p role="alert" className="admin-empty-state">تعذّر التحقق من بيانات المعلمين أو الباقات. تم تعطيل الاعتماد مؤقتًا حتى تنجح القراءة.</p>}
      {enabled && !error && !trials.length && <p className="admin-empty-state">لا توجد طلبات اشتراك معلّقة.</p>}
      {enabled && !error && trials.map((sub) => {
        const child = supabaseRelationOne(sub.children);
        const parent = supabaseRelationOne(sub.parents);
        const cohort = supabaseRelationOne(sub.cohorts);
        const teacher = cohort?.teacher_id ? teacherById.get(cohort.teacher_id) ?? null : null;
        const plan = cohort?.plan_id ? planById.get(cohort.plan_id) ?? null : null;
        const expired = Boolean(sub.hold_expires_at && new Date(sub.hold_expires_at).getTime() <= Date.now());
        const issues = teachingReadinessIssues(cohort ?? null, teacher, plan);
        if (expired) issues.push("انتهت مهلة حجز هذا المقعد.");
        if (lookupFailed) issues.push("تعذّر فحص الجاهزية من قاعدة البيانات.");
        const ready = issues.length === 0;
        return (
          <div key={sub.id} className="dashcard" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(220px,330px)", gap: 18, marginBottom: 14 }}>
            <div>
              <b>{child?.first_name ?? "طالب"} (الصف {child?.grade ?? "—"}) — {parent?.full_name ?? "ولي أمر"}</b>
              <p style={{ margin: "8px 0", color: "var(--gray)" }}>{cohort?.title ?? "مجموعة غير محددة"}</p>
              {ready ? (
                <p style={{ color: "var(--t)", fontSize: 13 }}>الفحوص الأولية مكتملة. سيُعاد التحقق من جميع الشروط داخل قاعدة البيانات عند الاعتماد.</p>
              ) : (
                <div role="status" style={{ fontSize: 13 }}>
                  <b style={{ color: "var(--p)" }}>لا يمكن التفعيل حتى معالجة التالي:</b>
                  <ul style={{ paddingInlineStart: 22, marginTop: 6 }}>
                    {issues.map((issue, i) => <li key={i}>{issue}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <ActivateTrialForm subscriptionId={sub.id} disabled={!ready} />
          </div>
        );
      })}
      {enabled && trials.length === 50 && <p>يُعرض أول 50 طلبًا. قد توجد طلبات أخرى.</p>}
    </AdminShell>
  );
}
