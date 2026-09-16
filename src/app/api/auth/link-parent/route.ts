import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
type ParentRow = { id: string; full_name: string; user_id: string | null };

// يُستدعى من العميل فور نجاح verifyOtp مباشرة — لكن الربط الفعلي بأكمله server-side، ولا يثق
// برقم جوال قادم من body العميل؛ يستخرجه من جلسة Supabase Auth المُصادَقة نفسها (user.phone)،
// وهو ما تحقّقت منه Supabase فعليًا عبر رمز OTP، لا مجرد قيمة أرسلها المتصفح.
//
// المشكلة التي يُصلحها: upsert({user_id}, {onConflict:"user_id"}) القديم في صفحة تسجيل
// الدخول كان عاجزًا بنيويًا عن إيجاد صف parent أُنشئ أثناء التسجيل قبل OTP (بلا user_id
// إطلاقًا حينها) — فكان يُنشئ صفًا جديدًا مرتبطًا بالمستخدم، بينما الطفل والاشتراك الحقيقيان
// يبقيان معلَّقين بالصف القديم غير المرتبط. النتيجة: ولي الأمر يدخل ويجد "لا يوجد أبناء".
//
// جدول التبعيات المؤكَّد من schema.sql مباشرة (لا افتراض): الجداول الوحيدة التي تحتوي عمود
// parent_id مرتبطًا بـ parents هي children, subscriptions, payments — لا جدول رابع.

