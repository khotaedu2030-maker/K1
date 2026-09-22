"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function sync() {
    setLoading(true); setError(null);
    const response = await fetch("/api/admin/exceptions/sync", { method: "POST" });
    const data = await response.json().catch(() => ({})); setLoading(false);
    if (!response.ok) return setError(data.error ?? "تعذّر تحديث الفحص");
    router.refresh();
  }
  return <div><button className="btn small outline" disabled={loading} onClick={sync}>{loading ? "..." : "تحديث الفحص"}</button>{error && <span style={{ display: "block", color: "var(--p)", fontSize: 11 }}>{error}</span>}</div>;
}