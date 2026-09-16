import Shell from "@/components/Shell";
import { Suspense } from "react";
import PaymentClient from "./PaymentClient";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getGradeLabelArabic } from "@/lib/grade-config";
import { formatDaysList, formatCohortDisplayName } from "@/lib/plan-display";

export default async function P({ searchParams }: { searchParams: Promise<{ sub?: string }> }) {
  const params = await searchParams;
  const subscriptionId = params.sub ?? "";

  let amountSar: number | null = null;
  let summary: {
    program: string; grade: string | null; plan: string | null;
    days: string | null; sessionsPerMonth: number | null; cohortTitle: string | null; time: string | null;
  } | null = null;

  if (subscriptionId) {
    try {
      const supabase = createSupabaseAdminClient();
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("children(grade), cohorts(title, product, days_of_week, start_time, end_time), plans(name, price_sar, sessions_per_month)")
        .eq("id", subscriptionId)
        .maybeSingle();

      const sub = subscription as any;
      amountSar = sub?.plans?.price_sar ?? null;
      if (sub) {
        summary = {
          program: sub.cohorts?.product === "focus_room" ? "جلسات التركيز" : "خُطى متابعة",
          grade: sub.children?.grade ? getGradeLabelArabic(sub.children.grade) : null,
          plan: sub.plans?.name ?? null,
          days: sub.cohorts?.days_of_week ? formatDaysList(sub.cohorts.days_of_week as number[], "، ") : null,
          sessionsPerMonth: sub.plans?.sessions_per_month ?? null,
          cohortTitle: sub.cohorts?.title ? formatCohortDisplayName(sub.cohorts.title) : null,
          time: sub.cohorts ? `${String(sub.cohorts.start_time).slice(0, 5)} – ${String(sub.cohorts.end_time).slice(0, 5)}` : null,
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
          {subscriptionId ? (
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
