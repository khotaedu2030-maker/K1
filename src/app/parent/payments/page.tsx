import Link from "next/link";
import Shell from "@/components/Shell";
import { resolveParentContext } from "@/lib/pilot-parent";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type PaymentRow = {
  id: string;
  subscription_id: string;
  amount_sar: number;
  status: string;
  provider: string | null;
  provider_ref: string | null;
  paid_at: string | null;
  created_at: string;
  subscriptions: Array<{
    child_id: string;
    plan_id: string;
    status: string;
    children: Array<{ first_name: string }>;
    plans: Array<{ name: string }>;
  }>;
};

type RefundRow = {
  id: string;
  payment_id: string;
  amount_sar: number;
  refund_type: string;
  status: string;
  requested_at: string;
  processed_at: string | null;
};

const paymentStatusLabel: Record<string, string> = {
  pending: "بانتظار الدفع",
  paid: "مدفوع",
  failed: "فشل",
  refunded: "مسترد",
};

const refundStatusLabel: Record<string, string> = {
  requested: "قيد المراجعة",
  processing: "قيد المعالجة",
  completed: "مكتمل",
  failed: "فشل",
  cancelled: "ملغى",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("ar-SA-u-nu-latn", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  }).format(new Date(value));
}

export default async function ParentPaymentsPage() {
  const context = await resolveParentContext();

  if (!context) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <span className="badge">تسجيل الدخول مطلوب</span>
            <h1 className="title" style={{ fontSize: 32, marginTop: 16 }}>المدفوعات</h1>
            <p className="lead">سجّل الدخول لعرض سجل المدفوعات المرتبط بحسابك.</p>
            <Link className="btn" href="/login?next=%2Fparent%2Fpayments">تسجيل الدخول ←</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: paymentRows, error: paymentsError } = await admin
    .from("payments")
    .select(
      "id, subscription_id, amount_sar, status, provider, provider_ref, paid_at, created_at, subscriptions(child_id, plan_id, status, children(first_name), plans(name))"
    )
    .eq("parent_id", context.parentId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (paymentsError) {
    console.error("[parent-payments] payment query failed:", paymentsError.message);
  }

  const payments = (paymentRows ?? []) as PaymentRow[];
  const paymentIds = payments.map((payment) => payment.id);

  const { data: refundRows, error: refundsError } = paymentIds.length
    ? await admin
        .from("payment_refunds")
        .select("id, payment_id, amount_sar, refund_type, status, requested_at, processed_at")
        .in("payment_id", paymentIds)
        .order("requested_at", { ascending: false })
    : { data: [] as RefundRow[], error: null };

  if (refundsError) {
    console.error("[parent-payments] refund query failed:", refundsError.message);
  }

  const refundsByPayment = new Map<string, RefundRow[]>();
  for (const refund of (refundRows ?? []) as RefundRow[]) {
    if (!refundsByPayment.has(refund.payment_id)) refundsByPayment.set(refund.payment_id, []);
    refundsByPayment.get(refund.payment_id)!.push(refund);
  }

  const paidTotal = payments
    .filter((payment) => payment.status === "paid" || payment.status === "refunded")
    .reduce((sum, payment) => sum + Number(payment.amount_sar || 0), 0);
  const pendingCount = payments.filter((payment) => payment.status === "pending").length;
  const completedRefundTotal = ((refundRows ?? []) as RefundRow[])
    .filter((refund) => refund.status === "completed")
    .reduce((sum, refund) => sum + Number(refund.amount_sar || 0), 0);

  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <div className="admin-page-head">
            <div>
              <span className="eyebrow">لوحة ولي الأمر</span>
              <h1 className="title" style={{ fontSize: 34 }}>المدفوعات</h1>
            </div>
            <Link className="btn outline small" href="/parent/subscriptions">الاشتراكات ←</Link>
          </div>

          {context.isPilot && (
            <div className="badge" style={{ marginBottom: 18 }}>
              وضع تجريبي — قد تكون البيانات المعروضة تجريبية
            </div>
          )}

          <div className="admin-kpi-grid">
            <div className="admin-kpi-card">
              <strong>{payments.length}</strong>
              <span>عملية دفع</span>
            </div>
            <div className="admin-kpi-card">
              <strong>{formatMoney(paidTotal)}</strong>
              <span>إجمالي العمليات المدفوعة</span>
            </div>
            <div className="admin-kpi-card">
              <strong>{pendingCount}</strong>
              <span>بانتظار الإكمال</span>
            </div>
            <div className="admin-kpi-card">
              <strong>{formatMoney(completedRefundTotal)}</strong>
              <span>استردادات مكتملة</span>
            </div>
          </div>

          {paymentsError ? (
            <div className="admin-unavailable">
              <span className="badge">تعذّر التحميل</span>
              <p>تعذّر جلب سجل المدفوعات الآن. حاول مرة أخرى بعد قليل.</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="admin-empty-state">
              <b>لا توجد عمليات دفع على الحساب حتى الآن.</b>
              <p style={{ marginBottom: 0 }}>عند إنشاء فاتورة أو إتمام الدفع ستظهر تفاصيلها هنا.</p>
            </div>
          ) : (
            <div className="list">
              {payments.map((payment) => {
                const refunds = refundsByPayment.get(payment.id) ?? [];
                const subscription = payment.subscriptions?.[0];
                const childName = subscription?.children?.[0]?.first_name ?? "الطالب";
                const planName = subscription?.plans?.[0]?.name ?? "الخطة";
                return (
                  <article key={payment.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div>
                        <h3 style={{ marginTop: 0 }}>{childName} — {planName}</h3>
                        <p style={{ margin: 0 }}>
                          أُنشئت: {formatDateTime(payment.created_at)}
                          {payment.paid_at ? <> · دُفعت: {formatDateTime(payment.paid_at)}</> : null}
                        </p>
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <strong style={{ display: "block", fontSize: 22 }}>{formatMoney(Number(payment.amount_sar))}</strong>
                        <span className="badge">{paymentStatusLabel[payment.status] ?? payment.status}</span>
                      </div>
                    </div>

                    <div className="taskline">
                      <span>مزود الدفع</span>
                      <span>{payment.provider === "paylink" ? "Paylink" : payment.provider ?? "—"}</span>
                    </div>
                    {payment.provider_ref && (
                      <div className="taskline">
                        <span>مرجع العملية</span>
                        <span className="en" style={{ fontSize: 13 }}>{payment.provider_ref}</span>
                      </div>
                    )}

                    {refunds.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <b>الاستردادات</b>
                        {refunds.map((refund) => (
                          <div className="taskline" key={refund.id}>
                            <span>
                              {refund.refund_type === "full" ? "استرداد كامل" : "استرداد جزئي"} — {formatMoney(Number(refund.amount_sar))}
                            </span>
                            <span className="badge">
                              {refundStatusLabel[refund.status] ?? refund.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          <div className="actions" style={{ marginTop: 24 }}>
            <Link className="btn outline" href="/parent">← لوحة ولي الأمر</Link>
            <Link className="btn" href="/motabaa/plans">استعرض الخطط</Link>
          </div>
        </div>
      </main>
    </Shell>
  );
}
