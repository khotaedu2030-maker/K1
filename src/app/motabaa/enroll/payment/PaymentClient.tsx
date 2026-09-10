"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatSessionCount } from "@/lib/plan-display";

type PaymentSummary = {
  program: string; grade: string | null; plan: string | null;
  days: string | null; sessionsPerMonth: number | null; cohortTitle: string | null; time: string | null;
} | null;

export default function PaymentClient({
  subscriptionId,
  amountSar,
  summary,
}: {
  subscriptionId: string;
  amountSar: number | null;
  summary: PaymentSummary;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/payment/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "تعذّر تأكيد الدفع.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="dashcard" style={{ textAlign: "center" }}>
        <span className="badge">تم الاشتراك بنجاح</span>
        <h2 style={{ color: "var(--t)", marginTop: 12 }}>تم حجز مقعد طفلك في خُطى.</h2>
        <p style={{ color: "var(--gray)" }}>جدول الحصص جاهز الآن في لوحة ولي الأمر.</p>
        <button className="btn" onClick={() => router.push("/parent/schedule")} style={{ marginTop: 10 }}>
          الانتقال إلى لوحة ولي الأمر ←
        </button>
      </div>
    );
  }

  return (
    <div className="checkout-grid">
      {summary && (
        <div className="checkout-summary">
          <div className="step-motif" style={{ marginBottom: 14 }}><span /><span /><span /><span /></div>
          <h3>ملخص الاشتراك</h3>
          <div className="checkout-row"><span>البرنامج</span><span>{summary.program}</span></div>
          {summary.grade && <div className="checkout-row"><span>الصف</span><span>{summary.grade}</span></div>}
          {summary.plan && <div className="checkout-row"><span>الخطة</span><span>{summary.plan}</span></div>}
          {summary.days && <div className="checkout-row"><span>الأيام</span><span>{summary.days}</span></div>}
          {summary.sessionsPerMonth && <div className="checkout-row"><span>عدد الجلسات</span><span>{formatSessionCount(summary.sessionsPerMonth)} شهريًا</span></div>}
          {summary.cohortTitle && <div className="checkout-row"><span>المجموعة</span><span>{summary.cohortTitle}</span></div>}
          {summary.time && <div className="checkout-row"><span>الوقت</span><span>{summary.time}</span></div>}
          {amountSar !== null && <div className="checkout-row price"><span>السعر</span><span>{amountSar} ر.س / شهريًا</span></div>}
        </div>
      )}

      <div className="dashcard">
        <span className="badge">الدفع التجريبي متاح في بيئة التطوير فقط</span>
        <p style={{ color: "var(--gray)", marginTop: 12 }}>
          هذا الزر بديل مؤقت لبوابة دفع فعلية. عند اختيار مزوّد (Moyasar/Tap/HyperPay...) يُستبدل هذا الجزء
          بإعادة توجيه فعلية للدفع، ثم Webhook موقّع يفعّل الاشتراك تلقائيًا.
        </p>
        {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
        <button className="btn" disabled={loading} onClick={confirm}>
          {loading ? "جارٍ التأكيد..." : "تأكيد الدفع (تجريبي)"}
        </button>
      </div>
    </div>
  );
}
