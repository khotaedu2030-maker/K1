import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import ParentsTable from "./ParentsTable";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const PAGE_SIZE = 30;

export default async function AdminParentsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const admin = await getAdminIdentity();
  if (!admin) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = createSupabaseAdminClient();
  let query = supabase.from("parents").select("id, full_name, phone, email, created_at", { count: "exact" }).order("created_at", { ascending: false });
  if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  const { data: parents, count } = await query.range(from, from + PAGE_SIZE - 1);

  const parentIds = (parents ?? []).map((p: { id: string }) => p.id);
  const [{ data: childrenCounts }, { data: subCounts }] = await Promise.all([
    parentIds.length ? supabase.from("children").select("parent_id").in("parent_id", parentIds) : Promise.resolve({ data: [] }),
    parentIds.length ? supabase.from("subscriptions").select("parent_id, status").in("parent_id", parentIds) : Promise.resolve({ data: [] }),
  ]);
  const childCountByParent = new Map<string, number>();
  (childrenCounts ?? []).forEach((c: { parent_id: string }) => childCountByParent.set(c.parent_id, (childCountByParent.get(c.parent_id) ?? 0) + 1));
  const activeSubByParent = new Map<string, number>();
  (subCounts ?? []).forEach((s: { parent_id: string; status: string }) => {
    if (s.status === "active") activeSubByParent.set(s.parent_id, (activeSubByParent.get(s.parent_id) ?? 0) + 1);
  });

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <AdminShell adminName={admin.full_name}>
      <div className="admin-page-head">
        <h1>أولياء الأمور {count != null && <span style={{ color: "var(--gray)", fontWeight: 500, fontSize: 15 }}>({count})</span>}</h1>
        <form>
          <input className="admin-search" type="text" name="q" defaultValue={q} placeholder="بحث بالاسم أو الجوال أو البريد" />
        </form>
      </div>

      {(parents ?? []).length === 0 ? (
        <p className="admin-empty-state">لا توجد نتائج.</p>
      ) : (
        <ParentsTable
          parents={parents ?? []}
          childCountByParent={Object.fromEntries(childCountByParent)}
          activeSubByParent={Object.fromEntries(activeSubByParent)}
        />
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {page > 1 && <Link className="btn small outline" href={`/admin/parents?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>السابق</Link>}
          <span style={{ alignSelf: "center", color: "var(--gray)", fontSize: 13 }}>صفحة {page} من {totalPages}</span>
          {page < totalPages && <Link className="btn small outline" href={`/admin/parents?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>التالي</Link>}
        </div>
      )}
    </AdminShell>
  );
}
