"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EnterStudentModeButton({ childId }: { childId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enter() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/student-mode/enter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "تعذّر الدخول.");
      setLoading(false);
      return;
    }
    router.push("/student/today");
  }

  return (
    <div>
      <button className="btn small" disabled={loading} onClick={enter}>
        {loading ? "جارٍ الدخول..." : "دخول مساحة الطالب ←"}
      </button>
      {error && <p style={{ color: "var(--p)", fontSize: 13, marginTop: 6 }}>{error}</p>}
    </div>
  );
}