// ينقل كل مراجع (children/subscriptions/payments) من صف parent مكرَّر إلى الصف الأساسي، ثم
// يحذف الصف المكرَّر نفسه فقط بعد نجاح نقل الثلاثة جميعًا. Fail-closed تمامًا: أي فشل في أي
// خطوة يوقف العملية فورًا بـ503 — لا يُعتبَر الدمج ناجحًا جزئيًا أبدًا، ولا يُترَك صف فارغ
// (يكسر البحث بالجوال لاحقًا لأي محاولة تسجيل/دخول أخرى بنفس الرقم).
async function mergeAndDeleteDuplicate(
  admin: AdminClient,
  canonicalId: string,
  duplicateId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { error: childrenError } = await admin.from("children").update({ parent_id: canonicalId }).eq("parent_id", duplicateId);
  if (childrenError) {
    console.error(`[link-parent] فشل نقل children من ${duplicateId} إلى ${canonicalId}:`, childrenError.message);
    return { ok: false, status: 503, error: "تعذّر إكمال دمج الحساب، حاول مرة أخرى" };
  }

  const { error: subsError } = await admin.from("subscriptions").update({ parent_id: canonicalId }).eq("parent_id", duplicateId);
  if (subsError) {
    console.error(`[link-parent] فشل نقل subscriptions من ${duplicateId} إلى ${canonicalId}:`, subsError.message);
    return { ok: false, status: 503, error: "تعذّر إكمال دمج الحساب، حاول مرة أخرى" };
  }

  const { error: paymentsError } = await admin.from("payments").update({ parent_id: canonicalId }).eq("parent_id", duplicateId);
  if (paymentsError) {
    console.error(`[link-parent] فشل نقل payments من ${duplicateId} إلى ${canonicalId}:`, paymentsError.message);
    return { ok: false, status: 503, error: "تعذّر إكمال دمج الحساب، حاول مرة أخرى" };
  }

  // الحذف فقط بعد نجاح نقل المراجع الثلاثة جميعًا — لا نترك صفًا فارغًا "كأثر تدقيقي"، لأن
  // وجوده يكسر أي بحث لاحق بالجوال (.eq("phone", phone)) في /api/enroll وهنا نفسه.
  const { error: deleteError } = await admin.from("parents").delete().eq("id", duplicateId);
  if (deleteError) {
    console.error(`[link-parent] فشل حذف parent مكرَّر ${duplicateId} بعد نقل كل مراجعه بنجاح:`, deleteError.message);
    return { ok: false, status: 503, error: "تعذّر إكمال تنظيف الحساب، حاول مرة أخرى" };
  }

  return { ok: true };
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  }

  const rawPhone = user.phone ?? "";
  const digits = rawPhone.replace(/\D/g, "");
  if (!/^9665\d{8}$/.test(digits)) {
    console.error(`[link-parent] مستخدم مصادَق (${user.id}) بجوال غير متوقَّع في الجلسة: "${rawPhone}"`);
    return NextResponse.json({ error: "تعذّر تحديد رقم الجوال من الجلسة" }, { status: 500 });
  }
  const phone = `+${digits}`;

  const body = await req.json().catch(() => null);
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";

  const admin = createSupabaseAdminClient();

  // 1) دخول متكرر لنفس الحساب — صف مرتبط بهذا user_id موجود بالفعل.
  const { data: existingByUser, error: byUserError } = await admin
    .from("parents")
    .select("id, full_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (byUserError) {
    console.error(`[link-parent] خطأ استعلام أثناء البحث بـuser_id للمستخدم ${user.id}:`, byUserError.message);
    return NextResponse.json({ error: "خطأ مؤقت، حاول مرة أخرى" }, { status: 503 });
  }

  if (existingByUser) {
    if (fullName && fullName !== existingByUser.full_name) {
      await admin.from("parents").update({ full_name: fullName }).eq("id", existingByUser.id);
    }

    // حتى إذا كان الحساب مربوطًا بالفعل، تحقّق من وجود duplicates أخرى بنفس الجوال (قد تكون
    // نشأت من تسجيلات لاحقة قبل OTP على نفس الرقم) بدل الرجوع المبكر وتركها معلَّقة.
    const { data: otherRows, error: otherError } = await admin
      .from("parents")
      .select("id, full_name, user_id")
      .eq("phone", phone)
      .neq("id", existingByUser.id);
    if (otherError) {
      console.error(`[link-parent] خطأ استعلام أثناء فحص duplicates إضافية للمستخدم ${user.id}:`, otherError.message);
      // لا نُفشل تسجيل الدخول بسبب فشل هذا الفحص الثانوي — الحساب الأساسي سليم ومربوط فعليًا.
      return NextResponse.json({ parentId: existingByUser.id });
    }

    const safeToMerge = ((otherRows ?? []) as ParentRow[]).filter((p) => p.user_id === null);
    const conflicting = ((otherRows ?? []) as ParentRow[]).filter((p) => p.user_id !== null);
    if (conflicting.length > 0) {
      console.error(
        `[link-parent] تعارض: الجوال ${phone} مرتبط أيضًا بحساب مستخدم آخر (${conflicting.map((c) => c.id).join(", ")}) غير المستخدم الحالي (${user.id}) — يتطلب مراجعة يدوية.`
      );
    }
    for (const dup of safeToMerge) {
      const mergeResult = await mergeAndDeleteDuplicate(admin, existingByUser.id, dup.id);
      if (!mergeResult.ok) return NextResponse.json({ error: mergeResult.error }, { status: mergeResult.status });
    }

    return NextResponse.json({ parentId: existingByUser.id });
  }

  // 2) أول دخول لهذا الحساب — هل توجد صفوف parents بنفس الجوال أُنشئت أثناء تسجيل سابق قبل OTP؟
  const { data: candidates, error: candidatesError } = await admin
    .from("parents")
    .select("id, full_name, user_id")
    .eq("phone", phone)
    .order("created_at", { ascending: true });
  if (candidatesError) {
    console.error(`[link-parent] خطأ استعلام أثناء البحث بالجوال للمستخدم ${user.id}:`, candidatesError.message);
    return NextResponse.json({ error: "خطأ مؤقت، حاول مرة أخرى" }, { status: 503 });
  }

  const unlinked = ((candidates ?? []) as ParentRow[]).filter((p) => p.user_id === null);
  const alreadyLinkedToOther = ((candidates ?? []) as ParentRow[]).find((p) => p.user_id !== null);

  if (unlinked.length === 0) {
    if (alreadyLinkedToOther) {
      console.error(
        `[link-parent] تعارض: الجوال ${phone} مرتبط بالفعل بولي أمر آخر (${alreadyLinkedToOther.id}) غير المستخدم الحالي (${user.id}).`
      );
      return NextResponse.json({ error: "هذا الرقم مرتبط بحساب آخر بالفعل. تواصل معنا للمساعدة." }, { status: 409 });
    }

    const { data: created, error: createError } = await admin
      .from("parents")
      .insert({ user_id: user.id, full_name: fullName || "ولي أمر", phone })
      .select("id")
      .single();
    if (createError) {
      console.error(`[link-parent] فشل إنشاء parent جديد للمستخدم ${user.id}:`, createError.message);
      return NextResponse.json({ error: "تعذّر إنشاء الحساب" }, { status: 500 });
    }
    return NextResponse.json({ parentId: created.id });
  }

  // 3) الحالة الأساسية المقصودة بهذا الإصلاح: صف واحد أو أكثر بلا user_id لنفس الجوال — نختار
  // الأقدم كصف نهائي، وندمج أي تكرار آخر فيه (نقل المراجع ثم حذف الصف المكرَّر فعليًا) قبل
  // ربطه بالمستخدم. لو فشل أي دمج، نتوقف فورًا ولا نربط شيئًا (لا نعتبر الدمج ناجحًا جزئيًا).
  const canonical = unlinked[0];
  const duplicates = unlinked.slice(1);

  for (const dup of duplicates) {
    const mergeResult = await mergeAndDeleteDuplicate(admin, canonical.id, dup.id);
    if (!mergeResult.ok) return NextResponse.json({ error: mergeResult.error }, { status: mergeResult.status });
  }

  // ربط ذرّي مشروط: WHERE user_id IS NULL يمنع سباقًا نادرًا لو وصل طلب آخر لنفس المستخدم
  // بالتزامن (ثاني تبويب مثلًا) وربط الصف بالفعل بين قراءتنا أعلاه وتحديثنا هنا.
  const { data: linkedRow, error: linkError } = await admin
    .from("parents")
    .update({ user_id: user.id, full_name: fullName || canonical.full_name })
    .eq("id", canonical.id)
    .is("user_id", null)
    .select("id")
    .maybeSingle();

  if (linkError) {
    console.error(`[link-parent] فشل ربط parent موجود (${canonical.id}) بالمستخدم ${user.id}:`, linkError.message);
    return NextResponse.json({ error: "تعذّر إكمال ربط الحساب" }, { status: 500 });
  }
  if (!linkedRow) {
    const { data: recheck } = await admin.from("parents").select("id").eq("user_id", user.id).maybeSingle();
    if (recheck) return NextResponse.json({ parentId: recheck.id });
    return NextResponse.json({ error: "تعذّر إكمال ربط الحساب، حاول مرة أخرى" }, { status: 503 });
  }

  return NextResponse.json({ parentId: linkedRow.id });
}
