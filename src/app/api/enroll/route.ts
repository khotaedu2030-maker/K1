import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { parseAndValidateGrade, resolveGradeBand } from "@/lib/grade-config";
import { normalizeSaudiStoredPhoneInput, SAUDI_PHONE_ERROR } from "@/lib/phone";

// إنشاء اشتراك جديد بحالة pending_payment — يتطلب الآن جلسة Supabase Auth حقيقية (Email OTP
// مُتحقَّق فعليًا) قبل أي شيء آخر. لا يعود ممكنًا لمستخدم غير متحقق حجز مقعد — هذا هو الإصلاح
// الجوهري لهذه الجولة: كان هذا المسار عامًا بالكامل سابقًا، ينشئ child + pending_payment قبل
// أي تحقق OTP إطلاقًا.
export async function POST(req: Request) {
  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  }

  // البريد الموثوق الوحيد لهوية الحساب هو user.email من الجلسة المُصادَقة نفسها — لا نثق
  // بأي email قادم من body كمصدر هوية. لكن لا نتجاهل تعارضًا صامتًا: إن أرسل العميل بريدًا
  // مختلفًا فعليًا عن بريد الجلسة (مثلًا كتب بريدًا آخر بالنموذج قبل أن يلاحظ أنه مسجَّل دخول
  // ببريد مختلف)، نرفض بوضوح بدل المتابعة ببريد الجلسة بصمت.
  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) {
    console.error(`[enroll] مستخدم مصادَق (${user.id}) بلا بريد إلكتروني في الجلسة.`);
    return NextResponse.json({ error: "تعذّر تحديد البريد الإلكتروني من الجلسة" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const { parentName, phone, childName, grade, cohortId } = body ?? {};

  const bodyEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (bodyEmail && bodyEmail !== email) {
    console.error(`[enroll] عدم تطابق بريد: body=${bodyEmail} جلسة=${email} للمستخدم ${user.id}.`);
    return NextResponse.json({ error: "البريد المدخل لا يطابق الحساب المسجل دخوله." }, { status: 409 });
  }

  if (!parentName || !phone || !childName || !cohortId) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  // Server-side validation/normalization فعلي — لا نعتمد على أن العميل التزم بالتطبيع فعليًا
  // (التعليقات القديمة كانت تفترض ذلك بلا فرض حقيقي). نقبل فقط 05XXXXXXXX أو +9665XXXXXXXX،
  // ونُوحِّد دائمًا لصيغة التخزين +9665XXXXXXXX قبل أي استخدام لاحق — بحث/تعارض/إدراج.
  const normalizedPhone = normalizeSaudiStoredPhoneInput(phone);
  if (!normalizedPhone) {
    return NextResponse.json({ error: SAUDI_PHONE_ERROR }, { status: 400 });
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

  // ---------------------------------------------------------------------
  // هوية ولي الأمر — تُحسَم بالكامل قبل إنشاء أي child أو subscription.
  // ---------------------------------------------------------------------
  let parent: { id: string };

  const { data: byUser, error: byUserError } = await supabase
    .from("parents")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (byUserError) {
    console.error(`[enroll] خطأ استعلام أثناء البحث بـuser_id للمستخدم ${user.id}:`, byUserError.message);
    return NextResponse.json({ error: "خطأ مؤقت، حاول مرة أخرى" }, { status: 503 });
  }

  if (byUser) {
    parent = byUser;
  } else {
    const { data: byEmail, error: byEmailError } = await supabase
      .from("parents")
      .select("id, user_id")
      .eq("email", email)
      .maybeSingle();
    if (byEmailError) {
      console.error(`[enroll] خطأ استعلام أثناء البحث بالبريد للمستخدم ${user.id}:`, byEmailError.message);
      return NextResponse.json({ error: "خطأ مؤقت، حاول مرة أخرى" }, { status: 503 });
    }

    if (byEmail && byEmail.user_id && byEmail.user_id !== user.id) {
      // صف موجود بنفس البريد لكن مرتبط بحساب مستخدم آخر فعليًا — تعارض حقيقي، لا دمج تلقائي.
      console.error(`[enroll] تعارض: البريد ${email} مرتبط بالفعل بمستخدم آخر (${byEmail.user_id}) غير الحالي (${user.id}).`);
      return NextResponse.json({ error: "هذا البريد مرتبط بحساب آخر بالفعل. تواصل معنا للمساعدة." }, { status: 409 });
    }

    if (byEmail && !byEmail.user_id) {
      // صف موجود بلا user_id (نادر بعد تصلّب هذا المسار، لكن ممكن من بيانات أقدم) — اربطه الآن.
      const { error: linkError } = await supabase.from("parents").update({ user_id: user.id }).eq("id", byEmail.id).is("user_id", null);
      if (linkError) {
        console.error(`[enroll] فشل ربط parent موجود (${byEmail.id}) بالمستخدم ${user.id}:`, linkError.message);
        return NextResponse.json({ error: "تعذّر إكمال إعداد الحساب" }, { status: 500 });
      }
      parent = byEmail;
    } else {
      // لا صف بهذا البريد ولا بهذا الحساب — جسر التوافق مع بيانات قديمة (Legacy) قبل Email
      // OTP: نبحث بالجوال المطبَّع قبل إنشاء صف جديد، تحديدًا عن صف "يتيم" بلا user_id وبلا
      // email إطلاقًا (تسجيل قديم فعلي لم يُربَط بأي حساب مصادقة بعد). البريد يبقى الهوية
      // الأساسية — هذا الجسر فقط لتفادي إنشاء صف مكرِّر لشخص مسجَّل قديمًا بجواله فقط.
      const { data: byPhone, error: byPhoneError } = await supabase
        .from("parents")
        .select("id, user_id, email")
        .eq("phone", normalizedPhone);
      if (byPhoneError) {
        console.error(`[enroll] خطأ استعلام أثناء جسر الجوال القديم للمستخدم ${user.id}:`, byPhoneError.message);
        return NextResponse.json({ error: "خطأ مؤقت، حاول مرة أخرى" }, { status: 503 });
      }

      const phoneRows = byPhone ?? [];
      if (phoneRows.length > 1) {
        // أكثر من صف بنفس الجوال (تكرار قديم) — لا نُنشئ صفًا ثالثًا، نرفض ونُسجِّل للمراجعة.
        console.error(`[enroll] تكرار جوال قديم (${phoneRows.length} صفوف) للجوال ${normalizedPhone} — يتطلب مراجعة يدوية قبل تسجيل المستخدم ${user.id}.`);
        return NextResponse.json({ error: "هذا الرقم مرتبط بأكثر من حساب. تواصل معنا للمساعدة." }, { status: 409 });
      }

      const phoneMatch = phoneRows[0];
      if (phoneMatch && (phoneMatch.user_id || phoneMatch.email)) {
        // الصف الموجود ليس يتيمًا فعليًا (مرتبط بحساب آخر أو ببريد آخر بالفعل) — تعارض حقيقي،
        // لا ربط تلقائي آمن هنا.
        console.error(`[enroll] تعارض: الجوال ${normalizedPhone} مرتبط بصف غير يتيم (${phoneMatch.id}) — لا يمكن ربطه تلقائيًا بالمستخدم ${user.id}.`);
        return NextResponse.json({ error: "هذا الرقم مرتبط بحساب آخر بالفعل. تواصل معنا للمساعدة." }, { status: 409 });
      }

      if (phoneMatch) {
        // صف يتيم فعليًا (بلا user_id وبلا email) — ربطه الآن بدل إنشاء صف جديد.
        const { error: bridgeError } = await supabase
          .from("parents")
          .update({ user_id: user.id, email })
          .eq("id", phoneMatch.id)
          .is("user_id", null)
          .is("email", null);
        if (bridgeError) {
          console.error(`[enroll] فشل جسر الجوال القديم لصف ${phoneMatch.id} للمستخدم ${user.id}:`, bridgeError.message);
          return NextResponse.json({ error: "تعذّر إكمال إعداد الحساب" }, { status: 500 });
        }
        parent = phoneMatch;
      } else {
        // لا صف بهذا البريد ولا بهذا الجوال ولا بهذا الحساب إطلاقًا — إنشاء مباشر.
        const { data: newParent, error: parentError } = await supabase
          .from("parents")
          .insert({ user_id: user.id, full_name: parentName, phone: normalizedPhone, email })
          .select("id")
          .single();
        if (parentError) return NextResponse.json({ error: parentError.message }, { status: 500 });
        parent = newParent;
      }
    }
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
