import AdminShell from "@/components/AdminShell";
import ReviewButtons from "./ReviewButtons";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export default async function P() {
  const adminIdentity = await getAdminIdentity();

  if (!adminIdentity) {
    return (
      <div className="placeholder-page">
        <div className="narrow">
          <span className="badge">غير مصرَّح</span>
        </div>
      </div>
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: requestedPauses } = await admin
    .from("subscription_pauses")
    .select("id, subscription_id, start_date, end_date, reason, created_at, subscriptions(child_id, children(first_name))")
    .eq("status", "requested")
    .order("created_at", { ascending: true });

  return (
    <AdminShell adminName={adminIdentity.full_name}>
      <div className="admin-page-head">
        <h1>طلبات تجميد الاشتراك</h1>
      </div>

      {(!requestedPauses || requestedPauses.length === 0) && (
        <p className="admin-empty-state">لا توجد طلبات بانتظار المراجعة.</p>
      )}

      {(requestedPauses ?? []).map((p: any) => (
        <div className="session-row" key={p.id}>
          <div>
            <b>{p.subscriptions?.children?.first_name ?? "طالب"}</b>
            <p style={{ margin: "4px 0 0", color: "var(--gray)" }}>
              {p.start_date} → {p.end_date} {p.reason ? `• ${p.reason}` : ""}
            </p>
          </div>
          <ReviewButtons pauseId={p.id} />
        </div>
      ))}
    </AdminShell>
  );
}
