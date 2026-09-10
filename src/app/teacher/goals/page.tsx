import Link from "next/link";
import Shell from "@/components/Shell";
import GoalForm from "./GoalForm";
import GoalStatusButtons from "./GoalStatusButtons";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function P({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const params = await searchParams;
  const childId = params.child;

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
            <Link className="btn" href="/login">تسجيل الدخول ←</Link>
          </div>
        </main>
      </Shell>
    );
  }

  if (!childId) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <p className="lead">افتح هذه الصفحة من قائمة "طلابي" في لوحة المعلم.</p>
            <Link className="btn outline" href="/teacher/students">← طلابي</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const { data: child } = await supabase.from("children").select("first_name").eq("id", childId).maybeSingle();
  const { data: goals } = await supabase
    .from("weekly_goals")
    .select("id, title, description, category, status, week_start")
    .eq("child_id", childId)
    .order("week_start", { ascending: false })
    .limit(10);

  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">خطوة الأسبوع</span>
          <h1 className="title" style={{ fontSize: 32 }}>{child?.first_name ?? "الطالب"}</h1>

          {(goals ?? []).map((g) => (
            <div className="dashcard" key={g.id} style={{ marginBottom: 14 }}>
              <span className="badge">{g.category}</span>
              <h3 style={{ margin: "10px 0 4px" }}>{g.title}</h3>
              {g.description && <p style={{ color: "var(--gray)" }}>{g.description}</p>}
              <div style={{ marginTop: 10 }}>
                <GoalStatusButtons goalId={g.id} status={g.status} />
              </div>
            </div>
          ))}

          <GoalForm childId={childId} />
        </div>
      </main>
    </Shell>
  );
}
