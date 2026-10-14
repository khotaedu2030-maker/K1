import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { supabaseRelationOne, type SupabaseRelation } from "@/lib/supabase-relations";

const PAGE_SIZE = 30;

type ChildRow = {
  id: string;
  first_name: string;
  grade: string | null;
  parents: SupabaseRelation<{ full_name: string | null; phone: string | null }>;
};
type ChildSubscriptionRow = {
  child_id: string;
  status: string;
  cohorts: SupabaseRelation<{ title: string | null }>;
};

export default async function AdminStudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const admin = await getAdminIdentity("student.read");
  if (!admin) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("children")
    .select("id, first_name, grade, created_at, parents(full_name, phone)", { count: "exact" })
    .order("created_at", { ascending: false });
  if (q) query = query.ilike("first_name", `%${q}%`);
  const { data: children, count } = await query.range(from, from + PAGE_SIZE - 1);

  const childIds = (children ?? []).map((c: { id: string }) => c.id);
  const { data: subs } = childIds.length
    ? await supabase.from("subscriptions").select("child_id, status, cohorts(title)").in("child_id", childIds)
    : { data: [] };
  const subByChild = new Map<string, ChildSubscriptionRow>();
  ((subs ?? []) as ChildSubscriptionRow[]).forEach((s) => {
    // نفضّل الاشتراك الفعّال إن وُجد أكثر من واحد تاريخيًا لنفس الطفل
    if (!subByChild.has(s.child_id) || s.status === "active") subByChild.set(s.child_id, s);
  });

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <AdminShell adminName={admin.full_name} role={admin.role}>
      <div className="admin-page-head">
        <h1>الأبناء {count != null && <span style={{ color: "var(--gray)", fontWeight: 500, fontSize: 15 }}>({count})</span>}</h1>
        <form>
          <input className="admin-search" type="text" name="q" defaultValue={q} placeholder="بحث بالاسم" />
        </form>
      </div>

      {(children ?? []).length === 0 ? (
        <p className="admin-empty-state">لا توجد نتائج.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr><th>الاسم</th><th>الصف</th><th>ولي الأمر</th><th>الجوال</th><th>المجموعة</th><th>حالة الاشتراك</th></tr>
            </thead>
            <tbody>
              {((children ?? []) as ChildRow[]).map((c) => {
                const sub = subByChild.get(c.id);
                return (
                  <tr key={c.id}>
                    <td>{c.first_name}</td>
                    <td>{c.grade}</td>
                    <td>{supabaseRelationOne(c.parents)?.full_name ?? "—"}</td>
                    <td dir="ltr">{supabaseRelationOne(c.parents)?.phone ?? "—"}</td>
                    <td>{supabaseRelationOne(sub?.cohorts)?.title ?? "—"}</td>
                    <td>{sub?.status ?? "بلا اشتراك"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {page > 1 && <Link className="btn small outline" href={`/admin/students?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>السابق</Link>}
          <span style={{ alignSelf: "center", color: "var(--gray)", fontSize: 13 }}>صفحة {page} من {totalPages}</span>
          {page < totalPages && <Link className="btn small outline" href={`/admin/students?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>التالي</Link>}
        </div>
      )}
    </AdminShell>
  );
}
