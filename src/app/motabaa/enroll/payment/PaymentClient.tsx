"use client";

import { useState, type ChangeEvent } from "react";
import Link from "next/link";
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
  // إقرارات ما قبل الدفع — غير محدَّدة افتراضيًا، يجب تفعيل الاثنتين قبل تمكين زر التأكيد.
  // ⚠️ لا تُخزَّن هذه الموافقة في قاعدة البيانات حاليًا (يتطلب تعديل schema، خارج نطاق هذه
  // الجولة). عند إضافة سجل تدقيق لاحقًا، مرّر هنا policyVersion + timestamp + subscriptionId
  // إلى نداء /api/payment/confirm ليُسجَّلها الخادم مع الاشتراك.
  const [agreedPolicies, setAgreedPolicies] = useState(false);
  const [agreedGuardian, setAgreedGuardian] = useState(false);
  const canConfirm = agreedPolicies && agreedGuardian;

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
          {amountSar !== null && <div className="checkout-row price"><span>قيمة الاشتراك لهذه الدورة</span><span>{amountSar} ر.س</span></div>}
          <Link href="/refund-policy" target="_blank" style={{ display: "block", marginTop: 14, fontSize: 12.5, color: "var(--gray)" }}>
            سياسة الاسترجاع والاسترداد ←
          </Link>
        </div>
      )}

      <div className="dashcard">
        <span className="badge">الدفع التجريبي متاح في بيئة التطوير فقط</span>
        <p style={{ color: "var(--gray)", marginTop: 12 }}>
          هذا الزر بديل مؤقت لبوابة دفع فعلية. عند اختيار مزوّد (Moyasar/Tap/HyperPay...) يُستبدل هذا الجزء
          بإعادة توجيه فعلية للدفع، ثم Webhook موقّع يفعّل الاشتراك تلقائيًا.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "var(--n)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={agreedPolicies}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAgreedPolicies(e.target.checked)}
              style={{ marginTop: 3, flexShrink: 0 }}
            />
            <span>
              أقرّ بأنني اطّلعت على{" "}
              <Link href="/terms" target="_blank" style={{ color: "var(--t)", fontWeight: 700 }}>الشروط والأحكام</Link>
              {" "}و
              <Link href="/refund-policy" target="_blank" style={{ color: "var(--t)", fontWeight: 700 }}>سياسة الاسترجاع والاسترداد</Link>
              {" "}و
              <Link href="/privacy" target="_blank" style={{ color: "var(--t)", fontWeight: 700 }}>سياسة الخصوصية</Link>.
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "var(--n)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={agreedGuardian}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAgreedGuardian(e.target.checked)}
              style={{ marginTop: 3, flexShrink: 0 }}
            />
            <span>أقرّ بأنني ولي أمر الطالب أو مخوَّل نظامًا بإدارة اشتراكه وتقديم البيانات اللازمة للخدمة.</span>
          </label>
        </div>

        {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
        <button className="btn" disabled={loading || !canConfirm} onClick={confirm} style={{ marginTop: 16 }}>
          {loading ? "جارٍ التأكيد..." : "تأكيد الدفع (تجريبي)"}
        </button>
      </div>
    </div>
  );
}
