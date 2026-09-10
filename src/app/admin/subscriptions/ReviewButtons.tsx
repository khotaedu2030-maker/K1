"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewButtons({ pauseId }: { pauseId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function decide(decision: "approved" | "rejected") {
    setLoading(decision);
    await fetch("/api/subscription-pause/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pauseId, decision }),
    });
    setLoading(null);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button className="btn small" disabled={!!loading} onClick={() => decide("approved")}>
        {loading === "approved" ? "..." : "اعتماد"}
      </button>
      <button className="btn small outline" disabled={!!loading} onClick={() => decide("rejected")}>
        {loading === "rejected" ? "..." : "رفض"}
      </button>
    </div>
  );
}
