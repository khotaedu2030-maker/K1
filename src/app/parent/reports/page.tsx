import Link from "next/link";
import Shell from "@/components/Shell";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const dims: { key: string; label: string }[] = [
  { key: "reading_score", label: "القراءة" },
  { key: "writing_spelling_score", label: "الإملاء" },
  { key: "mathematics_score", label: "الرياضيات" },
  { key: "english_score", label: "الإنجليزية" },
  { key: "focus_score", label: "التركيز" },
  { key: "independence_score", label: "الاستقلالية" },
];

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
            <Link className="btn" href="/login">تسجيل الدخول ←</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const { data: parent } = await supabase.from("parents").select("id").eq("user_id", user.id).maybeSingle();
  const { data: children } = parent
    ? await supabase.from("children").select("id, first_name").eq("parent_id", parent.id)
    : { data: [] };
  const firstChild = children?.[0] ?? null;

  const { data: snapshots } = firstChild
    ? await supabase
        .from("child_progress_snapshots")
        .select("*")
        .eq("child_id", firstChild.id)
        .order("snapshot_date", { ascending: true })
    : { data: [] };

  const first = snapshots?.[0] ?? null;
  const latest = snapshots && snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">لوحة ولي الأمر</span>
          <h1 className="title" style={{ fontSize: 34 }}>التقدّم — البداية → الآن</h1>
          <p className="lead">
            مؤشرات متابعة داخلية في خُطى، وليست قياسات علمية معيارية.
          </p>

          <div className="actions" style={{ marginBottom: 20 }}>
            <Link className="btn outline" href="/parent/reports/weekly">التقرير الأسبوعي ←</Link>
          </div>

          {!first || !latest ? (
            <p style={{ color: "var(--gray)" }}>لا توجد تقييمات مسجّلة بعد لعرض التقدّم.</p>
          ) : (
            <div className="dashcard">
              {dims.map((d) => {
                const from = (first as any)[d.key];
                const to = (latest as any)[d.key];
                if (from == null || to == null) return null;
                return (
                  <div className="taskline" key={d.key}>
                    <span style={{ minWidth: 100 }}>{d.label}</span>
                    <span>
                      {from}/5 → <b style={{ color: to > from ? "var(--t)" : to < from ? "var(--p)" : "inherit" }}>{to}/5</b>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </Shell>
  );
}
