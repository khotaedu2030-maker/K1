import Image from "next/image";
import Shell from "@/components/Shell";

export default function P() {
  return (
    <Shell>
      <main className="split-screen" style={{ minHeight: "calc(100vh - 78px)" }}>
        <div className="split-content" style={{ background: "var(--bg)" }}>
          <div className="step-motif" style={{ marginBottom: 16 }}><span /><span /><span /><span /></div>
          <span className="eyebrow">خُطى</span>
          <h1 style={{ fontSize: "clamp(30px,3.6vw,44px)", lineHeight: 1.2 }}>نسمعك.</h1>
          <p className="lead" style={{ maxWidth: 380 }}>
            سؤال عن الخطط، حالة خاصة لطفلك، أو ملاحظة عن جلسة.
          </p>

          <div className="form" style={{ marginTop: 30 }}>
            <label>
              الاسم
              <input />
            </label>
            <label>
              الجوال
              <input dir="ltr" />
            </label>
            <label>
              موضوع الرسالة
              <textarea rows={4} />
            </label>
            <p style={{ color: "var(--gray)", fontSize: 13, margin: 0 }}>
              لا ترسل بيانات البطاقة أو كلمات المرور أو رموز التحقق عبر هذا النموذج أو أي قناة تواصل أخرى.
            </p>
            <p style={{ color: "var(--n)", fontSize: 13, fontWeight: 700, margin: 0 }}>
              قناة الدعم الإلكترونية عبر هذا النموذج غير مفعَّلة بعد. سيتم تفعيلها قريبًا.
            </p>
            <button className="btn" disabled title="غير متاح حاليًا">إرسال</button>
          </div>
        </div>
        <div className="split-visual step-frame flip">
          <Image
            src="/images/khota-parent-experience.webp"
            alt="طالبة تدرس في بيئة منزلية هادئة"
            fill
            sizes="(max-width: 850px) 100vw, 50vw"
            style={{ objectFit: "cover", objectPosition: "58% 40%" }}
            priority
          />
        </div>
      </main>
    </Shell>
  );
}
