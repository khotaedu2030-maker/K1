import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// جلب تفصيلي محدود عند الطلب فقط (لا Preload) — يفتح عند نقر صف ولي أمر بلوحة الإدارة.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requirePermission("parent.context.read");
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { data: parent } = await admin.from("parents").select("id, full_name, phone, email, created_at").eq("id", id).maybeSingle();
  if (!parent) return NextResponse.json({ error: "ولي أمر غير موجود" }, { status: 404 });

  const [{ data: children }, { data: payments }] = await Promise.all([
    admin
      .from("children")
      .select("id, first_name, grade, subscriptions(id, status, cohort_id, cohorts(id, title, grade_band, grade, cycle_id))")
      .eq("parent_id", id)
      .limit(20),
    adminCheck.role === "super_admin" || adminCheck.role === "finance_admin"
      ? admin.from("payments").select("status, amount_sar, paid_at").eq("parent_id", id).order("created_at", { ascending: false }).limit(5)
      : Promise.resolve({ data: [] }),
  ]);

  const childIds = (children ?? []).map((c: { id: string }) => c.id);
  const { data: makeupCredits } = childIds.length
    ? await admin.from("makeup_credits").select("child_id, status").in("child_id", childIds).eq("status", "available")
    : { data: [] };
  const makeupByChild = new Map<string, number>();
  (makeupCredits ?? []).forEach((m: { child_id: string }) => makeupByChild.set(m.child_id, (makeupByChild.get(m.child_id) ?? 0) + 1));

  const childrenWithTransfers = await Promise.all((children ?? []).map(async (c: any) => {
    const subscription = c.subscriptions?.[0];
    if (!subscription || subscription.status !== "active" || !subscription.cohorts) return { ...c, transferTargets: [] };
    const currentCohort = subscription.cohorts;
    let candidateQuery = admin
      .from("cohorts")
      .select("id, title, status, capacity, grade_band, grade, cycle_id")
      .neq("id", currentCohort.id)
      .in("status", ["open", "full"])
      .eq("grade_band", currentCohort.grade_band);
    candidateQuery = currentCohort.cycle_id === null
      ? candidateQuery.is("cycle_id", null)
      : candidateQuery.eq("cycle_id", currentCohort.cycle_id);
    const { data: candidates } = await candidateQuery;
    const transferTargets = [];
    for (const candidate of candidates ?? []) {
      if (currentCohort.grade != null && candidate.grade != null && currentCohort.grade !== candidate.grade) continue;
      const { data: occupied } = await admin.rpc("cohort_occupied_seats", { p_cohort_id: candidate.id });
      if ((occupied ?? 0) < candidate.capacity) transferTargets.push({ id: candidate.id, title: candidate.title });
    }
    return { ...c, transferTargets };
  }));

  return NextResponse.json({
    parent,
    children: childrenWithTransfers.map((c: { id: string; first_name: string; grade: number; transferTargets: { id: string; title: string }[]; subscriptions: { id: string; status: string; cohort_id: string; cohorts: { id: string; title: string; grade_band: string; grade: number | null; cycle_id: string | null } | null }[] | null }) => ({
      id: c.id,
      firstName: c.first_name,
      grade: c.grade,
      subscriptionId: c.subscriptions?.[0]?.id ?? null,
      subscriptionStatus: c.subscriptions?.[0]?.status ?? null,
      cohortTitle: c.subscriptions?.[0]?.cohorts?.title ?? null,
      currentCohortId: c.subscriptions?.[0]?.cohort_id ?? null,
      transferTargets: c.transferTargets,
      makeupAvailable: makeupByChild.get(c.id) ?? 0,
    })),
    recentPayments: payments ?? [],
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requirePermission("cohort.manage");
  if (!adminCheck.ok) return adminCheck.response;
  const { id: parentId } = await params;
  const body = await req.json().catch(() => null);
  const subscriptionId = typeof body?.subscriptionId === "string" ? body.subscriptionId.trim() : "";
  const newCohortId = typeof body?.newCohortId === "string" ? body.newCohortId.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(subscriptionId) || !uuidPattern.test(newCohortId) || !reason || reason.length > 1000) {
    return NextResponse.json({ error: "الاشتراك والمجموعة الجديدة والسبب مطلوبة" }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  const { data: subscription } = await admin.from("subscriptions").select("id, parent_id").eq("id", subscriptionId).maybeSingle();
  if (!subscription || subscription.parent_id !== parentId) return NextResponse.json({ error: "الاشتراك غير موجود" }, { status: 404 });
  const { data, error } = await admin.rpc("transfer_subscription_cohort_atomic", {
    p_subscription_id: subscriptionId,
    p_new_cohort_id: newCohortId,
    p_actor: adminCheck.userId,
    p_reason: reason,
  });
  if (error) {
    console.error("[admin-parent-transfer] transfer RPC failed:", error.message);
    return NextResponse.json({ error: "تعذّر نقل الاشتراك" }, { status: 500 });
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    const messages: Record<string, string> = {
      subscription_not_found: "الاشتراك غير موجود",
      subscription_not_active: "لا يمكن نقل اشتراك غير فعّال",
      subscription_has_no_current_cohort: "الاشتراك بلا مجموعة حالية",
      same_cohort: "المجموعة الجديدة مطابقة للمجموعة الحالية",
      target_cohort_not_found: "المجموعة الجديدة غير موجودة",
      target_cohort_not_open: "المجموعة الجديدة غير متاحة",
      grade_band_mismatch: "النطاق الدراسي غير متوافق",
      grade_mismatch: "الصف غير متوافق",
      cycle_mismatch: "الدورة غير متوافقة",
      target_cohort_full: "اكتملت سعة المجموعة الجديدة",
      reason_required: "سبب النقل مطلوب",
    };
    return NextResponse.json({ error: messages[result?.error ?? ""] ?? "تعذّر نقل الاشتراك" }, { status: 409 });
  }
  const { error: auditError } = await admin.from("admin_actions").insert({
    admin_user_id: adminCheck.userId,
    action: "subscription_cohort_transfer",
    entity_type: "subscription",
    entity_id: subscriptionId,
    new_value: { new_cohort_id: newCohortId },
    reason,
  });
  if (auditError) console.error("[admin-parent-transfer] audit failed:", auditError.message);
  return NextResponse.json({ ok: true });
}
