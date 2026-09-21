import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeSaudiStoredPhoneInput } from "@/lib/phone";
import { exactParentEmailPattern, normalizeParentEmail } from "@/lib/parent-identity";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "يجب التحقق من البريد أولًا" }, { status: 401 });

  const email = normalizeParentEmail(user.email ?? "");
  if (!email) return NextResponse.json({ error: "تعذّر تحديد البريد الإلكتروني" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const phone = typeof body?.phone === "string" ? normalizeSaudiStoredPhoneInput(body.phone) : null;
  if (fullName.length < 2) return NextResponse.json({ error: "اسم ولي الأمر مطلوب" }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "أدخل رقم جوال سعودي صحيح يبدأ بـ 05" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: existingByUser, error: userError } = await admin
    .from("parents")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (userError) {
    console.error("[parent-signup] user lookup failed:", userError.message);
    return NextResponse.json({ error: "تعذّر إعداد الحساب" }, { status: 503 });
  }
  if (existingByUser) return NextResponse.json({ ok: true, parentId: existingByUser.id });

  const { data: emailRows, error: emailError } = await admin
    .from("parents")
    .select("id, user_id")
    .ilike("email", exactParentEmailPattern(email));
  if (emailError) {
    console.error("[parent-signup] email lookup failed:", emailError.message);
    return NextResponse.json({ error: "تعذّر إعداد الحساب" }, { status: 503 });
  }

  const linkedEmailRows = (emailRows ?? []).filter((row) => row.user_id && row.user_id !== user.id);
  if (linkedEmailRows.length > 0) {
    return NextResponse.json({ error: "هذا البريد مرتبط بحساب آخر بالفعل. تواصل معنا للمساعدة." }, { status: 409 });
  }
  if ((emailRows ?? []).length > 1) {
    return NextResponse.json({ error: "تعذّر ربط هذا البريد تلقائيًا. تواصل معنا للمساعدة." }, { status: 409 });
  }
  if (emailRows?.[0]) {
    const { data: linked, error } = await admin
      .from("parents")
      .update({ user_id: user.id, email })
      .eq("id", emailRows[0].id)
      .is("user_id", null)
      .select("id, user_id")
      .maybeSingle();
    if (error) {
      console.error("[parent-signup] email link failed:", error.message);
      return NextResponse.json({ error: "تعذّر ربط الحساب" }, { status: 503 });
    }
    if (!linked || linked.user_id !== user.id) {
      const { data: owner } = await admin.from("parents").select("id, user_id").eq("id", emailRows[0].id).maybeSingle();
      if (owner?.user_id === user.id) return NextResponse.json({ ok: true, parentId: owner.id });
      return NextResponse.json({ error: "تعذّر ربط الحساب، حاول مرة أخرى" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, parentId: linked.id });
  }

  const { data: phoneRows, error: phoneError } = await admin
    .from("parents")
    .select("id, user_id, email")
    .eq("phone", phone);
  if (phoneError) {
    console.error("[parent-signup] phone lookup failed:", phoneError.message);
    return NextResponse.json({ error: "تعذّر إعداد الحساب" }, { status: 503 });
  }
  if ((phoneRows ?? []).length > 1 || phoneRows?.some((row) => row.user_id || row.email)) {
    return NextResponse.json({ error: "هذا الرقم مرتبط بحساب آخر بالفعل. تواصل معنا للمساعدة." }, { status: 409 });
  }
  if (phoneRows?.[0]) {
    const { data: linked, error } = await admin
      .from("parents")
      .update({ user_id: user.id, email })
      .eq("id", phoneRows[0].id)
      .is("user_id", null)
      .is("email", null)
      .select("id, user_id")
      .maybeSingle();
    if (error) {
      console.error("[parent-signup] legacy phone link failed:", error.message);
      return NextResponse.json({ error: "تعذّر ربط الحساب" }, { status: 503 });
    }
    if (!linked || linked.user_id !== user.id) {
      const { data: owner } = await admin.from("parents").select("id, user_id").eq("id", phoneRows[0].id).maybeSingle();
      if (owner?.user_id === user.id) return NextResponse.json({ ok: true, parentId: owner.id });
      return NextResponse.json({ error: "تعذّر ربط الحساب، حاول مرة أخرى" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, parentId: linked.id });
  }

  const { data: created, error: createError } = await admin
    .from("parents")
    .insert({ user_id: user.id, full_name: fullName, phone, email })
    .select("id")
    .single();
  if (createError) {
    const { data: racedParent } = await admin.from("parents").select("id").eq("user_id", user.id).maybeSingle();
    if (racedParent) return NextResponse.json({ ok: true, parentId: racedParent.id });
    console.error("[parent-signup] parent creation failed:", createError.message);
    return NextResponse.json({ error: "تعذّر إنشاء حساب ولي الأمر" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, parentId: created.id });
}