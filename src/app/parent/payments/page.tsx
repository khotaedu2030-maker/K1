import Link from "next/link";
import Shell from "@/components/Shell";
import { resolveParentContext } from "@/lib/pilot-parent";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { areOnlinePaymentsEnabled } from "@/lib/payment-settings";

const STATUS: Record<string, string> = { pending: "قيد المعالجة", paid: "مدفوع", failed: "غير مكتمل", refunded: "مسترد" };

export default async function ParentPaymentsPage() {
  const context = await resolveParentContext();
  if (!context) {
    return <Shell><main className="placeholder-page"><div className="narrow"><h1 className="title" style={{ fontSize: 32 }}>المدفوعات</h1><Link className="btn" href="/login?next=%2Fparent%2Fpayments">تسجيل الدخول ←</Link></div></main></Shell>;
  }
  const admin = createSupabaseAdminClient();
  const { data: payments } = await admin.from("payments").select("id, amount_sar, status, provider_ref, paid_at, created_at").eq("parent_id", context.parentId).order("created_at", { ascending: false });
  const enabled = areOnlinePaymentsEnabled();
  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">لوحة ولي الأمر</span>
          <h1 className="title" style={{ fontSize: 34 }}>المدفوعات</h1>
          {!enabled && <div className="dashcard" style={{ marginTop: 20, borderColor: "var(--g)" }}><span className="badge">الدفع الإلكتروني متوقف مؤقتًا</span><p style={{ color: "var(--gray)", marginBottom: 0 }}>طلبات التسجيل محفوظة، وسيتواصل معك فريق خُطى لإكمال الاشتراك.</p></div>}
          {(payments ?? []).length === 0 ? (
            <div className="dashcard" style={{ marginTop: 20 }}><p style={{ margin: 0, color: "var(--gray)" }}>لا توجد عمليات دفع على حسابك.</p></div>
          ) : (
            <div style={{ marginTop: 20 }}>{(payments ?? []).map((payment) => <div className="dashcard" key={payment.id} style={{ marginBottom: 12 }}>
              <div className="taskline"><b>{Number(payment.amount_sar).toLocaleString("ar-SA")} ر.س</b><span className="badge">{STATUS[payment.status] ?? payment.status}</span></div>
              <div className="taskline"><span>التاريخ</span><span>{new Date(payment.paid_at ?? payment.created_at).toLocaleDateString("ar-SA")}</span></div>
              {payment.provider_ref && <div className="taskline"><span>المرجع</span><span dir="ltr">{payment.provider_ref}</span></div>}
            </div>)}</div>
          )}
        </div>
      </main>
    </Shell>
  );
}
