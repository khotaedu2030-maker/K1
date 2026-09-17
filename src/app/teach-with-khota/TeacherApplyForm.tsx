"use client";

import { useState, type ChangeEvent } from "react";

export default function TeacherApplyForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [cvUrl, setCvUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (loading || done) return; // منع الإرسال المزدوج

    setError(null);
    if (!fullName.trim() || !email.trim() || !phone.trim() || !specialization.trim()) {
      setError("الاسم والبريد والجوال والمرحلة/التخصص مطلوبة.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/teacher-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email: email.trim().toLowerCase(),
        phone,
        specialization,
        yearsExperience: yearsExperience || null,
        cvUrl,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "تعذّر إرسال طلبك، حاول مرة أخرى.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="dashcard">
        <b>وصل طلبك، شكرًا لاهتمامك بالانضمام إلى خُطى.</b>
        <p style={{ color: "var(--gray)", marginTop: 8 }}>سيراجع فريقنا طلبك ويتواصل معك إذا كان هناك تطابق مناسب.</p>
      </div>
    );
  }

  return (
    <div className="form">
      <label>الاسم<input value={fullName} onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)} /></label>
      <label>البريد الإلكتروني<input dir="ltr" type="email" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} /></label>
      <label>الجوال<input dir="ltr" value={phone} onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)} /></label>
      <label>المرحلة / التخصص<input value={specialization} onChange={(e: ChangeEvent<HTMLInputElement>) => setSpecialization(e.target.value)} /></label>
      <label>سنوات الخبرة<input dir="ltr" inputMode="numeric" value={yearsExperience} onChange={(e: ChangeEvent<HTMLInputElement>) => setYearsExperience(e.target.value.replace(/\D/g, ""))} /></label>
      <label>رابط السيرة الذاتية<input dir="ltr" value={cvUrl} onChange={(e: ChangeEvent<HTMLInputElement>) => setCvUrl(e.target.value)} /></label>
      {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
      <button className="btn" disabled={loading} onClick={submit}>
        {loading ? "جارٍ الإرسال..." : "إرسال الطلب"}
      </button>
    </div>
  );
}
