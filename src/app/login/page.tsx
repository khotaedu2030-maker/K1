"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabase";
import { isValidSaudiLocalPhone, normalizeSaudiPhone, SAUDI_PHONE_ERROR } from "@/lib/phone";
import PilotLoginSection from "./PilotLoginSection";

// لا نعرض رسائل Supabase/الخادم الخام (Unsupported phone provider، أو أي رسالة تقنية أخرى)
// للمستخدم أبدًا — نُترجم المعروف منها لعربية واضحة، ونستخدم رسالة عامة مطمئنة لأي شيء آخر.
function friendlyAuthError(raw: string | undefined | null): string {
  if (!raw) return "تعذّر إكمال العملية الآن. حاول مرة أخرى.";
  const lower = raw.toLowerCase();
  if (lower.includes("unsupported") && lower.includes("phone")) {
    return "خدمة التحقق بالجوال غير مفعَّلة حاليًا.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "محاولات كثيرة متتالية — انتظر قليلًا ثم أعد المحاولة.";
  }
  if (lower.includes("invalid") && (lower.includes("otp") || lower.includes("token") || lower.includes("code"))) {
    return "رمز التحقق غير صحيح.";
  }
  return "تعذّر إكمال العملية الآن. حاول مرة أخرى.";
}

// تسجيل دخول ولي الأمر عبر رمز OTP على الجوال (Supabase Auth Phone Provider).
// الواجهة تعرض وتقبل الصيغة المحلية 05XXXXXXXX فقط — التحويل لصيغة +966 الدولية يحدث
// داخليًا فقط، مباشرة قبل استدعاء Supabase، ولا يظهر للمستخدم إطلاقًا.
// ⚠️ يتطلب تفعيل مزوّد SMS (مثل Twilio) من لوحة تحكم Supabase الخاصة بالمشروع؛
// بدون تفعيله لن يصل الرمز فعليًا رغم أن الكود صحيح — أي خطأ "Unsupported phone provider"
// هو إعداد ناقص في Supabase نفسه، وليس خطأ في هذا الكود، ولا يُعالَج بأي Workaround هنا.
export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendOtp() {
    setError(null);
    if (!name) {
      setError("الاسم مطلوب.");
      return;
    }
    if (!isValidSaudiLocalPhone(phone)) {
      setError(SAUDI_PHONE_ERROR);
      return;
    }

    setLoading(true);
    const internationalPhone = normalizeSaudiPhone(phone);
    const { error } = await supabase.auth.signInWithOtp({ phone: internationalPhone });
    setLoading(false);
    if (error) {
      setError(friendlyAuthError(error.message));
      return;
    }
    setStep("otp");
  }

  async function verifyOtp() {
    setError(null);
    setLoading(true);

    const internationalPhone = normalizeSaudiPhone(phone);
    const { data, error } = await supabase.auth.verifyOtp({
      phone: internationalPhone,
      token: code,
      type: "sms",
    });

    if (error || !data.user) {
      setLoading(false);
      setError(friendlyAuthError(error?.message));
      return;
    }

    // بعد التحقق، ننشئ/نحدّث صف ولي الأمر — مسموح به عبر سياسة parents_self_insert/update
    const { error: upsertError } = await supabase
      .from("parents")
      .upsert(
        { user_id: data.user.id, full_name: name, phone: internationalPhone },
        { onConflict: "user_id" }
      );

    setLoading(false);

    if (upsertError) {
      setError(friendlyAuthError(upsertError.message));
      return;
    }

    router.push("/parent");
  }

  return (
    <Shell>
      <main className="split-screen" style={{ minHeight: "calc(100vh - 78px)" }}>
        <div className="split-visual step-frame" style={{ order: 2 }}>
          <Image
            src="/images/khota-parent-experience.webp"
            alt="ولي أمر يتابع رحلة طفله في خُطى"
            fill
            sizes="(max-width: 850px) 100vw, 50vw"
            style={{ objectFit: "cover", objectPosition: "58% center" }}
            priority
          />
        </div>
        <div className="split-content" style={{ background: "var(--bg)" }}>
          <div className="step-motif" style={{ marginBottom: 16 }}><span /><span /><span /><span /></div>
          <span className="eyebrow">KHOTA</span>
          <h1 className="title" style={{ fontSize: 40 }}>تسجيل الدخول</h1>
          <p className="lead">أدخل رقم جوالك للوصول إلى حسابك ومتابعة تقدّم طفلك.</p>

          <div className="form">
            {step === "phone" && (
              <>
                <label>
                  اسمك
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label>
                  رقم الجوال
                  <input
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="05XXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  />
                </label>
                {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
                <button className="btn" disabled={loading} onClick={sendOtp}>
                  {loading ? "جارٍ الإرسال..." : "إرسال رمز التحقق"}
                </button>
              </>
            )}

            {step === "otp" && (
              <>
                <p style={{ color: "var(--gray)" }}>أرسلنا رمزًا إلى {phone}</p>
                <label>
                  رمز التحقق
                  <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} />
                </label>
                {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
                <button className="btn" disabled={loading} onClick={verifyOtp}>
                  {loading ? "جارٍ التحقق..." : "دخول"}
                </button>
              </>
            )}
          </div>

          <Suspense fallback={null}>
            <PilotLoginSection />
          </Suspense>
        </div>
      </main>
    </Shell>
  );
}
