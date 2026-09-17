import Image from "next/image";
import Shell from "@/components/Shell";
import ContactForm from "./ContactForm";

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

          <ContactForm />
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
