"use client";

import { useState } from "react";

export default function ReviewActivityButton() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function acknowledge() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/navigation-badges/review-messages", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("review failed");
      setNotice("تم تأكيد مراجعة نشاط المحادثات. لم تتغير حالة قراءة رسائل أولياء الأمور أو المعلمين.");
      window.dispatchEvent(new Event("khota-admin-badges-refresh"));
    } catch {
      setNotice("تعذّر تأكيد المراجعة، حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn small outline" type="button" onClick={acknowledge} disabled={busy}>
        {busy ? "جارٍ تأكيد المراجعة..." : "تأكيد مراجعة نشاط الرسائل"}
      </button>
      {notice && <p role="status" style={{ fontSize: 12, color: "var(--gray)", marginTop: 8 }}>{notice}</p>}
    </div>
  );
}
