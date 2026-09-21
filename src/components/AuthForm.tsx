"use client";

import { Suspense, useEffect, useState, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

// لا نعرض رسائل Supabase/الخادم الخام للمستخدم أبدًا — نُترجم المعروف منها لعربية واضحة،
// ونستخدم رسالة عامة مطمئنة لأي شيء آخر.
function friendlyAuthError(raw: string | undefined | null): string {
  if (!raw) return "تعذّر إكمال العملية الآن. حاول مرة أخرى.";
  const lower = raw.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "محاولات كثيرة متتالية — انتظر قليلًا ثم أعد المحاولة.";
  }
  if (lower.includes("invalid") && (lower.includes("otp") || lower.includes("token") || lower.includes("code"))) {
    return "رمز التحقق غير صحيح.";
  }
  if (lower.includes("expired")) {
    return "انتهت صلاحية الرمز، اطلب رمزًا جديدًا.";
  }
  return "تعذّر إكمال العملية الآن. حاول مرة أخرى.";
}

// لا نسمح بإعادة توجيه إلا لمسار داخلي فعلي يبدأ بـ / — يمنع Open Redirect عبر next مُعدَّل
// (// أو http:// أو https:// أو أي رابط خارجي).
function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.toLowerCase().includes("http://") || raw.toLowerCase().includes("https://")) return null;
  return raw;
}

function isAllowedNextForRole(role: "admin" | "teacher" | "parent", path: string | null): path is string {
  if (!path) return false;
  if (role === "admin") return path.startsWith("/admin");
  if (role === "teacher") return path.startsWith("/teacher");
  return path.startsWith("/parent") || path.startsWith("/motabaa/enroll/payment") || path.startsWith("/motabaa/enroll/complete");
}

