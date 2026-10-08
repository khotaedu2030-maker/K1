"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { isValidSaudiLocalPhone, SAUDI_PHONE_ERROR } from "@/lib/phone";

export default function ProfileForm({ initialName, initialPhone, email }: { initialName: string; initialPhone: string; email: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  async function save() {
    setError(null); setSaved(false);
    if (fullName.trim().length < 2) return setError("أدخل اسمًا صحيحًا");
    if (!isValidSaudiLocalPhone(phone)) return setError(SAUDI_PHONE_ERROR);
    setLoading(true);
    const res = await fetch("/api/parent/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName, phone }) });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.error ?? "تعذّر حفظ البيانات");
    setSaved(true); router.refresh();
  }
  return <div className="form" style={{ marginTop: 20 }}>
    <label>اسم ولي الأمر<input value={fullName} maxLength={100} onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)} /></label>
    <label>البريد الإلكتروني<input dir="ltr" type="email" value={email} disabled /></label>
    <p style={{ color: "var(--gray)", fontSize: 12, marginTop: -8 }}>البريد مرتبط بحساب الدخول ولا يُعدّل من هنا.</p>
    <label>رقم الجوال<input dir="ltr" inputMode="numeric" maxLength={10} value={phone} onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} /></label>
    {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
    {saved && <p role="status" style={{ color: "var(--t)", fontWeight: 700 }}>تم حفظ بياناتك.</p>}
    <button className="btn" disabled={loading} onClick={save}>{loading ? "جارٍ الحفظ..." : "حفظ التعديلات"}</button>
  </div>;
}
