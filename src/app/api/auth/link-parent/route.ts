import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { exactParentEmailPattern, normalizeParentEmail } from "@/lib/parent-identity";

type ParentRow = { id: string; user_id: string | null };

// يُستدعى من العميل فور نجاح verifyOtp مباشرة — الربط الفعلي بأكمله server-side، ولا يثق بأي
// بريد قادم من body العميل؛ يستخرجه حصرًا من جلسة Supabase Auth المُصادَقة نفسها (user.email)،
// وهو ما تحقّقت منه Supabase فعليًا عبر رمز OTP، لا مجرد قيمة أرسلها المتصفح.
//
// الهوية الأساسية الآن البريد الإلكتروني (لا الجوال) — يطابق قرار المنتج بتسجيل الدخول عبر
// Email OTP. الجوال يبقى بيانات تواصل/Paylink مطلوبة فقط أثناء التسجيل (/api/enroll)، وليس
// معرّف ربط تسجيل الدخول بعد الآن.
//
// مهم: هذا المسار لا يُنشئ parent جديدًا أبدًا (كان يفعل ذلك سابقًا عند أول جوال). صف parent
// يُنشأ فقط عبر /api/enroll (حيث الجوال والاسم متوفران فعليًا). إن لم يوجد صف بهذا البريد
// إطلاقًا، نُعيد رسالة واضحة تطلب من المستخدم بدء التسجيل أولًا — لا صفًا ناقص الجوال.
//
// جدول التبعيات المؤكَّد من schema.sql مباشرة: children, subscriptions, payments فقط.

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  }

  const email = normalizeParentEmail(user.email ?? "");
  if (!email) {
    console.error(`[link-parent] مستخدم مصادَق (${user.id}) بلا بريد إلكتروني في الجلسة.`);
    return NextResponse.json({ error: "تعذّر تحديد البريد الإلكتروني من الجلسة" }, { status: 500 });
  }

  const admin = createSupabaseAdminClient();

  // 1) دخول متكرر لنفس الحساب — صف مرتبط بهذا user_id موجود بالفعل.
  const { data: existingByUser, error: byUserError } = await admin
    .from("parents")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (byUserError) {
    console.error(`[link-parent] خطأ استعلام أثناء البحث بـuser_id للمستخدم ${user.id}:`, byUserError.message);
    return NextResponse.json({ error: "خطأ مؤقت، حاول مرة أخرى" }, { status: 503 });
  }

  if (existingByUser) {
    // تحقّق من duplicates أخرى بنفس البريد (قد تنشأ من تسجيل لاحق قبل تسجيل دخول جديد على
    // نفس البريد) بدل الرجوع المبكر وتركها معلَّقة.
    const { data: otherRows, error: otherError } = await admin
      .from("parents")
      .select("id, user_id")
      .ilike("email", exactParentEmailPattern(email))
      .neq("id", existingByUser.id);
    if (otherError) {
      console.error(`[link-parent] خطأ استعلام أثناء فحص duplicates إضافية للمستخدم ${user.id}:`, otherError.message);
      return NextResponse.json({ parentId: existingByUser.id });
    }

    const conflicting = ((otherRows ?? []) as ParentRow[]).filter((p) => p.user_id !== null);
    if (conflicting.length > 0) {
      console.error(
        `[link-parent] تعارض: البريد ${email} مرتبط أيضًا بحساب مستخدم آخر (${conflicting.map((c) => c.id).join(", ")}) غير المستخدم الحالي (${user.id}) — لا يُدمَج تلقائيًا، يتطلب مراجعة يدوية.`
      );
    }
    // Duplicate cleanup is intentionally deferred: moving dependent rows and deleting an
    // orphan cannot be made atomic with the available client APIs. Never risk touching a
    // row another request may have claimed after this read.
    return NextResponse.json({ parentId: existingByUser.id });
  }

  // 2) أول دخول لهذا الحساب — هل يوجد صف parent بنفس البريد أُنشئ أثناء التسجيل (/api/enroll)؟
  const { data: candidates, error: candidatesError } = await admin
    .from("parents")
    .select("id, user_id")
    .ilike("email", exactParentEmailPattern(email))
    .order("created_at", { ascending: true });
  if (candidatesError) {
    console.error(`[link-parent] خطأ استعلام أثناء البحث بالبريد للمستخدم ${user.id}:`, candidatesError.message);
    return NextResponse.json({ error: "خطأ مؤقت، حاول مرة أخرى" }, { status: 503 });
  }

  const unlinked = ((candidates ?? []) as ParentRow[]).filter((p) => p.user_id === null);
  const alreadyLinkedToOther = ((candidates ?? []) as ParentRow[]).find((p) => p.user_id !== null);

  if (unlinked.length === 0) {
    if (alreadyLinkedToOther) {
      console.error(
        `[link-parent] تعارض: البريد ${email} مرتبط بالفعل بولي أمر آخر (${alreadyLinkedToOther.id}) غير المستخدم الحالي (${user.id}).`
      );
      return NextResponse.json({ error: "هذا البريد مرتبط بحساب آخر بالفعل. تواصل معنا للمساعدة." }, { status: 409 });
    }

    // لا صف بهذا البريد إطلاقًا — لا نُنشئ parent ناقص الجوال من صفحة الدخول. المستخدم يجب أن
    // يبدأ من التسجيل الفعلي (يجمع الجوال أيضًا) أولًا.
    return NextResponse.json(
      { error: "لا يوجد اشتراك مرتبط بهذا البريد. ابدأ التسجيل أولًا." },
      { status: 404 }
    );
  }

  // 3) Multiple unlinked rows are ambiguous without an atomic merge transaction. Fail closed.
  if (unlinked.length > 1) {
    return NextResponse.json({ error: "تعذّر ربط هذا البريد تلقائيًا. تواصل معنا للمساعدة." }, { status: 409 });
  }

  // 4) A single unlinked row may be claimed with an ownership proof below.
  const canonical = unlinked[0];

  const { data: linkedRow, error: linkError } = await admin
    .from("parents")
    .update({ user_id: user.id, email })
    .eq("id", canonical.id)
    .is("user_id", null)
    .select("id, user_id")
    .maybeSingle();

  if (linkError) {
    console.error(`[link-parent] فشل ربط parent موجود (${canonical.id}) بالمستخدم ${user.id}:`, linkError.message);
    return NextResponse.json({ error: "تعذّر إكمال ربط الحساب" }, { status: 500 });
  }
  if (!linkedRow || linkedRow.user_id !== user.id) {
    const { data: recheck } = await admin.from("parents").select("id, user_id").eq("user_id", user.id).maybeSingle();
    if (recheck?.user_id === user.id) return NextResponse.json({ parentId: recheck.id });
    return NextResponse.json({ error: "تعذّر إكمال ربط الحساب، حاول مرة أخرى" }, { status: 503 });
  }

  return NextResponse.json({ parentId: linkedRow.id });
}
