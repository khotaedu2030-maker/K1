"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/Shell";

const STORAGE_KEY = "khota_pending_enrollment";

// يُستدعى بعد نجاح Email OTP مباشرة (عبر /login?next=/motabaa/enroll/complete). يقرأ بيانات
// التسجيل المؤقتة من sessionStorage (خُزِّنت في EnrollForm قبل الانتقال لتسجيل الدخول، بلا أي
// بيانات مالية أو حساسة) ويستدعي /api/enroll الآن فقط — بعد التحقق الفعلي من البريد، لا قبله.
export default function CompleteEnrollmentPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error" | "missing">("loading");
  const [error, setError] = useState<string | null>(null);
  // حارس صريح ضد استدعاء POST /api/enroll مرتين — React Strict Mode (تطوير) أو إعادة تشغيل
  // الـeffect لأي سبب قد يُشغِّل هذا الكود أكثر من مرة على نفس الجلسة. ref (لا state) لأنه لا
  // يحتاج إعادة render، ويبقى صحيحًا فوريًا عبر استدعاءات متزامنة للـeffect نفسه.
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setStatus("missing");
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw);
    } catch {
      setStatus("missing");
      return;
    }

    (async () => {
      const res = await fetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus("error");
        setError(data.error ?? "تعذّر إتمام التسجيل، حاول مرة أخرى.");
        return;
      }

      sessionStorage.removeItem(STORAGE_KEY);
      router.push(`/motabaa/enroll/payment?sub=${data.subscriptionId}`);
    })();
  }, [router]);

  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          {status === "loading" && (
            <>
              <span className="eyebrow">جارٍ الإكمال</span>
              <h1 className="title" style={{ fontSize: 30 }}>نُكمل تسجيلك الآن...</h1>
            </>
          )}
          {status === "missing" && (
            <>
              <span className="badge">لم نجد بيانات التسجيل</span>
              <h1 className="title" style={{ fontSize: 30, marginTop: 16 }}>ابدأ التسجيل من جديد</h1>
              <p className="lead">يبدو أن بيانات تسجيلك لم تعد متاحة في هذا المتصفح.</p>
              <Link className="btn" href="/motabaa/plans" style={{ marginTop: 20, display: "inline-flex" }}>
                استعرض الخطط ←
              </Link>
            </>
          )}
          {status === "error" && (
            <>
              <span className="badge">تعذّر إكمال التسجيل</span>
              <h1 className="title" style={{ fontSize: 30, marginTop: 16 }}>حدث خطأ</h1>
              <p className="lead" style={{ color: "var(--p)" }}>{error}</p>
              <Link className="btn outline" href="/motabaa/plans" style={{ marginTop: 20, display: "inline-flex" }}>
                العودة للخطط ←
              </Link>
            </>
          )}
        </div>
      </main>
    </Shell>
  );
}
