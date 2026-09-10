"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// يظهر فقط إذا أكَّد الخادم (عبر /api/pilot-auth/status) أن Pilot Auth مفعَّلة — لا يعتمد على
// أي متغير بيئة يصل للمتصفح مباشرة، حتى لا يُكشف اسم/وجود الميزة في حزمة العميل بلا داعٍ.
export default function PilotLoginSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pilot-auth/status")
      .then((res) => (res.ok ? res.json() : { enabled: false }))
      .then((data) => setEnabled(Boolean(data.enabled)))
      .catch(() => setEnabled(false));
  }, []);

  if (!enabled) return null;

  async function pilotLogin() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/pilot-auth/login", { method: "POST" });
    setLoading(false);

    if (!res.ok) {
      setError("تعذّر تفعيل الدخول التجريبي.");
      return;
    }

    // حماية من Open Redirect: نقبل فقط مسارًا داخليًا يبدأ بـ "/" وليس "//" (رابط خارجي محتمل)
    const next = searchParams.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/parent/schedule";
    router.push(safeNext);
  }

  return (
    <div className="form" style={{ marginTop: 24, borderStyle: "dashed" }}>
      <span className="badge">وضع تجريبي — بيئة تطوير فقط</span>
      <h3 style={{ margin: "12px 0 4px", fontSize: 17 }}>الدخول التجريبي</h3>
      <p style={{ color: "var(--gray)", fontSize: 13, marginBottom: 14 }}>
        لاختبار رحلة العميل كاملة بدون SMS — غير متاح إطلاقًا في الإنتاج.
      </p>
      {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
      <button className="btn outline" disabled={loading} onClick={pilotLogin}>
        {loading ? "جارٍ الدخول..." : "دخول ولي أمر تجريبي"}
      </button>
    </div>
  );
}
