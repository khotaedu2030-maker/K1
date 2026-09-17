import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
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

  const { error: deleteError } = await admin.from("parents").delete().eq("id", duplicateId);
  if (deleteError) {
    console.error(`[link-parent] فشل حذف parent مكرَّر ${duplicateId} بعد نقل كل مراجعه بنجاح:`, deleteError.message);
    return { ok: false, status: 503, error: "تعذّر إكمال تنظيف الحساب، حاول مرة أخرى" };
  }

  return { ok: true };
}

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  }

  const email = (user.email ?? "").trim().toLowerCase();
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
      .eq("email", email)
      .neq("id", existingByUser.id);
    if (otherError) {
      console.error(`[link-parent] خطأ استعلام أثناء فحص duplicates إضافية للمستخدم ${user.id}:`, otherError.message);
      return NextResponse.json({ parentId: existingByUser.id });
    }

    const safeToMerge = ((otherRows ?? []) as ParentRow[]).filter((p) => p.user_id === null);
    const conflicting = ((otherRows ?? []) as ParentRow[]).filter((p) => p.user_id !== null);
    if (conflicting.length > 0) {
      console.error(
        `[link-parent] تعارض: البريد ${email} مرتبط أيضًا بحساب مستخدم آخر (${conflicting.map((c) => c.id).join(", ")}) غير المستخدم الحالي (${user.id}) — لا يُدمَج تلقائيًا، يتطلب مراجعة يدوية.`
      );
    }
    for (const dup of safeToMerge) {
      const mergeResult = await mergeAndDeleteDuplicate(admin, existingByUser.id, dup.id);
      if (!mergeResult.ok) return NextResponse.json({ error: mergeResult.error }, { status: mergeResult.status });
    }

    return NextResponse.json({ parentId: existingByUser.id });
  }

  // 2) أول دخول لهذا الحساب — هل يوجد صف parent بنفس البريد أُنشئ أثناء التسجيل (/api/enroll)؟
  const { data: candidates, error: candidatesError } = await admin
    .from("parents")
    .select("id, user_id")
    .eq("email", email)
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

  // 3) الحالة الأساسية: صف واحد أو أكثر بلا user_id لنفس البريد — الأقدم هو الأساسي، ندمج أي
  // تكرار آخر فيه (نقل مراجع ثم حذف الصف المكرَّر فعليًا) قبل ربطه بالمستخدم.
  const canonical = unlinked[0];
  const duplicates = unlinked.slice(1);

  for (const dup of duplicates) {
    const mergeResult = await mergeAndDeleteDuplicate(admin, canonical.id, dup.id);
    if (!mergeResult.ok) return NextResponse.json({ error: mergeResult.error }, { status: mergeResult.status });
  }

  const { data: linkedRow, error: linkError } = await admin
    .from("parents")
    .update({ user_id: user.id })
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
