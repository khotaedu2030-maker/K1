"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

export default function SupportCaseActions({ caseId, currentStatus, admins }: { caseId: string; currentStatus: string; admins: { id: string; full_name: string }[] }) {
  const router = useRouter();
  const [showResolve, setShowResolve] = useState(false);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: string, extra: Record<string, unknown> = {}) {
    setError(null);
    setLoading(action);
    const response = await fetch("/api/admin/support-cases/transition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId, action, ...extra }) });
    const data = await response.json().catch(() => ({}));
    setLoading(null);
    if (!response.ok) return setError(data.error ?? "تعذّر تنفيذ الإجراء");
    setShowResolve(false);
    setNote("");
    router.refresh();
  }

  if (currentStatus === "resolved") return <span style={{ fontSize: 12, color: "var(--gray)" }}>مُغلَقة</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 160 }}>
      <select onChange={(event: ChangeEvent<HTMLSelectElement>) => { if (event.target.value) run("assign", { assignedTo: event.target.value }); }} disabled={loading === "assign"}>
        <option value="">تعيين مسؤول...</option>
        {admins.map((item) => <option value={item.id} key={item.id}>{item.full_name}</option>)}
      </select>
      <div style={{ display: "flex", gap: 4 }}>
        {currentStatus !== "in_progress" && <button className="btn small outline" disabled={loading === "status"} onClick={() => run("status", { newStatus: "in_progress" })}>بدء العمل</button>}
        {!showResolve && <button className="btn small" onClick={() => setShowResolve(true)}>حل</button>}
      </div>
      {showResolve && <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <input placeholder="ملاحظة الحل (إلزامي)" value={note} onChange={(event) => setNote(event.target.value)} />
        <div style={{ display: "flex", gap: 4 }}><button className="btn small" disabled={loading === "resolve"} onClick={() => run("resolve", { resolutionNote: note })}>تأكيد الحل</button><button className="btn small outline" onClick={() => setShowResolve(false)}>إلغاء</button></div>
      </div>}
      {error && <span style={{ color: "var(--p)", fontSize: 11 }}>{error}</span>}
    </div>
  );
}