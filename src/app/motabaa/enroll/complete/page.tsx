"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/Shell";

const STORAGE_KEY = "khota_pending_enrollment";

// يُستدعى بعد نجاح Email OTP مباشرة (عبر /login?next=/motabaa/enroll/complete). يقرأ بيانات
// التسجيل المؤقتة من sessionStorage (خُزِّنت في EnrollForm قبل الانتقال لتسجيل الدخول، بلا أي
// بيانات مالية أو حساسة) ويستدعي /api/enroll الآن فقط — بعد التحقق الفعلي من البريد، لا قبله.
export default function CompleteEnrollmentPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error" | "missing" | "auth">("loading");
  const [error, setError] = useState<string | null>(null);
  // حارس صريح ضد استدعاء POST /api/enroll مرتين — React Strict Mode (تطوير) أو إعادة تشغيل
  // الـeffect لأي سبب قد يُشغِّل هذا الكود أكثر من مرة على نفس الجلسة. ref (لا state) لأنه لا
  // يحتاج إعادة render، ويبقى صحيحًا فوريًا عبر استدعاءات متزامنة للـeffect نفسه.
  const submittedRef = useRef(false);

  const finishEnrollment = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setStatus("loading");
    setError(null);
    try {
      // Keep the pending request on failure. The API is idempotent for the same
      // child/cohort, so retry must not create a second seat reservation.
      let raw: string | null;
      try {
        raw = sessionStorage.getItem(STORAGE_KEY);
      } catch {
        raw = null;
      }
      if (!raw) {
        setStatus("missing");
        return;
      }
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(raw);
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          setStatus("missing");
          return;
        }
      } catch {
        setStatus("missing");
        return;
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 25_000);
      try {
        const res = await fetch("/api/enroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setStatus("auth");
          setError("انتهت جلسة الدخول. سجّل الدخول مجددًا لإكمال نفس طلب التسجيل.");
          return;
        }
        if (!res.ok) {
          setStatus("error");
          setError(data.error ?? "تعذّر إتمام التسجيل، أعد المحاولة.");
          return;
        }
        if (typeof data.subscriptionId !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(data.subscriptionId)) {
          setStatus("error");
          setError("تعذّر تأكيد رقم الاشتراك. أعد المحاولة للتحقق من الحجز.");
          return;
        }
        sessionStorage.removeItem(STORAGE_KEY);
        router.replace(`/motabaa/enroll/payment?sub=${encodeURIComponent(data.subscriptionId)}`);
      } finally {
        window.clearTimeout(timeout);
      }
    } catch {
      setStatus("error");
      setError("تعذّر الاتصال بالخادم. تحقق من الإنترنت وأعد المحاولة، ولن يُحجز المقعد مرتين.");
    } finally {
      submittedRef.current = false;
    }
  }, [router]);

  useEffect(() => {
    // A single initial attempt; the retry button calls finishEnrollment explicitly.
    // ref prevents duplicate POSTs during React development Strict Mode.
    void finishEnrollment();
  }, [finishEnrollment]);

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
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
                <button className="btn" type="button" onClick={() => { void finishEnrollment(); }}>
                  إعادة المحاولة
                </button>
                <Link className="btn outline" href="/motabaa/plans">
                  العودة للخطط
                </Link>
              </div>
            </>
          )}
          {status === "auth" && (
            <>
              <span className="badge">يلزم تسجيل الدخول</span>
              <h1 className="title" style={{ fontSize: 30, marginTop: 16 }}>أكمل التحقق من حسابك</h1>
              <p className="lead">{error}</p>
              <Link className="btn" href="/login?next=%2Fmotabaa%2Fenroll%2Fcomplete"
                style={{ marginTop: 20, display: "inline-flex" }}>
                تسجيل الدخول وإكمال التسجيل
              </Link>
            </>
          )}
        </div>
      </main>
    </Shell>
  );
}
