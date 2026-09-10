import { Suspense } from "react";
import Shell from "@/components/Shell";
import EnrollForm from "./EnrollForm";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getGradeLabelArabic, parseAndValidateGrade } from "@/lib/grade-config";
import { formatDaysList, formatCohortDisplayName } from "@/lib/plan-display";

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
        const planName = (cohort as any).plans?.name ?? null;
        const priceSar = (cohort as any).plans?.price_sar as number | null;
        const sessionsPerMonth = (cohort as any).plans?.sessions_per_month as number | null;
        details.program = cohort.product === "focus_room" ? "جلسات التركيز" : "خُطى متابعة";
        details.plan = planName;
        details.days = days;
        details.sessionsPerMonth = sessionsPerMonth;
        details.cohortTitle = formatCohortDisplayName(cohort.title);
        details.time = `${String(cohort.start_time).slice(0, 5)} – ${String(cohort.end_time).slice(0, 5)}`;
        details.price = priceSar ? `${priceSar} ر.س / شهريًا` : "السعر يُعلن قريبًا";
      }
    } catch {
      // بلا اتصال حقيقي بقاعدة البيانات — نكتفي بالملخص الأساسي (الصف فقط)
    }
  }

  return <EnrollForm grade={grade} cohortId={cohortId} details={details} />;
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
