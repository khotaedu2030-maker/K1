"use client";

import { useEffect, useRef, useState } from "react";

type Message = { id: string; senderRole: "parent" | "teacher"; body: string; createdAt: string };

export default function MessageThread({
  threadId,
  currentRole,
  otherPartyLabel,
  initialMessages,
  canWrite,
}: {
  threadId: string;
  currentRole: "parent" | "teacher";
  otherPartyLabel: string;
  initialMessages: Message[];
  canWrite: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    fetch("/api/messages/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId }),
    });
  }, [threadId]);

  async function send() {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    setNotice(null);

    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, body: text }),
    });
    const data = await res.json();
    setSending(false);

    if (!res.ok) {
      setError(data.error ?? "تعذّر إرسال الرسالة.");
      return;
    }

    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, senderRole: currentRole, body: text, createdAt: new Date().toISOString() },
    ]);
    setDraft("");
    if (data.quietHours) setNotice(data.quietHoursMessage);
  }

  return (
    <div className="thread-view">
      <div style={{ paddingBottom: 10, borderBottom: "1px solid var(--line)", marginBottom: 10 }}>
        <b>{otherPartyLabel}</b>
      </div>

      <div className="thread-messages">
        {messages.length === 0 && (
          <div className="student-empty">
            <span className="icon">💬</span>
            <p>ابدأ المحادثة برسالة أولى.</p>
          </div>
        )}
        {messages.map((m) => (
          <div className={`msg-row${m.senderRole === currentRole ? " mine" : ""}`} key={m.id}>
            <div className="msg-sender">{m.senderRole === currentRole ? "أنت" : otherPartyLabel}</div>
            <div className="msg-body">{m.body}</div>
            <div className="msg-time">
              {new Date(m.createdAt).toLocaleString("ar-SA", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {notice && <div className="quiet-hours-note">{notice}</div>}
      {error && <p style={{ color: "var(--p)" }}>{error}</p>}

      {canWrite ? (
        <div className="composer">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="اكتب رسالتك..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button className="btn" disabled={sending || !draft.trim()} onClick={send}>
            إرسال
          </button>
        </div>
      ) : (
        <div className="quiet-hours-note" style={{ background: "var(--gray-light)" }}>
          هذه المحادثة مغلقة لأن ارتباط الطالب بهذه المجموعة انتهى. يمكنك الاطلاع على السجل السابق فقط.
        </div>
      )}
    </div>
  );
}
