import { NextResponse } from "next/server";
import { requireAdmin, adminRoleHasPermission } from "@/lib/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// A badge means an item still needs an action, not merely that a page was opened.
// Messaging is different: this count is activity since an explicit metadata review,
// never the private messages' read_at receipts used by parents and teachers.
const SOURCE_RULES = [
  { href: "/admin/teacher-applications", permission: "teacher_application.review", table: "teacher_applications", status: "new" },
  { href: "/admin/subscriptions", permission: "subscription.review", table: "subscription_pauses", status: "requested" },
  { href: "/admin/support", permission: "support.manage", table: "support_cases", status: "new" },
  { href: "/admin/exceptions", permission: "exception.manage", table: "operational_exceptions", status: "open" },
  { href: "/admin/pilot-activations", permission: "pilot.activate", table: "subscriptions", status: "pending_payment" },
] as const;

export async function GET() {
  const identity = await requireAdmin();
  if (!identity.ok) return identity.response;

  const admin = createSupabaseAdminClient();
  // Only query entities this admin has been authorized to see.
  const counts: Record<string, number> = {};
  const work: Promise<void>[] = [];
  let failed = false;

  for (const rule of SOURCE_RULES) {
    if (!adminRoleHasPermission(identity.role, rule.permission)) continue;
    work.push((async () => {
      const { count, error } = await admin.from(rule.table)
        .select("id", { count: "exact", head: true }).eq("status", rule.status);
      if (error) { failed = true; console.error("[admin-badges] count failed", rule.table, error.code); return; }
      counts[rule.href] = count ?? 0;
    })());
  }

  if (adminRoleHasPermission(identity.role, "request.read")) {
    work.push((async () => {
      const [contact, interest] = await Promise.all([
        admin.from("contact_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
        admin.from("premium_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
      ]);
      if (contact.error || interest.error) { failed = true; console.error("[admin-badges] requests count failed"); return; }
      counts["/admin/requests"] = (contact.count ?? 0) + (interest.count ?? 0);
    })());
  }

  if (adminRoleHasPermission(identity.role, "teacher.manage")) {
    work.push((async () => {
      const { count, error } = await admin.from("teachers")
        .select("id", { count: "exact", head: true }).eq("active", true).is("user_id", null);
      if (error) { failed = true; console.error("[admin-badges] teacher readiness failed"); return; }
      counts["/admin/teachers"] = count ?? 0;
    })());
  }

  if (adminRoleHasPermission(identity.role, "cohort.manage")) {
    work.push((async () => {
      const { data, error } = await admin.from("cohorts")
        .select("id,teacher_id,meeting_url").eq("status", "open");
      if (error) { failed = true; console.error("[admin-badges] group readiness failed"); return; }
      counts["/admin/groups"] = (data ?? []).filter(row => !row.teacher_id || !row.meeting_url?.trim()).length;
    })());
  }

  if (adminRoleHasPermission(identity.role, "messages.metadata.read")) {
    work.push((async () => {
      const { data: reviewed, error: reviewError } = await admin.from("admin_navigation_seen")
        .select("messages_reviewed_at").eq("admin_id", identity.adminId).maybeSingle();
      if (reviewError) { failed = true; console.error("[admin-badges] message review state failed"); return; }
      const lastReviewed = reviewed?.messages_reviewed_at ?? "1970-01-01T00:00:00.000Z";
      const { count, error } = await admin.from("messages")
        .select("id", { count: "exact", head: true }).gt("created_at", lastReviewed);
      if (error) { failed = true; console.error("[admin-badges] message activity count failed"); return; }
      counts["/admin/messages"] = count ?? 0;
    })());
  }

  await Promise.all(work);
  if (failed) return NextResponse.json({ error: "تعذّر تحديث التنبيهات" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ counts }, { headers: { "Cache-Control": "no-store, private" } });
}
