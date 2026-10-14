import { NextResponse } from "next/server";
import { declaredBodyExceeds, readJsonBodyLimited } from "@/lib/api-rate-limit";
import { requirePermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const MAX_BODY_BYTES = 4 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATUS_BY_KIND = {
  contact: new Set(["new", "reviewing", "closed"]),
  premium: new Set(["new", "contacted", "converted", "closed"]),
} as const;

export async function POST(req: Request) {
  const check = await requirePermission("support.manage");
  if (!check.ok) return check.response;

  if (declaredBodyExceeds(req, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  }
  const parsed = await readJsonBodyLimited(req, MAX_BODY_BYTES);
  if (!parsed.ok) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });

  const kind = parsed.body?.kind;
  const id = typeof parsed.body?.id === "string" ? parsed.body.id : "";
  const status = typeof parsed.body?.status === "string" ? parsed.body.status : "";
  if ((kind !== "contact" && kind !== "premium") || !UUID_RE.test(id) || !STATUS_BY_KIND[kind].has(status)) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const table = kind === "contact" ? "contact_requests" : "premium_requests";
  const { data: current, error: currentError } = await admin
    .from(table)
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (currentError) {
    console.error("[request-status] lookup failed:", currentError.message);
    return NextResponse.json({ error: "تعذّر جلب الطلب" }, { status: 503 });
  }
  if (!current) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  if (current.status === status) return NextResponse.json({ ok: true, changed: false });

  const { data: updated, error: updateError } = await admin
    .from(table)
    .update({ status })
    .eq("id", id)
    .eq("status", current.status)
    .select("id, status")
    .maybeSingle();

  if (updateError) {
    console.error("[request-status] update failed:", updateError.message);
    return NextResponse.json({ error: "تعذّر تحديث الحالة" }, { status: 503 });
  }
  if (!updated) {
    return NextResponse.json({ error: "تم تعديل الطلب من جلسة أخرى. حدّث الصفحة وحاول مرة أخرى." }, { status: 409 });
  }

  const { error: auditError } = await admin.from("admin_actions").insert({
    admin_user_id: check.userId,
    action: kind === "contact" ? "contact_request_status_changed" : "premium_request_status_changed",
    entity_type: kind === "contact" ? "contact_request" : "premium_request",
    entity_id: id,
    old_value: { status: current.status },
    new_value: { status },
  });
  if (auditError) console.error("[request-status] audit insert failed:", auditError.message);

  return NextResponse.json({ ok: true, changed: true });
}
