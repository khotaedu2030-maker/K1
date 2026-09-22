import AdminShell from "@/components/AdminShell";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import SupportCaseActions from "./SupportCaseActions";
import ConvertButton from "./ConvertButton";

const STATUS_LABELS: Record<string, string> = { new: "جديدة", in_progress: "قيد العمل", resolved: "مُغلَقة" };
const PRIORITY_LABELS: Record<string, string> = { normal: "عادية", high: "عالية" };
const VALID_STATUSES = ["new", "in_progress", "resolved"];

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const admin = await getAdminIdentity();
  if (!admin) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;

  const selectedStatus = (await searchParams).status ?? "";
  const statusFilter = VALID_STATUSES.includes(selectedStatus) ? selectedStatus : "";
  const supabase = createSupabaseAdminClient();
  let casesQuery = supabase
    .from("support_cases")
    .select("id, category, priority, status, subject, description, resolution_note, created_at, updated_at, assigned_to, parents(full_name, phone, email), children(first_name), contact_requests(full_name, email, phone, message), admins:assigned_to(full_name)")
    .order("created_at", { ascending: false })
    .limit(80);
  if (statusFilter) casesQuery = casesQuery.eq("status", statusFilter);

  const [{ data: casesRaw }, { data: admins }, { data: contacts }] = await Promise.all([
    casesQuery,
    supabase.from("admins").select("id, full_name").eq("active", true),
    supabase.from("contact_requests").select("id, full_name, email, phone, message, created_at").eq("status", "new").order("created_at", { ascending: false }).limit(30),
  ]);
  const cases = (casesRaw ?? []) as any[];

  return (
    <AdminShell adminName={admin.full_name}>
      <div className="admin-page-head"><h1>حالات الدعم</h1></div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["", ...VALID_STATUSES].map((status) => (
          <a key={status || "all"} href={`/admin/support${status ? `?status=${status}` : ""}`} className={`btn small${statusFilter === status ? "" : " outline"}`}>
            {status ? STATUS_LABELS[status] : "كل الحالات"}
          </a>
        ))}
      </div>

      {(contacts ?? []).length > 0 && (
        <div className="dashcard" style={{ marginBottom: 20 }}>
          <b>رسائل تواصل جديدة غير مُحوَّلة ({(contacts ?? []).length})</b>
          {(contacts ?? []).map((contact: any) => (
            <div className="taskline" key={contact.id}>
              <span>{contact.full_name} — {contact.message.slice(0, 80)}</span>
              <ConvertButton contactRequestId={contact.id} />
            </div>
          ))}
        </div>
      )}

      {cases.length === 0 ? <p className="admin-empty-state">لا توجد حالات دعم مطابقة.</p> : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead><tr><th>الطالب/الأسرة</th><th>الموضوع والتفاصيل</th><th>الفئة</th><th>الأولوية</th><th>الحالة</th><th>المسؤول</th><th>التاريخ</th><th>إجراء</th></tr></thead>
            <tbody>{cases.map((supportCase) => (
              <tr key={supportCase.id}>
                <td>{supportCase.children?.first_name ?? supportCase.parents?.full_name ?? "—"}<span style={{ display: "block", color: "var(--gray)", fontSize: 11 }}>{supportCase.parents?.phone ?? supportCase.contact_requests?.phone ?? ""}</span></td>
                <td style={{ maxWidth: 280, fontSize: 12 }}><b>{supportCase.subject}</b><span style={{ display: "block", color: "var(--gray)", marginTop: 4 }}>{supportCase.description}</span>{supportCase.resolution_note && <span style={{ display: "block", marginTop: 4 }}>ملاحظة الحل: {supportCase.resolution_note}</span>}</td>
                <td>{supportCase.category}</td>
                <td>{PRIORITY_LABELS[supportCase.priority] ?? supportCase.priority}</td>
                <td>{STATUS_LABELS[supportCase.status] ?? supportCase.status}</td>
                <td>{supportCase.admins?.full_name ?? "—"}</td>
                <td style={{ fontSize: 12 }}>{new Date(supportCase.created_at).toLocaleDateString("ar-SA")}</td>
                <td><SupportCaseActions caseId={supportCase.id} currentStatus={supportCase.status} admins={admins ?? []} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}