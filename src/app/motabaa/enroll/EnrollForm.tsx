"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isValidSaudiLocalPhone, normalizeSaudiPhone, SAUDI_PHONE_ERROR } from "@/lib/phone";
import { formatSessionCount } from "@/lib/plan-display";

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
  const [phone, setPhone] = useState("");
  const [childName, setChildName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);

    if (!isValidSaudiLocalPhone(phone)) {
      setError(SAUDI_PHONE_ERROR);
      return;
    }

    setLoading(true);

    // نفس صيغة +966 المخزَّنة عند تسجيل الدخول — يضمن مطابقة رقم الجوال بصيغة واحدة موحَّدة
    // في جدول parents بصرف النظر عن نقطة الدخول (تسجيل أو دخول لاحق)، دون أي تغيير في منطق
    // /api/enroll نفسه (لا يزال يستقبل ويخزّن قيمة phone كما هي).
    const internationalPhone = normalizeSaudiPhone(phone);

    const res = await fetch("/api/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentName, phone: internationalPhone, childName, grade, cohortId }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "تعذّر إتمام التسجيل، حاول مرة أخرى.");
      return;
    }

    router.push(`/motabaa/enroll/payment?sub=${data.subscriptionId}`);
  }

  return (
    <div className="container">
      <span className="eyebrow">إكمال الاشتراك</span>
      <h1 className="title" style={{ fontSize: 32 }}>خطوة أخيرة قبل الدفع</h1>

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
          {details.price && <div className="checkout-row price"><span>السعر</span><span>{details.price}</span></div>}
        </div>

        <div className="form" style={{ marginTop: 0 }}>
          <label>
            اسم ولي الأمر
            <input value={parentName} onChange={(e) => setParentName(e.target.value)} />
          </label>
          <label>
            رقم الجوال
            <input
              dir="ltr"
              inputMode="numeric"
              maxLength={10}
              placeholder="05XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            />
          </label>
          <label>
            اسم الطفل
            <input value={childName} onChange={(e) => setChildName(e.target.value)} />
          </label>
          {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
          <button className="btn" disabled={!parentName || !phone || !childName || loading} onClick={submit}>
            {loading ? "جارٍ الحفظ..." : "الانتقال للدفع ←"}
          </button>
          <p style={{ color: "var(--gray)", fontSize: 13 }}>
            لا يصبح الاشتراك فعّالًا إلا بعد تأكيد الدفع بنجاح.
          </p>
        </div>
      </div>
    </div>
  );
}
