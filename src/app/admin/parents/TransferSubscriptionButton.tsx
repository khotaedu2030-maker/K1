"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TransferSubscriptionButton({ parentId, subscriptionId, targets }: { parentId: string; subscriptionId: string; targets: { id: string; title: string }[] }) {
  const router = useRouter();
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!targetId || !reason.trim()) {
      setError("اختر المجموعة واكتب سبب النقل");
      return;
    }
    setSaving(true);
    setError(null);
    const response = await fetch(`/api/admin/parents/${parentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId, newCohortId: targetId, reason: reason.trim() }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(data.error ?? "تعذّر نقل الاشتراك");
      return;
    }
    setOpen(false);
    setTargetId("");
    setReason("");
    router.refresh();
  }

  if (targets.length === 0) return <span style={{ color: "var(--gray)", fontSize: 12 }}>لا توجد مجموعة متوافقة متاحة</span>;
  if (!open) return <button type="button" className="btn small outline" onClick={() => setOpen(true)}>نقل المجموعة</button>;

  return (
    <div className="form" style={{ marginTop: 10 }}>
      <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
        <option value="">— اختر المجموعة الجديدة —</option>
        {targets.map((target) => <option key={target.id} value={target.id}>{target.title}</option>)}
      </select>
      <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="سبب النقل" />
      {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
      <div className="actions">
        <button type="button" className="btn small" disabled={saving} onClick={submit}>{saving ? "جارٍ النقل..." : "تأكيد النقل"}</button>
        <button type="button" className="btn small outline" onClick={() => setOpen(false)}>إلغاء</button>
      </div>
    </div>
  );
}
