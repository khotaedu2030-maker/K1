import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { parseAndValidateGrade, resolveGradeBand } from "@/lib/grade-config";

// إنشاء اشتراك جديد بحالة pending_payment — الخطوة الوحيدة المسموح بها لإنشاء اشتراك،
// وتتم بالكامل على الخادم بمفتاح service_role (يتجاوز RLS بثقة، بعد تحقق يدوي كامل من
// المدخلات هنا). لا نثق بـ grade أو cohortId القادمين من العميل بمعزل عن التحقق الفعلي —
// خصوصًا أن Multi-stage الآن يعني أن grade 11 مع cohort لصفوف 1-3 طلب صالح شكليًا (رقمان
// صحيحان)، لكن غير صحيح منطقيًا، ويجب أن يُرفض صراحةً قبل إنشاء أي سجل.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { parentName, phone, childName, grade, cohortId } = body ?? {};

  if (!parentName || !phone || !childName || !cohortId) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const parsedGrade = parseAndValidateGrade(grade);
  if (!parsedGrade.ok) {
    return NextResponse.json({ error: parsedGrade.error }, { status: 400 });
  }
  const gradeNumber = parsedGrade.grade; // القيمة المستخدَمة في كل مكان أدناه — وليس body.grade الخام

  let requestedBand;
  try {
    requestedBand = resolveGradeBand(gradeNumber);
  } catch {
    return NextResponse.json({ error: "تعذّر تحديد المرحلة الدراسية لهذا الصف" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // المجموعة: يجب أن تكون موجودة، مفتوحة فعليًا (وليس draft/closed/full)، ومطابقة لصف الطالب
  // فعلًا — وليس فقط موجودة بأي حالة. تغيير cohortId يدويًا لصف من مرحلة مختلفة يُرفض هنا.
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id, plan_id, grade_band, status, product, days_of_week")
    .eq("id", cohortId)
    .maybeSingle();

  if (!cohort) {
    return NextResponse.json({ error: "مجموعة غير موجودة" }, { status: 400 });
  }
  if (cohort.status !== "open") {
    return NextResponse.json({ error: "هذه المجموعة غير متاحة للتسجيل حاليًا" }, { status: 409 });
  }
  if (cohort.grade_band && cohort.grade_band !== requestedBand) {
    return NextResponse.json(
      { error: "صف الطالب لا يطابق المرحلة الدراسية لهذه المجموعة" },
      { status: 409 }
    );
  }

  // الباقة المرتبطة: يجب أن تكون فعّالة (active) ومن نفس منتج المجموعة — حماية من عدم
  // تطابق بيانات داخلية (مثلًا خطة أُوقفت لاحقًا بينما بقي الرابط قديمًا متداولًا).
  // كذلك يجب أن يكون لها سعر معتمَد فعليًا — لا اشتراك بخطة price_sar=NULL بعد Seed التسعير.
  const { data: plan } = await supabase
    .from("plans")
    .select("id, product, active, price_sar, days_per_week")
    .eq("id", cohort.plan_id)
    .maybeSingle();
  if (!plan || !plan.active || plan.product !== cohort.product) {
    return NextResponse.json({ error: "هذه الباقة غير متاحة حاليًا" }, { status: 409 });
  }
  if (plan.price_sar === null) {
    return NextResponse.json({ error: "لم يُعتمَد سعر لهذه الباقة بعد" }, { status: 409 });
  }
  // P0: دفاع إضافي عن قيد قاعدة البيانات (enforce_cohort_days_match_plan) — رسالة واضحة بدل
  // ترك خطأ Trigger خامًا يظهر للمستخدم لو حدث تعارض بيانات لم يُكتشَف من قبل.
  const cohortDaysCount = (cohort.days_of_week as number[] | null)?.length ?? 0;
  if (plan.days_per_week != null && cohortDaysCount !== plan.days_per_week) {
    return NextResponse.json(
      { error: "تعارض في بيانات هذه المجموعة (عدد الأيام لا يطابق الباقة) — تواصل معنا." },
      { status: 409 }
    );
  }

  // مقعد متاح؟ فحص سريع أولي فقط (تجربة مستخدم أفضل — رسالة فورية إن كانت ممتلئة بوضوح)،
  // وليس نقطة الحماية الفعلية — تلك داخل enroll_subscription_atomic أدناه، التي تقفل صف
  // المجموعة وتعيد فحص المقاعد من الصفر ذرّيًا قبل أي إدراج، فلا تسابق ممكن بين طلبين متزامنين.
  const { data: seatsAvailable } = await supabase.rpc("cohort_available_seats", { p_cohort_id: cohortId });
  if ((seatsAvailable ?? 0) <= 0) {
    return NextResponse.json({ error: "اكتمل عدد المقاعد في هذه المجموعة" }, { status: 409 });
  }

  // ولي الأمر: نبحث بالجوال، وإلا ننشئ صفًا جديدًا (بدون ربط user_id إلى حين تسجيل الدخول لاحقًا)
  let { data: parent } = await supabase.from("parents").select("id").eq("phone", phone).maybeSingle();
  if (!parent) {
    const { data: newParent, error: parentError } = await supabase
      .from("parents")
      .insert({ full_name: parentName, phone })
      .select("id")
      .single();
    if (parentError) return NextResponse.json({ error: parentError.message }, { status: 500 });
    parent = newParent;
  }

  const { data: child, error: childError } = await supabase
    .from("children")
    .insert({ parent_id: parent.id, first_name: childName, grade: gradeNumber })
    .select("id")
    .single();
  if (childError) return NextResponse.json({ error: childError.message }, { status: 500 });

  // الخطوة الذرّية الفعلية: قفل المجموعة + إعادة فحص المقاعد + إدراج الاشتراك كوحدة واحدة —
  // هذا ما يمنع تجاوز السعة فعليًا عند التسجيل المتزامن، وليس الفحص أعلاه.
  const { data: subscriptionId, error: subError } = await supabase.rpc("enroll_subscription_atomic", {
    p_child_id: child.id,
    p_parent_id: parent.id,
    p_plan_id: cohort.plan_id,
    p_cohort_id: cohortId,
  });

  if (subError) {
    // نظافة بسيطة وآمنة: الطفل أُنشئ للتو في هذا الطلب تحديدًا ولا يشير إليه أي سجل آخر بعد
    // (الاشتراك فشل قبل إنشائه) — حذفه آمن هنا فقط، ولا نلمس صف ولي الأمر (قد يكون موجودًا
    // مسبقًا ومُستخدَمًا لأطفال آخرين). إن فشل الحذف نفسه، لا نُفشل الطلب بسببه — نوثّق الحالة
    // في السجلات فقط؛ هذا Best-effort لا معاملة إضافية جديدة (لا إعادة معمارية هنا).
    await supabase.from("children").delete().eq("id", child.id);

    const map: Record<string, string> = {
      cohort_not_found: "مجموعة غير موجودة",
      cohort_not_open: "هذه المجموعة غير متاحة للتسجيل حاليًا",
      cohort_full: "اكتمل عدد المقاعد في هذه المجموعة",
    };
    const known = Object.keys(map).find((k) => subError.message.includes(k));
    return NextResponse.json({ error: known ? map[known] : subError.message }, { status: 409 });
  }

  return NextResponse.json({ subscriptionId });
}
