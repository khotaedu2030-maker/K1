"use client";

import { useState } from "react";

type Task = { id: string; title: string; status: string };

export default function TaskList({ initialTasks, junior }: { initialTasks: Task[]; junior: boolean }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [celebrate, setCelebrate] = useState<string | null>(null);

  async function toggle(taskId: string) {
    const current = tasks.find((t) => t.id === taskId);
    if (!current) return;

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: t.status === "done" ? "pending" : "done" } : t)));
    if (current.status !== "done") {
      setCelebrate(taskId);
      setTimeout(() => setCelebrate(null), 1200);
    }

    const res = await fetch("/api/student/tasks/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    if (!res.ok) {
      // تراجع عن التغيير التفاؤلي إن رفضه الخادم
      setTasks((prev) => prev.map((t) => (t.id === taskId ? current : t)));
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="student-card student-empty">
        <span className="icon">📋</span>
        <p>لا توجد مهام مسجّلة بعد.</p>
      </div>
    );
  }

  return (
    <div className="student-card">
      {tasks.map((t) => (
        <div className="task-row" key={t.id}>
          <button
            className={`task-check${t.status === "done" ? " done" : ""}`}
            onClick={() => toggle(t.id)}
            aria-label={t.status === "done" ? "إلغاء الإنجاز" : "تم الإنجاز"}
          >
            {t.status === "done" ? "✓" : ""}
          </button>
          <span className={`task-title${t.status === "done" ? " done" : ""}`} style={{ fontSize: junior ? 18 : 15 }}>
            {t.title}
          </span>
          {celebrate === t.id && <span>🎉</span>}
        </div>
      ))}
    </div>
  );
}
