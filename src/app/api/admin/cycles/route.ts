import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const EDITABLE_STATUSES = ["draft", "registration_open", "in_progress"] as const;
type EditableStatus = (typeof EDITABLE_STATUSES)[number];

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validateCycleFields(input: {
  name: unknown;
  startDate: unknown;
  endDate: unknown;
  registrationStart?: unknown;
  registrationEnd?: unknown;
}) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 160) return "اسم الدورة مطلوب";
  if (!validDate(input.startDate) || !validDate(input.endDate)) return "تاريخا البداية والنهاية مطلوبان بصيغة صحيحة";
  if (input.endDate < input.startDate) return "تاريخ النهاية يجب ألا يسبق تاريخ البداية";
  if (input.registrationStart != null && input.registrationStart !== "" && !validDate(input.registrationStart)) return "بداية التسجيل غير صالحة";
  if (input.registrationEnd != null && input.registrationEnd !== "" && !validDate(input.registrationEnd)) return "نهاية التسجيل غير صالحة";
  if (input.registrationStart && input.registrationEnd && input.registrationStart > input.registrationEnd) return "بداية التسجيل يجب ألا تسبق نهايته";
  if (input.registrationEnd && input.registrationEnd > input.endDate) return "نهاية التسجيل يجب ألا تتجاوز نهاية الدورة";
  return null;
}

function statusLabel(status: string) {
  return ({
    draft: "مسودة",
    registration_open: "التسجيل مفتوح",
    in_progress: "جارية",
    completed: "مكتملة",
    archived: "مؤرشفة",
  } as Record<string, string>)[status] ?? "غير معروفة";
}

function blockerLabel(code: string, count: number) {
  const labels: Record<string, string> = {
    unresolved_attendance: "جلسات مكتملة بلا سجلات حضور",
    critical_exception: "استثناءات تشغيلية حرجة مفتوحة",
    financial_activation_conflict: "تعارضات مالية/تفعيل مفتوحة",
    refund_entitlement_review: "استردادات تحتاج مراجعة استحقاق",
  };
  return `${labels[code] ?? "عائق تشغيلي"} (${count})`;
}

async function audit(admin: ReturnType<typeof createSupabaseAdminClient>, adminUserId: string, action: string, cycleId: string, newValue: unknown) {
  const { error } = await admin.from("admin_actions").insert({
    admin_user_id: adminUserId,
    action,
    entity_type: "cycle",
    entity_id: cycleId,
    new_value: newValue,
  });
  if (error) console.error(`[admin-cycles] audit ${action} failed:`, error.message);
}

export async function GET() {
  const check = await requirePermission("cohort.manage");
  if (!check.ok) return check.response;
  const admin = createSupabaseAdminClient();
  const [{ data: cycles, error: cyclesError }, { data: cohorts, error: cohortsError }] = await Promise.all([
    admin.from("cycles").select("id, name, start_date, end_date, registration_start, registration_end, enabled_grade_bands, status, created_at").order("start_date", { ascending: false }),
    admin.from("cohorts").select("id, title, cycle_id, status, capacity").not("cycle_id", "is", null),
  ]);
  if (cyclesError || cohortsError) {
    console.error("[admin-cycles] list failed:", cyclesError?.message ?? cohortsError?.message);
    return NextResponse.json({ error: "تعذّر تحميل الدورات" }, { status: 500 });
  }
  return NextResponse.json({ cycles: cycles ?? [], cohorts: cohorts ?? [] });
}

