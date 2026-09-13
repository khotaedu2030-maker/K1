import Image from "next/image";
import Link from "next/link";
import Shell from "@/components/Shell";

// إعادة بناء فعلية: لا Cards متجاورة بنفس الوزن — قرار واحد أساسي بصورة كبيرة، ومسار ثانوي
// نصّي هادئ تحته. بنية Split-screen، لا .narrow + .cards.
export default function P() {
  return (
    <Shell>
      <main className="split-screen" style={{ minHeight: "calc(100vh - 78px)" }}>
        <div className="split-visual step-frame">
          <Image
            src="/images/khota-hero.webp"
            alt="أم وابنها في جلسة متابعة دراسية منزلية"
            fill
            sizes="(max-width: 850px) 100vw, 50vw"
            style={{ objectFit: "cover", objectPosition: "45% 15%" }}
            priority
          />
        </div>

        <div className="split-content" style={{ background: "var(--bg)" }}>
          <div className="step-motif" style={{ marginBottom: 22 }}><span /><span /><span /><span /></div>
          <span className="eyebrow">ابدأ الآن</span>
          <h1 style={{ fontSize: "clamp(34px,4.4vw,54px)", lineHeight: 1.12, margin: "0 0 18px" }}>
            ابدأ متابعة طفلك
            <br />
            مع خُطى.
          </h1>
          <p className="lead" style={{ maxWidth: 420 }}>
            متابعة منظَّمة بعد المدرسة، من الصف الأول الابتدائي حتى الثالث الثانوي.
          </p>

          <Link
            href="/motabaa/plans"
            className="btn"
            style={{ marginTop: 32, fontSize: 17, padding: "20px 30px", display: "inline-flex" }}
          >
            أريد متابعة دراسة طفلي ←
          </Link>

          <Link
            href="/motabaa"
            style={{ display: "block", marginTop: 22, color: "var(--gray)", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 4 }}
          >
            أو تعرّف أولًا على طريقة عمل خُطى
          </Link>
        </div>
      </main>
    </Shell>
  );
}
