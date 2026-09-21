"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ActivateTeacherButton({ applicationId, alreadyActivated }: { applicationId: string; alreadyActivated: boolean }) {
  const router = useRouter();
  const [activated, setActivated] = useState(alreadyActivated);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/teachers/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; alreadyActive?: boolean; error?: string } | null;
      if (!response.ok || !result?.ok) {
        setError(result?.error ?? "تعذّر تفعيل المعلم");
        return;
      }
      setActivated(true);
      router.refresh();
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  if (activated) return <span className="badge">مفعل كمعلم</span>;

  return (
    <span>
      <button type="button" className="btn small" onClick={activate} disabled={loading}>
        {loading ? "جارٍ التفعيل..." : "تفعيل كمعلم"}
      </button>
      {error && <span role="alert" style={{ display: "block", color: "var(--p)", marginTop: 6 }}>{error}</span>}
    </span>
  );
}