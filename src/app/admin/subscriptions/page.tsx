import Link from "next/link";
import Shell from "@/components/Shell";
import ReviewButtons from "./ReviewButtons";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export default async function P() {
  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  const { data: adminRow } = user
    ? await authed.from("admins").select("id").eq("user_id", user.id).maybeSingle()
    : { data: null };

  if (!adminRow) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <span className="badge">غير مصرَّح</span>
            <Link className="btn outline" href="/">← الرئيسية</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: requestedPauses } = await admin
    .from("subscription_pauses")
    .select("id, subscription_id, start_date, end_date, reason, created_at, subscriptions(child_id, children(first_name))")
    .eq("status", "requested")
    .order("created_at", { ascending: true });

  return (
    <Shell>
      <main className="section">
        <div className="container">
          <span className="eyebrow">لوحة الإدارة</span>
          <h1 className="title" style={{ fontSize: 34 }}>طلبات تجميد الاشتراك</h1>

          {(!requestedPauses || requestedPauses.length === 0) && (
            <p className="lead" style={{ marginTop: 20 }}>لا توجد طلبات بانتظار المراجعة.</p>
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
        </div>
      </main>
    </Shell>
  );
}
