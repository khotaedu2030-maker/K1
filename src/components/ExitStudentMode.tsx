"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// العودة لحساب ولي الأمر ليست ضغطة واحدة — نطلب رمز تحقق يُرسل لجوال ولي الأمر المسجَّل قبل
// إنهاء جلسة مساحة الطالب فعليًا.
export default function ExitStudentMode() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"confirm" | "otp">("confirm");
  const [masked, setMasked] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestOtp() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/student-mode/exit/request-otp", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "تعذّر إرسال الرمز.");
      return;
    }
    setMasked(data.maskedPhone);
    setStep("otp");
  }

  async function verify() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/student-mode/exit/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "رمز غير صحيح.");
      return;
    }
    router.push("/parent");
    router.refresh();
  }

  if (!open) {
    return (
      <button className="student-exit-btn" onClick={() => setOpen(true)}>
        عودة لولي الأمر
      </button>
    );
  }

  return (
    <div className="student-exit-modal-backdrop" onClick={() => !loading && setOpen(false)}>
      <div className="student-exit-modal" onClick={(e) => e.stopPropagation()}>
        {step === "confirm" ? (
          <>
            <h3>عودة لحساب ولي الأمر</h3>
            <p>سنرسل رمز تحقق لجوال ولي الأمر للتأكد أنه هو من يعود للحساب.</p>
            {error && <p style={{ color: "var(--p)" }}>{error}</p>}
            <div className="actions">
              <button className="btn" disabled={loading} onClick={requestOtp}>
                {loading ? "جارٍ الإرسال..." : "إرسال الرمز"}
              </button>
              <button className="btn outline" onClick={() => setOpen(false)}>إلغاء</button>
            </div>
          </>
        ) : (
          <>
            <h3>أدخل الرمز</h3>
            <p>أرسلنا رمزًا إلى {masked}</p>
            <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} />
            {error && <p style={{ color: "var(--p)" }}>{error}</p>}
            <div className="actions">
              <button className="btn" disabled={loading || !code} onClick={verify}>
                {loading ? "جارٍ التحقق..." : "تأكيد والعودة"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
