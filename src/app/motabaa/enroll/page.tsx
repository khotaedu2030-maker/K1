import { Suspense } from "react";
import Shell from "@/components/Shell";
import EnrollForm from "./EnrollForm";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getGradeLabelArabic, parseAndValidateGrade } from "@/lib/grade-config";
import { formatDaysList, formatCohortDisplayName, formatTimeRangeAr } from "@/lib/plan-display";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { toSaudiLocalPhone } from "@/lib/phone";

async function EnrollContent({ searchParams }: { searchParams: Promise<{ grade?: string; cohort?: string }> }) {
  const params = await searchParams;
  const cohortId = params.cohort ?? "";

  // هذا عرض توضيحي فقط (Display) — التحقق الأمني الفعلي من الصف يحدث في /api/enroll عند
  // الإرسال الفعلي، وليس هنا. عند قيمة غير صالحة نعرض تسمية عامة بدل الانهيار.
  const parsedGrade = parseAndValidateGrade(params.grade ?? "1");
  const grade = parsedGrade.ok ? parsedGrade.grade : 0;
  const gradeLabel = parsedGrade.ok ? getGradeLabelArabic(parsedGrade.grade) : "غير محدَّد";

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

  let initialParent = { name: "", email: "", phone: "", hasProfile: false };
  try {
    const authed = await createSupabaseServerClient();
    const { data: { user } } = await authed.auth.getUser();
    if (user) {
      const { data: parent } = await authed
        .from("parents")
        .select("full_name, phone")
        .eq("user_id", user.id)
        .maybeSingle();
      initialParent = {
        name: parent?.full_name ?? "",
        email: user.email ?? "",
        phone: toSaudiLocalPhone(parent?.phone),
        hasProfile: Boolean(parent?.full_name && parent?.phone),
      };
    }
  } catch {
    // يبقى النموذج العام متاحًا، والتحقق النهائي يتم في API بعد تسجيل الدخول.
  }

  if (cohortId) {
    try {
      const supabase = createSupabaseAdminClient();
      const { data: cohort } = await supabase
        .from("cohorts")
        .select("title, product, days_of_week, start_time, end_time, plan_id, plans(name, price_sar, sessions_per_month)")
        .eq("id", cohortId)
        .single();

      if (cohort) {
        const days = formatDaysList(cohort.days_of_week as number[], "، ");
        const planDetails = cohort.plans as unknown as { name: string; price_sar: number | null; sessions_per_month: number | null } | null;
        const planName = planDetails?.name ?? null;
        const priceSar = planDetails?.price_sar ?? null;
        const sessionsPerMonth = planDetails?.sessions_per_month ?? null;
        details.program = cohort.product === "focus_room" ? "جلسات التركيز" : "خُطى متابعة";
        details.plan = planName?.replace(/Focus Room/gi, "جلسات التركيز") ?? null;
        details.days = days;
        details.sessionsPerMonth = sessionsPerMonth;
        details.cohortTitle = formatCohortDisplayName(cohort.title);
        details.time = formatTimeRangeAr(String(cohort.start_time), String(cohort.end_time));
        details.price = priceSar ? `${priceSar} ر.س` : "السعر يُعلن قريبًا";
      }
    } catch {
      // بلا اتصال حقيقي بقاعدة البيانات — نكتفي بالملخص الأساسي (الصف فقط)
    }
  }

  return <EnrollForm grade={grade} cohortId={cohortId} details={details} initialParent={initialParent} />;
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
