import AdminShell from "@/components/AdminShell";
import { GrantCreditForm, CancelCreditButton } from "./MakeupCreditActions";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const STATUS_LABELS: Record<string, string> = { available: "متاح", reserved: "محجوز", used: "مُستخدَم", expired: "منتهٍ", cancelled: "ملغى" };
const SOURCE_LABELS: Record<string, string> = { student_absence: "غياب طالب", teacher_cancellation: "إلغاء معلم", platform_cancellation: "إلغاء من خُطى", manual_admin: "منح يدوي من الإدارة" };

export default async function AdminMakeupCreditsPage() {
  const admin = await getAdminIdentity("makeup.manage");
  if (!admin) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;

  const supabase = createSupabaseAdminClient();
  const { data: credits } = await supabase
    .from("makeup_credits")
    .select("id, source_type, reason, status, issued_at, expires_at, children(first_name, parents(full_name))")
    .order("issued_at", { ascending: false })
    .limit(100);

  return (
    <AdminShell adminName={admin.full_name}>
      <div className="admin-page-head">
        <h1>التعويضات</h1>
      </div>

      <GrantCreditForm />

      <p style={{ color: "var(--gray)", fontSize: 13, margin: "16px 0" }}>
        الإلغاء متاح فقط للأرصدة اليدوية (manual_admin) التي لا تزال "متاحة" — لا يمكن إلغاء
        رصيد نشأ فعليًا من غياب حقيقي أو إلغاء معلم من هذه الواجهة. لا يوجد تاريخ انتهاء تلقائي
        مُطبَّق افتراضيًا (لا سياسة انتهاء معتمَدة لخُطى بعد) — الحقل اختياري فقط عند المنح.
      </p>

      {(credits ?? []).length === 0 ? (
        <p className="admin-empty-state">لا توجد أرصدة تعويض.</p>
      ) : (
        <table className="admin-table">
          <thead><tr><th>الطالب</th><th>ولي الأمر</th><th>المصدر</th><th>السبب</th><th>الحالة</th><th>تاريخ الإصدار</th><th>انتهاء الصلاحية</th><th></th></tr></thead>
          <tbody>
            {(credits ?? []).map((c: any) => (
              <tr key={c.id}>
                <td>{c.children?.first_name ?? "—"}</td>
                <td>{c.children?.parents?.full_name ?? "—"}</td>
                <td>{SOURCE_LABELS[c.source_type] ?? c.source_type}</td>
                <td>{c.reason ?? "—"}</td>
                <td>{STATUS_LABELS[c.status] ?? c.status}</td>
                <td>{new Date(c.issued_at).toLocaleDateString("ar-SA")}</td>
                <td>{c.expires_at ? new Date(c.expires_at).toLocaleDateString("ar-SA") : "—"}</td>
                <td>{c.status === "available" && c.source_type === "manual_admin" && <CancelCreditButton creditId={c.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}