export async function POST(req: Request) {
  const check = await requirePermission("cohort.manage");
  if (!check.ok) return check.response;
  const body = await req.json().catch(() => null);
  if (body?.action === "complete") {
    const cycleId = typeof body?.cycleId === "string" ? body.cycleId.trim() : "";
    if (!cycleId) return NextResponse.json({ error: "معرّف الدورة مطلوب" }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("complete_cycle_atomic", {
      p_cycle_id: cycleId,
      p_actor: check.userId,
      p_override: false,
      p_override_reason: null,
    });
    if (error) {
      console.error("[admin-cycles] completion RPC failed:", error.message);
      return NextResponse.json({ error: "تعذّر إكمال الدورة" }, { status: 500 });
    }
    const result = data as { ok?: boolean; changed?: boolean; already_completed?: boolean; error?: string; operational_reasons?: { code: string; count: number }[]; financial_reasons?: { code: string; count: number }[] } | null;
    if (!result?.ok) {
      const reasons = [...(result?.financial_reasons ?? []), ...(result?.operational_reasons ?? [])].map((reason) => blockerLabel(reason.code, reason.count)).join("، ");
      return NextResponse.json({ error: reasons ? `لا يمكن إكمال الدورة: ${reasons}` : "لا يمكن إكمال الدورة حاليًا" }, { status: 409 });
    }
    await audit(admin, check.userId, "cycle_complete", cycleId, { changed: result.changed, alreadyCompleted: result.already_completed });
    return NextResponse.json({ ok: true, alreadyCompleted: result.already_completed === true });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const startDate = body?.startDate;
  const endDate = body?.endDate;
  const registrationStart = body?.registrationStart || null;
  const registrationEnd = body?.registrationEnd || null;
  const enabledGradeBands = Array.isArray(body?.enabledGradeBands) ? body.enabledGradeBands.filter((band: unknown): band is string => ["1-3", "4-6", "7-9", "10-12"].includes(String(band))) : [];
  const validation = validateCycleFields({ name, startDate, endDate, registrationStart, registrationEnd });
  if (validation) return NextResponse.json({ error: validation }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: created, error } = await admin.from("cycles").insert({
    name,
    start_date: startDate,
    end_date: endDate,
    registration_start: registrationStart,
    registration_end: registrationEnd,
    enabled_grade_bands: enabledGradeBands,
    status: "draft",
    created_by: check.userId,
  }).select("id").single();
  if (error || !created) {
    console.error("[admin-cycles] create failed:", error?.message);
    return NextResponse.json({ error: "تعذّر إنشاء الدورة" }, { status: 500 });
  }
  await audit(admin, check.userId, "cycle_create", created.id, { name, startDate, endDate, status: "draft" });
  return NextResponse.json({ ok: true, id: created.id });
}

export async function PATCH(req: Request) {
  const check = await requirePermission("cohort.manage");
  if (!check.ok) return check.response;
  const body = await req.json().catch(() => null);
  const cycleId = typeof body?.cycleId === "string" ? body.cycleId.trim() : "";
  if (!cycleId) return NextResponse.json({ error: "معرّف الدورة مطلوب" }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data: current } = await admin.from("cycles").select("*").eq("id", cycleId).maybeSingle();
  if (!current) return NextResponse.json({ error: "الدورة غير موجودة" }, { status: 404 });
  if (current.status === "completed" || current.status === "archived") return NextResponse.json({ error: "لا يمكن تعديل دورة مكتملة أو مؤرشفة" }, { status: 409 });

  const nextStatus = body?.status as string | undefined;
  if (nextStatus && nextStatus !== current.status && !EDITABLE_STATUSES.includes(nextStatus as EditableStatus)) {
    return NextResponse.json({ error: "حالة الدورة غير صالحة" }, { status: 400 });
  }
  if (nextStatus && nextStatus !== current.status) {
    const allowed = (current.status === "draft" && nextStatus === "registration_open") || (current.status === "registration_open" && nextStatus === "in_progress");
    if (!allowed) return NextResponse.json({ error: "انتقال حالة الدورة غير مسموح" }, { status: 409 });
  }

  const update = {
    name: typeof body?.name === "string" ? body.name.trim() : current.name,
    start_date: body?.startDate ?? current.start_date,
    end_date: body?.endDate ?? current.end_date,
    registration_start: body?.registrationStart === "" ? null : (body?.registrationStart ?? current.registration_start),
    registration_end: body?.registrationEnd === "" ? null : (body?.registrationEnd ?? current.registration_end),
    enabled_grade_bands: Array.isArray(body?.enabledGradeBands) ? body.enabledGradeBands.filter((band: unknown): band is string => ["1-3", "4-6", "7-9", "10-12"].includes(String(band))) : current.enabled_grade_bands,
    status: nextStatus ?? current.status,
  };
  const validation = validateCycleFields({ name: update.name, startDate: update.start_date, endDate: update.end_date, registrationStart: update.registration_start, registrationEnd: update.registration_end });
  if (validation) return NextResponse.json({ error: validation }, { status: 400 });

  const { error } = await admin.from("cycles").update(update).eq("id", cycleId).not("status", "in", "(completed,archived)");
  if (error) {
    console.error("[admin-cycles] update failed:", error.message);
    return NextResponse.json({ error: "تعذّر حفظ الدورة" }, { status: 500 });
  }
  await audit(admin, check.userId, "cycle_update", cycleId, update);
  return NextResponse.json({ ok: true });
}
