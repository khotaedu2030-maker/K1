import Shell from "@/components/Shell";
import { Suspense } from "react";
import PlansSelector, { type PlanRow, type CohortRow } from "./PlansSelector";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// Server Component: يقرأ الخطط والمجموعات الحقيقية من قاعدة البيانات (بيانات كتالوج عامة).
// يستخدم public_cohorts_catalog() الآمنة بدل SELECT مباشر على cohorts — نفس الدالة يمكن استدعاؤها
// بأمان من anon أيضًا لأنها SECURITY DEFINER وتُرجع أعمدة آمنة فقط (لا meeting_url، لا teacher_id).
// يجلب منتجَي motabaa (1-6) وfocus_room (7-12) معًا — الفلترة حسب صف الطالب تتم داخل
// PlansSelector على العميل، وهذا للعرض فقط: التحقق الأمني الفعلي (تطابق الصف مع المجموعة،
// وأن الخطة active قبل قبول أي اشتراك) يبقى بالكامل في /api/enroll، لا يُعتمَد على العميل هنا.
//
// لا فلترة على plans.active عمدًا: خطط Focus Room مُدرجة active=false لعدم اعتماد سعرها بعد،
// لكن يجب أن تظهر في واجهة الاستكشاف (مع "السعر يُعلن قريبًا") حتى تكتمل رحلة الاختيار والوصول
// لصفحة التسجيل — /api/enroll هو من يرفض الشراء الفعلي طالما الخطة غير مفعَّلة.
async function getData() {
  try {
    const supabase = createSupabaseAdminClient();

    const { data: plans, error: plansError } = await supabase
      .from("plans")
      .select("id,product,name,day_patterns,price_sar,days_per_week,sessions_per_month")
      .in("product", ["motabaa", "focus_room"])
      .order("id");
    if (plansError) throw plansError;

    const { data: cohorts, error: cohortsError } = await supabase.rpc("public_cohorts_catalog", {
      p_product: null,
    });
    if (cohortsError) throw cohortsError;

    const relevantCohorts = ((cohorts ?? []) as CohortRow[]).filter(
      (c) => c.product === "motabaa" || c.product === "focus_room"
    );

    return { plans: (plans ?? []) as PlanRow[], cohorts: relevantCohorts, live: true };
  } catch (err) {
    // نسجّل السبب الحقيقي في سجلات الخادم (اسم/رسالة الخطأ فقط — لا قيم أسرار إطلاقًا) حتى لا
    // يختفي سبب عطل حقيقي في الإنتاج خلف رسالة عامة. راجع سجلات Vercel Functions لهذا المسار
    // عند ظهور هذه الحالة — السبب الأشيع: SUPABASE_SERVICE_ROLE_KEY أو NEXT_PUBLIC_SUPABASE_URL
    // غير مُعرَّفين (أو خاطئين) في إعدادات البيئة على Vercel لهذا المشروع تحديدًا.
    const message = err instanceof Error ? err.message : "خطأ غير معروف";
    console.error("[/motabaa/plans] فشل جلب الخطط/المجموعات:", message);
    return { plans: [] as PlanRow[], cohorts: [] as CohortRow[], live: false };
  }
}

export default async function P() {
  const { plans, cohorts, live } = await getData();

  return (
    <Shell>
      <main className="section">
        {!live && (
          <div className="container">
            <p className="badge" style={{ marginBottom: 20 }}>
              تعذّر تحميل الخطط حاليًا. حاول تحديث الصفحة، أو تواصل معنا إذا استمرت المشكلة.
            </p>
          </div>
        )}
        <Suspense fallback={null}>
          <PlansSelector plans={plans} cohorts={cohorts} />
        </Suspense>
      </main>
    </Shell>
  );
}