// نفس Email OTP وSupabase Auth بالضبط لكلا مدخلَي الدخول — لا نظام مصادقة جديد إطلاقًا. الفرق
// الوحيد بين "parent" و"staff" هو ما يحدث بعد resolve-role: staff يرفض صراحةً أي دور غير
// admin/teacher (لا يُعامَل Parent هنا كفريق عمل ولا يُستدعى له link-parent إطلاقًا)، وparent
// يحتفظ بالسلوك الكامل الحالي (بما فيه مسار "none" ورحلة enroll/complete).
function AuthFormInner({ mode }: { mode: "parent" | "staff" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = safeNextPath(searchParams.get("next"));
  const prefilledEmail = searchParams.get("email") ?? "";

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState(prefilledEmail);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staffBlocked, setStaffBlocked] = useState<null | "parent" | "none">(null);
  const [parentName, setParentName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (mode !== "signup") return;
    try {
      const pending = JSON.parse(sessionStorage.getItem("khota_pending_enrollment") ?? "null") as { parentName?: string; phone?: string } | null;
      if (pending?.parentName) setParentName(pending.parentName);
      if (pending?.phone) setPhone(pending.phone);
    } catch {
      // Pending enrollment data is optional and never trusted as identity.
    }
  }, [mode]);

  function normalizedEmail() {
    return email.trim().toLowerCase();
  }

  async function sendOtp() {
    setError(null);
    const value = normalizedEmail();
    if (!value || !value.includes("@")) {
      setError("أدخل بريدًا إلكترونيًا صحيحًا.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp(
      mode === "signup"
        ? { email: value, options: { shouldCreateUser: true } }
        : { email: value, options: { shouldCreateUser: false } }
    );
    setLoading(false);
    if (error) {
      setError(mode === "parent" ? "تعذّر تسجيل الدخول بهذا البريد. إن لم يكن لديك حساب، أنشئ حسابًا." : friendlyAuthError(error.message));
      return;
    }
    setStep("otp");
  }

  async function verifyOtp() {
    setError(null);
    setLoading(true);

    const value = normalizedEmail();
    const { data, error } = await supabase.auth.verifyOtp({
      email: value,
      token: code,
      type: "email",
    });

    if (error || !data.user) {
      setLoading(false);
      setError(friendlyAuthError(error?.message));
      return;
    }

    const roleRes = await fetch("/api/auth/resolve-role", { method: "POST" }).catch(() => null);
    if (!roleRes || !roleRes.ok) {
      await supabase.auth.signOut();
      setLoading(false);
      if (mode === "staff") setStaffBlocked("none");
      else setError("تعذّر التحقق من صلاحية الحساب الآن. حاول مرة أخرى.");
      return;
    }
    const roleData = await roleRes.json().catch(() => null);
    if (!roleData || !["parent", "teacher", "admin", "none"].includes(roleData.role)) {
      await supabase.auth.signOut();
      setLoading(false);
      if (mode === "staff") setStaffBlocked("none");
      else setError("تعذّر التحقق من صلاحية الحساب الآن. حاول مرة أخرى.");
      return;
    }
    const role = roleData.role as "parent" | "teacher" | "admin" | "none";

    if (mode === "staff") {
      // دخول فريق العمل فقط — Parent (أو لا دور إطلاقًا) لا يحصل على أي صلاحية هنا، ولا
      // يُستدعى له link-parent إطلاقًا (ليس هذا الغرض من هذه الصفحة).
      setLoading(false);
      if (role === "admin") {
        router.push(isAllowedNextForRole("admin", nextParam) ? nextParam : "/admin");
        return;
      }
      if (role === "teacher") {
        router.push(isAllowedNextForRole("teacher", nextParam) ? nextParam : "/teacher");
        return;
      }
      await supabase.auth.signOut();
      setStaffBlocked(role === "parent" ? "parent" : "none");
      return;
    }

    if (mode === "signup") {
      if (role === "admin" || role === "teacher") {
        await supabase.auth.signOut();
        setLoading(false);
        setError("هذا البريد مخصص لحساب فريق خُطى. استخدم دخول فريق خُطى.");
        return;
      }
      const setupRes = role === "parent"
        ? await fetch("/api/auth/link-parent", { method: "POST" })
        : await fetch("/api/auth/complete-parent-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullName: parentName, phone }),
          });
      const setupData = await setupRes.json().catch(() => ({}));
      if (!setupRes.ok) {
        await supabase.auth.signOut();
        setLoading(false);
        setError(setupData.error ?? "تعذّر إعداد حساب ولي الأمر.");
        return;
      }
      setLoading(false);
      router.push(isAllowedNextForRole("parent", nextParam) ? nextParam : "/parent");
      return;
    }

    // mode === "parent" — نفس منطق /login الحالي بالكامل.
    if (role === "admin") {
      setLoading(false);
      router.push(isAllowedNextForRole("admin", nextParam) ? nextParam : "/admin");
      return;
    }
    if (role === "teacher") {
      setLoading(false);
      router.push(isAllowedNextForRole("teacher", nextParam) ? nextParam : "/teacher");
      return;
    }
    if (role === "parent") {
      await fetch("/api/auth/link-parent", { method: "POST" }).catch(() => null);
      setLoading(false);
      router.push(isAllowedNextForRole("parent", nextParam) ? nextParam : "/parent");
      return;
    }

    if (nextParam && nextParam.startsWith("/motabaa/enroll/complete")) {
      setLoading(false);
      router.push(nextParam);
      return;
    }

    const linkRes = await fetch("/api/auth/link-parent", { method: "POST" });
    const linkData = await linkRes.json().catch(() => ({}));
    setLoading(false);

    if (!linkRes.ok) {
      setError(linkData.error || "لا يوجد اشتراك مرتبط بهذا البريد. ابدأ التسجيل أولًا.");
      return;
    }
    router.push(isAllowedNextForRole("parent", nextParam) ? nextParam : "/parent");
  }

  if (staffBlocked === "parent") {
    return (
      <div className="dashcard">
        <b>هذا الدخول لفريق خُطى فقط</b>
        <p style={{ color: "var(--gray)", marginTop: 8 }}>
          حسابك مسجَّل كولي أمر. استخدم صفحة دخول ولي الأمر بدلًا من هذه الصفحة.
        </p>
        <a className="btn outline" href="/parent" style={{ marginTop: 12, display: "inline-flex" }}>دخول ولي الأمر ←</a>
      </div>
    );
  }

  if (staffBlocked === "none") {
    return (
      <div className="dashcard">
        <b>هذا البريد غير مرتبط بحساب موظف أو معلم.</b>
        <p style={{ color: "var(--gray)", marginTop: 8 }}>
          تواصل مع إدارة خُطى إن كنت تتوقع الوصول كموظف أو معلم.
        </p>
      </div>
    );
  }

  const accountLink = mode === "signup"
    ? `/login${nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""}`
    : `/signup${nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""}`;

  return (
    <div className="form">
      {mode === "signup" && (
        <>
          <label>
            اسم ولي الأمر
            <input value={parentName} onChange={(e: ChangeEvent<HTMLInputElement>) => setParentName(e.target.value)} />
          </label>
          <label>
            رقم الجوال
            <input dir="ltr" inputMode="numeric" maxLength={10} placeholder="05XXXXXXXX" value={phone} onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
          </label>
        </>
      )}
      {step === "email" && (
        <>
          <label>
            البريد الإلكتروني
            <input
              dir="ltr"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            />
          </label>
          {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
          <button className="btn" disabled={loading || (mode === "signup" && (!parentName || !phone))} onClick={sendOtp}>
            {loading ? "جارٍ الإرسال..." : mode === "signup" ? "إنشاء الحساب وإرسال الرمز" : "إرسال رمز التحقق"}
          </button>
        </>
      )}

      {step === "otp" && (
        <>
          <p style={{ color: "var(--gray)" }}>أرسلنا رمز التحقق إلى بريدك الإلكتروني.</p>
          <label>
            رمز التحقق
            <input dir="ltr" value={code} onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value)} />
          </label>
          {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
          <button className="btn" disabled={loading} onClick={verifyOtp}>
            {loading ? "جارٍ التحقق..." : "دخول"}
          </button>
        </>
      )}
      {mode !== "staff" && (
        <p style={{ color: "var(--gray)", fontSize: 13 }}>
          {mode === "signup" ? "لديك حساب؟ " : "ليس لديك حساب؟ "}
          <a href={accountLink} style={{ color: "var(--t)", fontWeight: 700 }}>
            {mode === "signup" ? "تسجيل الدخول" : "إنشاء حساب"}
          </a>
        </p>
      )}
    </div>
  );
}

export default function AuthForm({ mode }: { mode: "parent" | "staff" | "signup" }) {
  return (
    <Suspense fallback={null}>
      <AuthFormInner mode={mode} />
    </Suspense>
  );
}
