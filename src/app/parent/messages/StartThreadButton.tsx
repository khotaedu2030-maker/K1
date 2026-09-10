"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartThreadButton({ childId, cohortId, label }: { childId: string; cohortId: string; label: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/messages/thread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId, cohortId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "تعذّر بدء المحادثة.");
      return;
    }
    router.push(`/parent/messages/${data.threadId}`);
  }

  return (
    <div>
      <button className="btn small outline" disabled={loading} onClick={start}>
        {loading ? "..." : `راسل معلم ${label}`}
      </button>
      {error && <p style={{ color: "var(--p)", fontSize: 12 }}>{error}</p>}
    </div>
  );
}
