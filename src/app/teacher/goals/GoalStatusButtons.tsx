"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const GOAL_STATUS_LABEL_AR: Record<string, string> = {
  active: "قيد التنفيذ",
  achieved: "تحقق ✓",
  partially_achieved: "تحقق جزئيًا",
  carried_forward: "يُرحَّل للأسبوع القادم",
};

export default function GoalStatusButtons({ goalId, status }: { goalId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function setStatus(newStatus: string) {
    setLoading(true);
    await fetch("/api/goals/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalId, status: newStatus }),
    });
    setLoading(false);
    router.refresh();
  }

  if (status !== "active") {
    return <span className="badge">{GOAL_STATUS_LABEL_AR[status] ?? status}</span>;
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button className="btn small" disabled={loading} onClick={() => setStatus("achieved")}>تحقق ✓</button>
      <button className="btn small outline" disabled={loading} onClick={() => setStatus("partially_achieved")}>جزئيًا</button>
      <button className="btn small outline" disabled={loading} onClick={() => setStatus("carried_forward")}>يُرحَّل</button>
    </div>
  );
}
