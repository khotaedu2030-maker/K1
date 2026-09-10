import Link from "next/link";
import Shell from "@/components/Shell";
import RecommendationCard from "./RecommendationCard";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function P() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <span className="badge">تسجيل الدخول مطلوب</span>
            <h1 className="title" style={{ fontSize: 32, marginTop: 16 }}>التوصيات</h1>
            <Link className="btn" href="/login">تسجيل الدخول ←</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const { data: parent } = await supabase.from("parents").select("id").eq("user_id", user.id).maybeSingle();
  const { data: children } = parent
    ? await supabase.from("children").select("id").eq("parent_id", parent.id)
    : { data: [] };
  const childIds = (children ?? []).map((c) => c.id);

  const { data: recommendations } = childIds.length
    ? await supabase
        .from("recommendations")
        .select("id, subject, reason, status, created_at")
        .in("child_id", childIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">لوحة ولي الأمر</span>
          <h1 className="title" style={{ fontSize: 34 }}>التوصيات التعليمية</h1>

          {(!recommendations || recommendations.length === 0) && (
            <p className="lead" style={{ marginTop: 20 }}>لا توجد توصيات حتى الآن.</p>
          )}

          <div style={{ marginTop: 24 }}>
            {(recommendations ?? []).map((r) => (
              <RecommendationCard key={r.id} id={r.id} subject={r.subject} reason={r.reason} status={r.status} />
            ))}
          </div>
        </div>
      </main>
    </Shell>
  );
}
