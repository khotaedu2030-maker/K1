import { Suspense } from "react";
import Shell from "@/components/Shell";
import EnrollForm, { type AuthenticatedParent } from "./EnrollForm";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getGradeLabelArabic, parseAndValidateGrade } from "@/lib/grade-config";
import { formatDaysList, formatCohortDisplayName } from "@/lib/plan-display";
import { supabaseRelationOne, type SupabaseRelation } from "@/lib/supabase-relations";
import { resolveGradeBand } from "@/lib/grade-config";
import { getRuntimeSettings } from "@/lib/platform-settings";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { toSaudiLocalDisplayPhone } from "@/lib/phone";
import { getActiveStaffRole } from "@/lib/parent-role-boundary";

type EnrollmentCohort = {
  title: string;
  product: string;
  days_of_week: number[] | null;
  start_time: string;
  end_time: string;
  status: string;
  grade_band: string | null;
  plans: SupabaseRelation<{ name: string | null; product: string; active: boolean; price_sar: number | null; sessions_per_month: number | null; days_per_week: number | null }>;
};

async function EnrollContent({ searchParams }: { searchParams: Promise<{ grade?: string; cohort?: string }> }) {
  const params = await searchParams;
  const cohortId = params.cohort ?? "";

  // هذا عرض توضيحي فقط (Display) — التحقق الأمني الفعلي من الصف يحدث في /api/enroll عند
  // الإرسال الفعلي، وليس هنا. عند قيمة غير صالحة نعرض تسمية عامة بدل الانهيار.
  const parsedGrade = parseAndValidateGrade(params.grade ?? "1");
  const grade = parsedGrade.ok ? parsedGrade.grade : 0;
  const gradeLabel = parsedGrade.ok ? getGradeLabelArabic(parsedGrade.grade) : "غير محدَّد";

  // The query URL is not authorization: fail closed before asking families for
  // personally identifiable information when the cohort or plan is not enrollable.
  let unavailableReason: string | null = null;
  if (!parsedGrade.ok || !cohortId) {
    unavailableReason = "اختر الصف والمجموعة من صفحة الباقات أولًا.";
  }

  const details = {
    grade: gradeLabel,
    program: "خُطى متابعة",
    plan: null as string | null,
    days: null as string | null,
    sessionsPerMonth: null as number | null,
    cohortTitle: null as string | null,
    time: null as string | null,
    price: null as string | null,
  };

  if (!unavailableReason && cohortId) {
    try {
      const supabase = createSupabaseAdminClient();
      const { data: cohort } = await supabase
        .from("cohorts")
        .select("title, product, grade_band, status, days_of_week, start_time, end_time, plan_id, plans(name, product, active, price_sar, sessions_per_month, days_per_week)")
        .eq("id", cohortId)
        .single();

      if (!cohort) {
        unavailableReason = "المجموعة المطلوبة غير موجودة. اختر مجموعة متاحة من الباقات.";
      } else {
        const enrollmentCohort = cohort as EnrollmentCohort;
        const plan = supabaseRelationOne(enrollmentCohort.plans);
        const { data: seats, error: seatsError } = await supabase.rpc("cohort_available_seats", { p_cohort_id: cohortId });
        const settings = await getRuntimeSettings();
        if (!settings.registrationEnabled) {
          unavailableReason = "التسجيل مغلق حاليًا.";
        } else if (enrollmentCohort.status !== "open") {
          unavailableReason = "هذه المجموعة غير متاحة للتسجيل حاليًا.";
        } else if (enrollmentCohort.grade_band !== resolveGradeBand(grade)) {
          unavailableReason = "صف الطالب لا يطابق المجموعة المختارة.";
        } else if (!plan || !plan.active || plan.product !== enrollmentCohort.product ||
          !Number.isFinite(Number(plan.price_sar)) || Number(plan.price_sar) <= 0) {
          unavailableReason = "الباقة المرتبطة بالمجموعة غير متاحة حاليًا.";
        } else if (plan.days_per_week != null && enrollmentCohort.days_of_week?.length !== plan.days_per_week) {
          unavailableReason = "بيانات أيام المجموعة غير متطابقة مع الباقة. اختر مجموعة أخرى.";
        } else if (seatsError || typeof seats !== "number") {
          unavailableReason = "تعذّر التحقق من المقاعد المتاحة حاليًا. أعد المحاولة.";
        } else if (seats <= 0) {
          unavailableReason = "اكتمل عدد المقاعد في هذه المجموعة. اختر مجموعة أخرى.";
        }
        const days = enrollmentCohort.days_of_week ? formatDaysList(enrollmentCohort.days_of_week, "، ") : null;
        const planName = plan?.name ?? null;
        const priceSar = plan?.price_sar ?? null;
        const sessionsPerMonth = plan?.sessions_per_month ?? null;
        details.program = cohort.product === "focus_room" ? "جلسات التركيز" : "خُطى متابعة";
        details.plan = planName;
        details.days = days;
        details.sessionsPerMonth = sessionsPerMonth;
        details.cohortTitle = formatCohortDisplayName(cohort.title);
        details.time = `${String(cohort.start_time).slice(0, 5)} – ${String(cohort.end_time).slice(0, 5)}`;
        details.price = priceSar ? `${priceSar} ر.س` : "السعر يُعلن قريبًا";
      }
    } catch {
      // A broken DB/RPC lookup must not present an apparently valid signup form.
      unavailableReason = "تعذّر التحقق من المجموعة الآن. أعد المحاولة لاحقًا.";
    }
  }

  if (unavailableReason) {
    return (
      <div className="container">
        <span className="badge">التسجيل غير متاح لهذه المجموعة</span>
        <h1 className="title" style={{ fontSize: 32, marginTop: 16 }}>تحقق من اختيار المجموعة</h1>
        <p className="lead">{unavailableReason}</p>
        <Link className="btn outline" href={"/motabaa/plans?grade=" + (grade || 4)} style={{ marginTop: 16, display: "inline-flex" }}>
          العودة للباقات والمجموعات
        </Link>
      </div>
    );
  }

  // Reuse only authenticated account details bound to the verified session.
  // Guest checkout retains its existing OTP-first path; no guest receives profile data.
  let account: AuthenticatedParent | null = null;
  const auth = await createSupabaseServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (user) {
    try {
      if (await getActiveStaffRole(user.id)) {
        return (
          <div className="container">
            <h1 className="title" style={{ fontSize: 30 }}>هذا الحساب مخصص لفريق خُطى</h1>
            <p className="lead">سجّل الدخول بحساب ولي الأمر لإضافة طفل.</p>
            <Link className="btn outline" href="/login">دخول ولي الأمر</Link>
          </div>
        );
      }
      const { data: parent, error: profileError } = await auth
        .from("parents")
        .select("full_name, phone")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      const fullName = parent?.full_name?.trim() ?? "";
      const localPhone = toSaudiLocalDisplayPhone(parent?.phone ?? "") ?? "";
      account = {
        email: (user.email ?? "").trim().toLowerCase(),
        fullName,
        phone: localPhone,
        savedProfile: Boolean(fullName.length >= 2 && localPhone),
      };
    } catch (error) {
      console.error("[enroll] authenticated parent profile lookup failed:", error instanceof Error ? error.message : "unknown");
      return (
        <div className="container">
          <h1 className="title" style={{ fontSize: 30 }}>تعذّر تحميل حسابك</h1>
          <p className="lead">حاول تحديث الصفحة لإكمال تسجيل الطفل دون إنشاء حساب جديد.</p>
          <Link className="btn outline" href="/parent">العودة إلى لوحة ولي الأمر</Link>
        </div>
      );
    }
  }

  return <EnrollForm grade={grade} cohortId={cohortId} details={details} account={account} />;
}

export default function P({ searchParams }: { searchParams: Promise<{ grade?: string; cohort?: string }> }) {
  return (
    <Shell>
      <main className="section">
        <Suspense fallback={<div className="narrow" />}>
          <EnrollContent searchParams={searchParams} />
        </Suspense>
      </main>
    </Shell>
  );
}
