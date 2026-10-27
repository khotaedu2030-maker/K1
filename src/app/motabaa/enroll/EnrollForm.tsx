"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isValidSaudiLocalPhone, normalizeSaudiPhone, SAUDI_PHONE_ERROR } from "@/lib/phone";
import { formatSessionCount } from "@/lib/plan-display";
import { supabase } from "@/lib/supabase";

type EnrollDetails = {
  grade: string;
  program: string;
  plan: string | null;
  days: string | null;
  sessionsPerMonth: number | null;
  cohortTitle: string | null;
  time: string | null;
  price: string | null;
};

export default function EnrollForm({
  grade,
  cohortId,
  details,
}: {
  grade: number;
  cohortId: string;
  details: EnrollDetails;
}) {
  const router = useRouter();
  const [parentName, setParentName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [childName, setChildName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("أدخل بريدًا إلكترونيًا صحيحًا.");
      return;
    }
    if (!isValidSaudiLocalPhone(phone)) {
      setError(SAUDI_PHONE_ERROR);
      return;
    }

    if (parentName.trim().length < 2 || childName.trim().length < 2) {
      setError("أدخل اسم ولي الأمر واسم الطفل بصورة صحيحة.");
      return;
    }
    setLoading(true);

    // Keep the form recoverable even on weak mobile connections or Supabase outages:
    // previously a rejected getSession/fetch or an invalid JSON response left it spinning forever.
    try {
      const internationalPhone = normalizeSaudiPhone(phone);
      const payload = {
        parentName: parentName.trim(), email: normalizedEmail, phone: internationalPhone,
        childName: childName.trim(), grade, cohortId,
      };
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setError("تعذّر التحقق من جلسة الدخول. تحقق من اتصال الإنترنت وأعد المحاولة.");
        return;
      }
      if (!sessionData.session) {
        sessionStorage.setItem("khota_pending_enrollment", JSON.stringify(payload));
        router.push(`/signup?next=${encodeURIComponent("/motabaa/enroll/complete")}&email=${encodeURIComponent(normalizedEmail)}`);
        return;
      }

      const sessionEmail = (sessionData.session.user.email ?? "").trim().toLowerCase();
      if (sessionEmail && sessionEmail !== normalizedEmail) {
        setError("البريد المدخل لا يطابق الحساب الذي سجلت الدخول به. استخدم بريد الحساب أو سجّل الخروج أولًا.");
        return;
      }

      const res = await fetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "تعذّر إتمام التسجيل، حاول مرة أخرى.");
        return;
      }
      if (typeof data.subscriptionId !== "string" || !data.subscriptionId) {
        setError("تعذّر تأكيد طلب التسجيل الآن. أعد المحاولة للتحقق من حالة الحجز.");
        return;
      }
      router.push(`/motabaa/enroll/payment?sub=${encodeURIComponent(data.subscriptionId)}`);
    } catch {
      setError("انقطع الاتصال أثناء التسجيل. تحقق من الشبكة ثم أعد المحاولة، ولن تُكرر إعادة المحاولة حجز المقعد.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <span className="eyebrow">باقي خطوة واحدة</span>
      <h1 className="title" style={{ fontSize: 32 }}>باقي خطوة واحدة لإكمال الاشتراك</h1>

      <div className="checkout-grid">
        <div className="checkout-summary">
          <div className="step-motif" style={{ marginBottom: 14 }}><span /><span /><span /><span /></div>
          <h3>تفاصيل الاشتراك</h3>
          <div className="checkout-row"><span>البرنامج</span><span>{details.program}</span></div>
          <div className="checkout-row"><span>الصف</span><span>{details.grade}</span></div>
          {details.plan && <div className="checkout-row"><span>الخطة</span><span>{details.plan}</span></div>}
          {details.days && <div className="checkout-row"><span>الأيام</span><span>{details.days}</span></div>}
          {details.sessionsPerMonth && <div className="checkout-row"><span>عدد الجلسات</span><span>{formatSessionCount(details.sessionsPerMonth)} شهريًا</span></div>}
          {details.cohortTitle && <div className="checkout-row"><span>المجموعة</span><span>{details.cohortTitle}</span></div>}
          {details.time && <div className="checkout-row"><span>الوقت</span><span>{details.time}</span></div>}
          {details.price && <div className="checkout-row price"><span>قيمة الاشتراك لهذه الدورة</span><span>{details.price}</span></div>}
          <Link href="/refund-policy" target="_blank" style={{ display: "block", marginTop: 14, fontSize: 12.5, color: "var(--gray)" }}>
            سياسة الاسترجاع والاسترداد ←
          </Link>
        </div>

        <div className="form" style={{ marginTop: 0 }}>
          <label>
            اسم ولي الأمر
            <input value={parentName} onChange={(e: ChangeEvent<HTMLInputElement>) => setParentName(e.target.value)} />
          </label>
          <label>
            البريد الإلكتروني
            <input dir="ltr" type="email" autoComplete="email" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
          </label>
          <label>
            رقم الجوال
            <input
              dir="ltr"
              inputMode="numeric"
              maxLength={10}
              placeholder="05XXXXXXXX"
              value={phone}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            />
          </label>
          <label>
            اسم الطفل
            <input value={childName} onChange={(e: ChangeEvent<HTMLInputElement>) => setChildName(e.target.value)} />
          </label>
          {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
          <button className="btn" disabled={!parentName || !email || !phone || !childName || loading} onClick={submit}>
            {loading ? "جارٍ الحفظ..." : "المتابعة ←"}
          </button>
          <p style={{ color: "var(--gray)", fontSize: 13 }}>
            سنطلب تأكيد بريدك الإلكتروني برمز تحقق قبل إتمام الدفع، والاشتراك لا يصبح فعّالًا إلا بعد تأكيد الدفع من الخادم.
          </p>
        </div>
      </div>
    </div>
  );
}
