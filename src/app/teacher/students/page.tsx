import Link from "next/link";
import Shell from "@/components/Shell";
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
            <h1 className="title" style={{ fontSize: 32, marginTop: 16 }}>الطلاب</h1>
            <Link className="btn" href="/login">تسجيل الدخول ←</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const { data: teacher } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();

  const { data: subs } = teacher
    ? await supabase
        .from("subscriptions")
        .select("child_id, children(first_name, grade), cohorts(title)")
        .eq("status", "active")
    : { data: [] };

  return (
    <Shell>
      <main className="section">
        <div className="container">
          <span className="eyebrow">لوحة المعلم</span>
          <h1 className="title" style={{ fontSize: 34 }}>طلابي</h1>

          {(!subs || subs.length === 0) && (
            <p className="lead" style={{ marginTop: 20 }}>لا يوجد طلاب مرتبطون بمجموعاتك حاليًا.</p>
          )}

          <div style={{ marginTop: 24 }}>
            {(subs ?? []).map((s: any, i: number) => (
              <div className="session-row" key={i}>
                <div>
                  <b>{s.children?.first_name ?? "طالب"}</b>
                  <p style={{ margin: "4px 0 0", color: "var(--gray)" }}>
                    الصف {s.children?.grade} • {s.cohorts?.title}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <Link className="btn small outline" href={`/teacher/goals?child=${s.child_id}`}>
                    خطوة الأسبوع
                  </Link>
                  <Link className="btn small" href={`/teacher/assessment?child=${s.child_id}`}>
                    تقييم دوري
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </Shell>
  );
}
