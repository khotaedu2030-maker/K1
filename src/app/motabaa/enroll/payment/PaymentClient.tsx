"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  // إقرارات ما قبل الدفع — غير محدَّدة افتراضيًا، يجب تفعيل الاثنتين قبل تمكين أي زر دفع.
  // ⚠️ لا تُخزَّن هذه الموافقة في قاعدة البيانات حاليًا (يتطلب تعديل schema، خارج نطاق هذه
  // الجولة). عند إضافة سجل تدقيق لاحقًا، مرّر هنا policyVersion + timestamp + subscriptionId.
  const [agreedPolicies, setAgreedPolicies] = useState(false);
  const [agreedGuardian, setAgreedGuardian] = useState(false);
  const canConfirm = agreedPolicies && agreedGuardian;

  // عودة من Paylink عبر /api/payments/paylink/callback — لا نثق بهذه الحالة كدليل دفع بحد
  // ذاتها (التحقق الفعلي تم Server-side قبل إعادة التوجيه)، نستخدمها فقط لعرض الحالة المناسبة.
  useEffect(() => {
    if (searchParams.get("paid") === "1") setDone(true);
    else if (searchParams.get("failed") === "1") setError("تعذّر تأكيد الدفع. حاول مرة أخرى، أو تواصل معنا إذا استمرت المشكلة.");
    else if (searchParams.get("cancelled") === "1") setError("تم إلغاء عملية الدفع.");
  }, [searchParams]);

  async function payWithPaylink() {
    setLoading(true);
    setError(null);
    setRedirecting(false);
    const res = await fetch("/api/payments/paylink/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? "تعذّر بدء عملية الدفع.");
      return;
    }
    if (data.alreadyPaid) {
      // اكتُشف أثناء منع تكرار الفواتير أن دفعة سابقة لهذا الاشتراك مكتملة فعليًا — التفعيل
      // تم من جهة الخادم بالفعل، لا حاجة لتحويل المستخدم إلى Paylink مرة أخرى.
      setLoading(false);
      setDone(true);
      return;
    }
    if (!data.paymentUrl) {
      setLoading(false);
      setError("تعذّر بدء عملية الدفع.");
      return;
    }
    setRedirecting(true);
    window.location.assign(data.paymentUrl);
  }

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
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16, borderBottom: "1px solid var(--line)" }}>
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

        <button className="btn" disabled={loading || redirecting || !canConfirm} onClick={payWithPaylink} style={{ marginTop: 16, width: "100%", justifyContent: "center" }}>
          {redirecting ? "جارٍ التحويل إلى صفحة الدفع..." : loading ? "جارٍ التجهيز..." : "الدفع الآن"}
        </button>

        {process.env.NODE_ENV !== "production" && (
          <details style={{ marginTop: 20, paddingTop: 16, borderTop: "1px dashed var(--line)" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13, color: "var(--gray)" }}>
              أدوات اختبار المطور
            </summary>
            <div style={{ marginTop: 12 }}>
              <span className="badge">تأكيد يدوي — بيئة التطوير فقط</span>
              <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 8 }}>
                هذا الزر بديل تطويري لتجاوز بوابة الدفع الفعلية أثناء الاختبار المحلي فقط — غير متاح في الإنتاج.
              </p>
              <button className="btn outline" disabled={loading || !canConfirm} onClick={confirm} style={{ marginTop: 10 }}>
                {loading ? "جارٍ التأكيد..." : "تأكيد الدفع (تجريبي)"}
              </button>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
