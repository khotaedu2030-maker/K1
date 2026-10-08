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
  initialParent,
  existingChildren,
}: {
  grade: number;
  cohortId: string;
  details: EnrollDetails;
  initialParent: { name: string; email: string; phone: string; hasProfile: boolean };
  existingChildren: { id: string; firstName: string }[];
}) {
  const router = useRouter();
  const [parentName, setParentName] = useState(initialParent.name);
  const [email, setEmail] = useState(initialParent.email);
  const [phone, setPhone] = useState(initialParent.phone);
  const [childName, setChildName] = useState("");
  const [selectedChildId, setSelectedChildId] = useState(existingChildren[0]?.id ?? "");
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

    setLoading(true);

    // نفس صيغة +966 المخزَّنة — يضمن مطابقة رقم الجوال بصيغة واحدة موحَّدة في جدول parents.
    const internationalPhone = normalizeSaudiPhone(phone);
    const payload = { parentName, email: normalizedEmail, phone: internationalPhone, grade, cohortId, ...(selectedChildId ? { childId: selectedChildId } : { childName }) };

    // /api/enroll يتطلب الآن جلسة Supabase Auth حقيقية — لا يُستدعى مباشرة بلا جلسة إطلاقًا،
    // منعًا لحجز مقعد قبل أي تحقق OTP فعلي. إن لم تكن هناك جلسة، نُخزِّن بيانات النموذج مؤقتًا
    // (لا شيء حسّاس ماليًا هنا) ونمرّ عبر تسجيل الدخول أولًا، ثم /motabaa/enroll/complete
    // يستكمل الاستدعاء الفعلي بعد التحقق الناجح.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      sessionStorage.setItem("khota_pending_enrollment", JSON.stringify(payload));
      setLoading(false);
      router.push(`/login?next=${encodeURIComponent("/motabaa/enroll/complete")}&email=${encodeURIComponent(normalizedEmail)}`);
      return;
    }

    // جلسة موجودة فعليًا — إن كان بريد الحساب المسجَّل دخوله مختلفًا عن البريد المكتوب بالنموذج،
    // لا نستدعي /api/enroll إطلاقًا (سيرفضه server-side بـ409 على أي حال، لكن نمنع المحاولة
    // ونوضّح السبب للمستخدم مباشرة بدل رسالة خطأ عامة).
    const sessionEmail = (sessionData.session.user.email ?? "").trim().toLowerCase();
    if (sessionEmail && sessionEmail !== normalizedEmail) {
      setLoading(false);
      setError(`أنت مسجَّل دخولك ببريد مختلف (${sessionEmail}). استخدم هذا البريد نفسه أعلاه، أو سجّل الخروج أولًا.`);
      return;
    }

    const res = await fetch("/api/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
          {initialParent.hasProfile ? (
            <div className="dashcard" style={{ padding: 16 }}>
              <b>بيانات ولي الأمر محفوظة</b>
              <p style={{ color: "var(--gray)", margin: "6px 0 0" }}>
                {parentName} • <span dir="ltr">{phone}</span> • <span dir="ltr">{email}</span>
              </p>
              <Link href="/parent/profile" style={{ display: "inline-block", marginTop: 8, color: "var(--t)", fontWeight: 700 }}>
                تعديل البيانات
              </Link>
            </div>
          ) : (
            <>
              <label>
                اسم ولي الأمر
                <input value={parentName} onChange={(e: ChangeEvent<HTMLInputElement>) => setParentName(e.target.value)} />
              </label>
              {initialParent.email ? (
                <p style={{ color: "var(--gray)", fontSize: 13 }}>البريد المسجّل: <span dir="ltr">{initialParent.email}</span></p>
              ) : (
                <label>
                  البريد الإلكتروني
                  <input dir="ltr" type="email" autoComplete="email" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
                </label>
              )}
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
            </>
          )}
          {existingChildren.length > 0 && (
            <label>
              الطفل
              <select value={selectedChildId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedChildId(e.target.value)}>
                {existingChildren.map((c) => <option key={c.id} value={c.id}>{c.firstName}</option>)}
                <option value="">إضافة طفل جديد</option>
              </select>
            </label>
          )}
          {!selectedChildId && (
            <label>
              اسم الطفل
              <input value={childName} onChange={(e: ChangeEvent<HTMLInputElement>) => setChildName(e.target.value)} />
            </label>
          )}
          {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
          <button className="btn" disabled={!parentName || !email || !phone || (!selectedChildId && !childName) || loading} onClick={submit}>
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
