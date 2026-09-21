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
      .select("id, first_name, grade, subscriptions(status, cohorts(title))")
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

  return NextResponse.json({
    parent,
    children: (children ?? []).map((c: { id: string; first_name: string; grade: number; subscriptions: { status: string; cohorts: { title: string }[] }[] | null }) => ({
      id: c.id,
      firstName: c.first_name,
      grade: c.grade,
      subscriptionStatus: c.subscriptions?.[0]?.status ?? null,
      cohortTitle: c.subscriptions?.[0]?.cohorts?.[0]?.title ?? null,
      makeupAvailable: makeupByChild.get(c.id) ?? 0,
    })),
    recentPayments: payments ?? [],
  });
}
