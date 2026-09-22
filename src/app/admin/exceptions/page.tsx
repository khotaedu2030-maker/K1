import AdminShell from "@/components/AdminShell";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import ExceptionActions from "./ExceptionActions";
import SyncButton from "./SyncButton";

const TYPE_LABELS: Record<string, string> = {
  paid_not_active: "دفعة مدفوعة، اشتراك غير نشط",
  stale_pending_payment: "محاولة تسجيل منتهية بلا دفع",
  active_subscription_no_cohort: "اشتراك نشط بلا مجموعة",
  open_cohort_no_teacher: "مجموعة مفتوحة بلا معلم",
  upcoming_session_no_meeting_url: "جلسة قريبة بلا رابط",
  completed_session_missing_attendance: "جلسة مكتملة بلا حضور",
  refund_requires_entitlement_review: "استرداد يحتاج مراجعة استحقاق",
  late_paid_capacity_conflict: "دفعة متأخرة ومجموعة ممتلئة",
  critical_customer_data_missing: "بيانات عميل حرجة ناقصة",
  pause_crosses_cycle_boundary: "تجميد يتجاوز نهاية الدورة",
};
const STATUS_LABELS: Record<string, string> = { open: "مفتوح", in_review: "قيد المراجعة", resolved: "مُغلَق" };
const SEVERITY_LABELS: Record<string, string> = { warning: "تنبيه", critical: "حرج" };
const VALID_STATUSES = ["open", "in_review", "resolved"];
const VALID_SEVERITIES = ["warning", "critical"];
const VALID_TYPES = Object.keys(TYPE_LABELS);

export default async function AdminExceptionsPage({ searchParams }: { searchParams: Promise<{ status?: string; severity?: string; type?: string }> }) {
  const admin = await getAdminIdentity();
  if (!admin) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;
  const params = await searchParams;
  const status = VALID_STATUSES.includes(params.status ?? "") ? params.status! : "";
  const severity = VALID_SEVERITIES.includes(params.severity ?? "") ? params.severity! : "";
  const type = VALID_TYPES.includes(params.type ?? "") ? params.type! : "";
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("operational_exceptions").select("id, exception_type, severity, status, title, description, parent_id, child_id, subscription_id, payment_id, refund_id, cohort_id, session_id, assigned_to, detected_at, last_detected_at, resolution_note, parents(full_name), children(first_name), cohorts(title), sessions(session_date), admins:assigned_to(full_name)").order("last_detected_at", { ascending: false }).limit(100);
  if (status) query = query.eq("status", status); else query = query.in("status", ["open", "in_review"]);
  if (severity) query = query.eq("severity", severity);
  if (type) query = query.eq("exception_type", type);
  const [{ data: exceptionsRaw }, { data: admins }] = await Promise.all([query, supabase.from("admins").select("id, full_name").eq("active", true)]);
  const exceptions = (exceptionsRaw ?? []) as any[];

  return <AdminShell adminName={admin.full_name}>
    <div className="admin-page-head"><h1>الاستثناءات التشغيلية</h1><SyncButton /></div>
    <p style={{ color: "var(--gray)", fontSize: 13, marginBottom: 16 }}>هذه الشاشة للتتبع والتصعيد فقط؛ الانتقال هنا لا يغير دفعة أو اشتراكًا أو مجموعة أو جلسة تلقائيًا.</p>
    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      {["", ...VALID_STATUSES].map((value) => <a key={value || "default"} href={`/admin/exceptions${value ? `?status=${value}` : ""}`} className={`btn small${status === value ? "" : " outline"}`}>{value ? STATUS_LABELS[value] : "مفتوح + قيد المراجعة"}</a>)}
    </div>
    {exceptions.length === 0 ? <p className="admin-empty-state">لا توجد استثناءات مطابقة.</p> : <div style={{ overflowX: "auto" }}>
      <table className="admin-table"><thead><tr><th>النوع</th><th>الشدة</th><th>السياق</th><th>التفاصيل</th><th>الحالة</th><th>آخر رصد</th><th>إجراء</th></tr></thead>
        <tbody>{exceptions.map((item) => <tr key={item.id} style={item.severity === "critical" && item.status !== "resolved" ? { background: "rgba(255,177,153,0.12)" } : undefined}>
          <td>{TYPE_LABELS[item.exception_type] ?? item.exception_type}</td>
          <td>{SEVERITY_LABELS[item.severity] ?? item.severity}</td>
          <td>{item.parents?.full_name ?? "—"}{item.children?.first_name ? ` / ${item.children.first_name}` : ""}{item.cohorts?.title ? ` — ${item.cohorts.title}` : ""}{item.sessions?.session_date ? ` — ${item.sessions.session_date}` : ""}</td>
          <td style={{ maxWidth: 300, fontSize: 12 }}><b>{item.title}</b><span style={{ display: "block", color: "var(--gray)", marginTop: 4 }}>{item.description}</span>{item.resolution_note && <span style={{ display: "block", marginTop: 4 }}>ملاحظة الحل: {item.resolution_note}</span>}</td>
          <td>{STATUS_LABELS[item.status] ?? item.status}</td><td style={{ fontSize: 12 }}>{new Date(item.last_detected_at).toLocaleString("ar-SA")}</td>
          <td><ExceptionActions exceptionId={item.id} currentStatus={item.status} admins={admins ?? []} /></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </AdminShell>;
}