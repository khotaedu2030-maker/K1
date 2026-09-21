import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// منح/إلغاء رصيد تعويض يدويًا من الإدارة — لا نظام تعويض ثانٍ، نستخدم جدول makeup_credits
// نفسه بـsource_type='manual_admin' (مُعفى أصلًا من السقف الشهري للغياب العادي حسب
// isMonthlyCapApplicable في policies.ts — هذا استثناء إداري صريح، لا عدّاد آلي).
export async function POST(req: Request) {
  const adminCheck = await requirePermission("makeup.manage");
  if (!adminCheck.ok) return adminCheck.response;

  const body = await req.json().catch(() => null);
  const op = body?.op as "grant" | "cancel" | undefined;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!reason) {
    return NextResponse.json({ error: "السبب مطلوب لأي إجراء يدوي على رصيد التعويض" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  if (op === "grant") {
    const childId = body?.childId as string | undefined;
    const subscriptionId = body?.subscriptionId as string | undefined;
    const expiresAt = typeof body?.expiresAt === "string" && body.expiresAt ? body.expiresAt : null;
    if (!childId) return NextResponse.json({ error: "الطفل مطلوب" }, { status: 400 });

    const { data: child } = await admin.from("children").select("id").eq("id", childId).maybeSingle();
    if (!child) return NextResponse.json({ error: "طفل غير موجود" }, { status: 400 });

    const { data: created, error } = await admin
      .from("makeup_credits")
      .insert({
        child_id: childId,
        subscription_id: subscriptionId || null,
        source_type: "manual_admin",
        reason,
        status: "available",
        issued_by: adminCheck.userId,
        // لا تاريخ انتهاء افتراضي مُخترَع — nullable إلا إذا حدَّده الأدمن صراحةً (لا سياسة
        // انتهاء معتمَدة لخُطى حاليًا). راجع التقرير النهائي لهذه النقطة تحديدًا.
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[admin-makeup-credits] فشل منح رصيد:", error.message);
      return NextResponse.json({ error: "تعذّر منح الرصيد" }, { status: 500 });
    }

    const { error: auditError } = await admin.from("admin_actions").insert({
      admin_user_id: adminCheck.userId,
      action: "makeup_credit_grant",
      entity_type: "makeup_credit",
      entity_id: created.id,
      new_value: { child_id: childId, source_type: "manual_admin" },
      reason,
    });
    if (auditError) console.error("[admin-makeup-credits] فشل تسجيل admin_actions (غير حاجب):", auditError.message);

    return NextResponse.json({ ok: true, id: created.id });
  }

  if (op === "cancel") {
    const creditId = body?.creditId as string | undefined;
    if (!creditId) return NextResponse.json({ error: "معرّف الرصيد مطلوب" }, { status: 400 });

    // إلغاء آمن فقط: available + manual_admin تحديدًا — لا نلغي رصيدًا نشأ فعليًا من غياب حقيقي
    // أو إلغاء معلم بضغطة واحدة من هذه الواجهة (قد يُفقِد الطالب حقًا مكتسَبًا فعليًا).
    const { data: existing } = await admin
      .from("makeup_credits")
      .select("id, status, source_type")
      .eq("id", creditId)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "رصيد غير موجود" }, { status: 404 });
    if (existing.status !== "available" || existing.source_type !== "manual_admin") {
      return NextResponse.json({ error: "لا يمكن إلغاء إلا رصيدًا يدويًا لا يزال متاحًا" }, { status: 409 });
    }

    const { error } = await admin.from("makeup_credits").update({ status: "cancelled" }).eq("id", creditId).eq("status", "available");
    if (error) {
      console.error("[admin-makeup-credits] فشل إلغاء رصيد:", error.message);
      return NextResponse.json({ error: "تعذّر إلغاء الرصيد" }, { status: 500 });
    }

    const { error: auditError } = await admin.from("admin_actions").insert({
      admin_user_id: adminCheck.userId,
      action: "makeup_credit_cancel",
      entity_type: "makeup_credit",
      entity_id: creditId,
      old_value: { status: "available" },
      new_value: { status: "cancelled" },
      reason,
    });
    if (auditError) console.error("[admin-makeup-credits] فشل تسجيل admin_actions (غير حاجب):", auditError.message);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "عملية غير معروفة" }, { status: 400 });
}
