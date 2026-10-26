import Link from "next/link";
import Shell from "@/components/Shell";
import { resolveParentContext } from "@/lib/pilot-parent";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import ParentChildTabs from "@/components/ParentChildTabs";
import { resolveOwnedChild } from "@/lib/parent-child-selection";

type ProgressSnapshot = {
  reading_score: number | null;
  writing_spelling_score: number | null;
  mathematics_score: number | null;
  english_score: number | null;
  focus_score: number | null;
  independence_score: number | null;
};

const dims: { key: keyof ProgressSnapshot; label: string }[] = [
  { key: "reading_score", label: "القراءة" },
  { key: "writing_spelling_score", label: "الإملاء" },
  { key: "mathematics_score", label: "الرياضيات" },
  { key: "english_score", label: "الإنجليزية" },
  { key: "focus_score", label: "التركيز" },
  { key: "independence_score", label: "الاستقلالية" },
];

export default async function P({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const context = await resolveParentContext();

  if (!context) {
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

  const supabase = createSupabaseAdminClient();
  const { data: children } = await supabase.from("children").select("id, first_name").eq("parent_id", context.parentId);
  const firstChild = resolveOwnedChild(children ?? [], (await searchParams).child);

  const { data: snapshots } = firstChild
    ? await supabase
        .from("child_progress_snapshots")
        .select("*")
        .eq("child_id", firstChild.id)
        .order("snapshot_date", { ascending: true })
    : { data: [] };

  const first = (snapshots?.[0] as ProgressSnapshot | undefined) ?? null;
  const latest = snapshots?.length ? snapshots[snapshots.length - 1] as ProgressSnapshot : null;

  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">لوحة ولي الأمر</span>
          <h1 className="title" style={{ fontSize: 34 }}>التقدّم — البداية → الآن</h1>
          {(children ?? []).length > 1 && <ParentChildTabs options={children ?? []} selectedId={firstChild?.id ?? null} basePath="/parent/reports" />}
          {(children ?? []).length > 0 && !firstChild && <p className="lead">الطفل المطلوب غير مرتبط بحسابك.</p>}
          <p className="lead">
            مؤشرات متابعة داخلية في خُطى، وليست قياسات علمية معيارية.
          </p>

          <div className="actions" style={{ marginBottom: 20 }}>
            <Link className="btn outline" href={firstChild ? "/parent/reports/weekly?child=" + encodeURIComponent(firstChild.id) : "/parent/reports/weekly"}>التقرير الأسبوعي ←</Link>
          </div>

          {!firstChild || !first || !latest ? (
            <p style={{ color: "var(--gray)" }}>لا توجد تقييمات مسجّلة بعد لعرض التقدّم.</p>
          ) : (
            <div className="dashcard">
              {dims.map((d) => {
                const from = first[d.key];
                const to = latest[d.key];
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
