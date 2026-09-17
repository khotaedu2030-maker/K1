"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

export function GrantCreditForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [childId, setChildId] = useState("");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!childId.trim() || !reason.trim()) {
      setError("معرّف الطفل والسبب مطلوبان");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/makeup-credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "grant", childId: childId.trim(), reason: reason.trim(), expiresAt: expiresAt || null }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "تعذّر المنح");
      return;
    }
    setOpen(false);
    setChildId("");
    setReason("");
    setExpiresAt("");
    router.refresh();
  }

  if (!open) return <button className="btn small" onClick={() => setOpen(true)}>منح رصيد تعويض يدويًا</button>;

  return (
    <div className="dashcard" style={{ marginBottom: 20, maxWidth: 480 }}>
      <b>منح رصيد تعويض يدويًا</b>
      <div className="form" style={{ marginTop: 12 }}>
        <label>معرّف الطفل (UUID){" "}
          <input dir="ltr" value={childId} onChange={(e: ChangeEvent<HTMLInputElement>) => setChildId(e.target.value)} />
        </label>
        <label>السبب (مطلوب)
          <textarea rows={2} value={reason} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)} />
        </label>
        <label>تاريخ انتهاء (اختياري)
          <input dir="ltr" type="date" value={expiresAt} onChange={(e: ChangeEvent<HTMLInputElement>) => setExpiresAt(e.target.value)} />
        </label>
        {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
        <div className="actions">
          <button className="btn small" disabled={loading} onClick={submit}>{loading ? "جارٍ الحفظ..." : "تأكيد المنح"}</button>
          <button className="btn small outline" onClick={() => setOpen(false)}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}

export function CancelCreditButton({ creditId }: { creditId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason.trim()) {
      setError("السبب مطلوب");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/makeup-credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "cancel", creditId, reason: reason.trim() }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "تعذّر الإلغاء");
      return;
    }
    router.refresh();
  }

  if (!confirming) return <button className="btn small outline" onClick={() => setConfirming(true)}>إلغاء</button>;

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input dir="rtl" placeholder="سبب الإلغاء" value={reason} onChange={(e: ChangeEvent<HTMLInputElement>) => setReason(e.target.value)} style={{ width: 140 }} />
      <button className="btn small" disabled={loading} onClick={submit}>{loading ? "..." : "تأكيد"}</button>
      <button className="btn small outline" onClick={() => setConfirming(false)}>×</button>
      {error && <span style={{ color: "var(--p)", fontSize: 12 }}>{error}</span>}
    </div>
  );
}
