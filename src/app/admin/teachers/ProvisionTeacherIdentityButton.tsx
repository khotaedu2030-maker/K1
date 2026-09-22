"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProvisionTeacherIdentityButton({ teacherId }: { teacherId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function provision() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/teachers/provision-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !result?.ok) {
        setError(result?.error ?? "تعذّر تجهيز حساب الدخول");
        return;
      }
      router.refresh();
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span>
      <button type="button" className="btn small" onClick={provision} disabled={loading}>
        {loading ? "جارٍ التجهيز..." : "تجهيز حساب الدخول"}
      </button>
      {error && <span role="alert" style={{ display: "block", color: "var(--p)", marginTop: 6 }}>{error}</span>}
    </span>
  );
}