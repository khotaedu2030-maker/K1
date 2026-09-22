"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConvertButton({ contactRequestId }: { contactRequestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function convert() {
    if (!window.confirm("سيتم إنشاء حالة دعم مرتبطة برسالة التواصل. هل تريد المتابعة؟")) return;
    setLoading(true);
    setError(null);
    const response = await fetch("/api/admin/support-cases/convert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactRequestId, category: "تواصل عام", priority: "normal" }) });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) return setError(data.error ?? "تعذّر التحويل");
    router.refresh();
  }

  return <div><button className="btn small" disabled={loading} onClick={convert}>{loading ? "..." : "تحويل لحالة دعم"}</button>{error && <div style={{ color: "var(--p)", fontSize: 11 }}>{error}</div>}</div>;
}