import Shell from "@/components/Shell";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import PaymentClient from "./PaymentClient";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveParentContext } from "@/lib/pilot-parent";
import { getGradeLabelArabic } from "@/lib/grade-config";
import { formatDaysList, formatCohortDisplayName } from "@/lib/plan-display";
import { supabaseRelationOne, type SupabaseRelation } from "@/lib/supabase-relations";

type PaymentSubscription = {
  parent_id: string;
  children: SupabaseRelation<{ grade: number | null }>;
  cohorts: SupabaseRelation<{
    title: string;
    product: string;
    days_of_week: number[] | null;
    start_time: string;
    end_time: string;
  }>;
  plans: SupabaseRelation<{ name: string | null; price_sar: number | null; sessions_per_month: number | null }>;
};

export default async function P({ searchParams }: { searchParams: Promise<{ sub?: string }> }) {
  const params = await searchParams;
  const subscriptionId = params.sub ?? "";

  let amountSar: number | null = null;
  let summary: {
    program: string; grade: string | null; plan: string | null;
    days: string | null; sessionsPerMonth: number | null; cohortTitle: string | null; time: string | null;
  } | null = null;
  let ownershipMismatch = false;

  if (subscriptionId) {
    // جلسة Supabase حقيقية مطلوبة قبل عرض شاشة الدفع فعليًا — لا نكتفي بالاعتماد على أن زر
    // الدفع نفسه سيرفض لاحقًا (يبقى الحارس الفعلي server-side)، بل نُحيل المستخدم لتسجيل
    // الدخول فورًا هنا أيضًا، مع next يعيده لنفس صفحة الدفع بعد نجاح OTP.
    const context = await resolveParentContext();
    if (!context) {
      redirect(`/login?next=${encodeURIComponent(`/motabaa/enroll/payment?sub=${subscriptionId}`)}`);
    }

    try {
      const supabase = createSupabaseAdminClient();
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("parent_id, children(grade), cohorts(title, product, days_of_week, start_time, end_time), plans(name, price_sar, sessions_per_month)")
        .eq("id", subscriptionId)
        .maybeSingle();

      const sub = subscription as PaymentSubscription | null;
      if (sub && sub.parent_id !== context!.parentId) {
        // لا يُسمَح بعرض/دفع اشتراك يعود لولي أمر آخر — لا نكشف أي تفاصيل عنه.
        ownershipMismatch = true;
      } else if (sub) {
        const child = supabaseRelationOne(sub.children);
        const cohort = supabaseRelationOne(sub.cohorts);
        const plan = supabaseRelationOne(sub.plans);
        amountSar = plan?.price_sar ?? null;
        summary = {
          program: cohort?.product === "focus_room" ? "جلسات التركيز" : "خُطى متابعة",
          grade: child?.grade ? getGradeLabelArabic(child.grade) : null,
          plan: plan?.name ?? null,
          days: cohort?.days_of_week ? formatDaysList(cohort.days_of_week, "، ") : null,
          sessionsPerMonth: plan?.sessions_per_month ?? null,
          cohortTitle: cohort?.title ? formatCohortDisplayName(cohort.title) : null,
          time: cohort ? `${String(cohort.start_time).slice(0, 5)} – ${String(cohort.end_time).slice(0, 5)}` : null,
        };
      }
    } catch {
      // بلا اتصال حقيقي بقاعدة البيانات — تُعرض شاشة الدفع بلا تفاصيل إضافية بدل الانهيار
    }
  }

  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">الخطوة الأخيرة</span>
          <h1 className="title" style={{ fontSize: 34 }}>أكمل اشتراكك</h1>
          {ownershipMismatch ? (
            <p>هذا الاشتراك غير متاح لحسابك.</p>
          ) : subscriptionId ? (
            <Suspense fallback={null}>
              <PaymentClient subscriptionId={subscriptionId} amountSar={amountSar} summary={summary} />
            </Suspense>
          ) : (
            <p>رابط غير صالح — ابدأ التسجيل من جديد من صفحة الخطط.</p>
          )}
        </div>
      </main>
    </Shell>
  );
}
