import AdminShell from "@/components/AdminShell";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const PAGE_SIZE = 40;

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const admin = await getAdminIdentity();
  if (!admin) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;

  const params = await searchParams;
  const status = params.status ?? "";

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("payments")
    .select("id, amount_sar, status, provider, provider_ref, paid_at, created_at, parents(full_name)")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (status) query = query.eq("status", status);
  const { data: payments } = await query;

  const STATUS_LABELS: Record<string, string> = { pending: "قيد الانتظار", paid: "مدفوع", failed: "فشل", refunded: "مُسترَد" };

  return (
    <AdminShell adminName={admin.full_name}>
      <div className="admin-page-head">
        <h1>المدفوعات</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {["", "pending", "paid", "failed", "refunded"].map((s) => (
            <a key={s || "all"} href={s ? `/admin/payments?status=${s}` : "/admin/payments"} className={`btn small${status === s ? "" : " outline"}`}>
              {s ? STATUS_LABELS[s] : "الكل"}
            </a>
          ))}
        </div>
      </div>

      <p style={{ color: "var(--gray)", fontSize: 13, marginBottom: 16 }}>
        عرض فقط — لا إجراءات استرداد أو تعديل مالي هنا؛ بوابة الدفع (Paylink) هي مصدر الحقيقة الوحيد لحالة العملية الفعلية.
      </p>

      {(payments ?? []).length === 0 ? (
        <p className="admin-empty-state">لا توجد نتائج.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr><th>ولي الأمر</th><th>المبلغ</th><th>الحالة</th><th>المزوّد</th><th>مرجع العملية</th><th>تاريخ الدفع</th><th>تاريخ الإنشاء</th></tr>
            </thead>
            <tbody>
              {(payments ?? []).map((p: any) => (
                <tr key={p.id}>
                  <td>{p.parents?.full_name ?? "—"}</td>
                  <td>{p.amount_sar} ر.س</td>
                  <td>{STATUS_LABELS[p.status] ?? p.status}</td>
                  <td>{p.provider ?? "—"}</td>
                  <td dir="ltr" style={{ fontSize: 12 }}>{p.provider_ref ?? "—"}</td>
                  <td>{p.paid_at ? new Date(p.paid_at).toLocaleDateString("ar-SA") : "—"}</td>
                  <td>{new Date(p.created_at).toLocaleDateString("ar-SA")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
