"use client";

import { useState, type ChangeEvent } from "react";

export default function ContactForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    // منع الإرسال المزدوج بضغط متكرر — العلم loading نفسه كافٍ (الزر مُعطَّل أثناءه)، هذا
    // فحص إضافي صريح لتفادي أي سباق نادر بين نقرتين سريعتين جدًا.
    if (loading || done) return;

    setError(null);
    if (!fullName.trim() || !email.trim() || !message.trim()) {
      setError("الاسم والبريد الإلكتروني والرسالة مطلوبة.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email: email.trim().toLowerCase(), phone, message }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "تعذّر إرسال الرسالة، حاول مرة أخرى.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="dashcard" style={{ marginTop: 30 }}>
        <b>وصلتنا رسالتك.</b>
        <p style={{ color: "var(--gray)", marginTop: 8 }}>شكرًا لتواصلك، سنعود إليك قريبًا.</p>
      </div>
    );
  }

  return (
    <div className="form" style={{ marginTop: 30 }}>
      <label>
        الاسم
        <input value={fullName} onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)} />
      </label>
      <label>
        البريد الإلكتروني
        <input dir="ltr" type="email" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
      </label>
      <label>
        الجوال (اختياري)
        <input dir="ltr" value={phone} onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)} />
      </label>
      <label>
        موضوع الرسالة
        <textarea rows={4} value={message} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)} />
      </label>
      <p style={{ color: "var(--gray)", fontSize: 13, margin: 0 }}>
        لا ترسل بيانات البطاقة أو كلمات المرور أو رموز التحقق عبر هذا النموذج أو أي قناة تواصل أخرى.
      </p>
      {error && <p role="alert" style={{ color: "var(--p)", fontSize: 13, margin: 0 }}>{error}</p>}
      <button className="btn" disabled={loading} onClick={submit}>
        {loading ? "جارٍ الإرسال..." : "إرسال"}
      </button>
    </div>
  );
}
