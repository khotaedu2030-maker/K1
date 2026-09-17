import AdminShell from "@/components/AdminShell";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// عرض Metadata فقط عمدًا (لا محتوى الرسائل نفسه) — الخصوصية أولوية، لا نكشف كل محادثة خاصة
// بمجرد فتح لوحة الإدارة. تفاصيل محادثة بعينها تحتاج مسارًا منفصلًا مُبرَّرًا تشغيليًا، لم يُبنَ بعد.
export default async function AdminMessagesPage() {
  const admin = await getAdminIdentity();
  if (!admin) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;

  const supabase = createSupabaseAdminClient();
  const { data: threads } = await supabase
    .from("message_threads")
    .select("id, status, created_at, updated_at, children(first_name)")
    .order("updated_at", { ascending: false })
    .limit(100);

  return (
    <AdminShell adminName={admin.full_name}>
      <div className="admin-page-head">
        <h1>الرسائل</h1>
      </div>
      <p style={{ color: "var(--gray)", fontSize: 13, marginBottom: 16 }}>
        بيانات وصفية فقط (بلا محتوى المحادثات) حفاظًا على الخصوصية — عدد المحادثات وحالتها،
        لا نص الرسائل نفسه.
      </p>
      {(threads ?? []).length === 0 ? (
        <p className="admin-empty-state">لا توجد محادثات.</p>
      ) : (
        <table className="admin-table">
          <thead><tr><th>الطالب</th><th>الحالة</th><th>بدأت</th><th>آخر نشاط</th></tr></thead>
          <tbody>
            {(threads ?? []).map((t: any) => (
              <tr key={t.id}>
                <td>{t.children?.first_name ?? "—"}</td>
                <td>{t.status === "open" ? "مفتوحة" : "مغلقة"}</td>
                <td>{new Date(t.created_at).toLocaleDateString("ar-SA")}</td>
                <td>{new Date(t.updated_at).toLocaleDateString("ar-SA")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}
