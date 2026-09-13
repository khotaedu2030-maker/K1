import Image from "next/image";
import Link from "next/link";
import Shell from "@/components/Shell";
import Reveal from "@/components/Reveal";
import EditorialSplit from "@/components/EditorialSplit";

export default function P() {
  return (
    <Shell>
      <main>
        <EditorialSplit image="/images/khota-parent-experience.webp" alt="أم وابنها يراجعان التقدّم الدراسي معًا" objectPosition="35% 25%">
          <Reveal>
            <span className="eyebrow">عن خُطى</span>
            <h1 style={{ fontSize: "clamp(32px,4.4vw,54px)", lineHeight: 1.2 }}>لماذا خُطى؟</h1>
            <p className="lead">
              المشكلة ليست دائمًا في فهم الدرس. أحيانًا يحتاج الطالب إلى من يساعده على ترتيب
              يومه، البدء، الاستمرار، ثم معرفة ما أنجزه.
            </p>
          </Reveal>
        </EditorialSplit>

        <section className="editorial-statement">
          <div className="container">
            <Reveal>
              <span className="eyebrow">فلسفتنا</span>
              <h2>
                خطوات صغيرة.
                <br />
                استقلالية أكبر.
                <br />
                متابعة أهدأ للأسرة.
              </h2>
              <p>
                خُطى شريك تعليمي بعد المدرسة يساعد الطالب على تنظيم ما عليه، إنجازه باستقلالية أكبر، ويمنح ولي الأمر رؤية واضحة بلا ملاحقة يومية.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="cta-cinematic" style={{ minHeight: "50vh" }}>
          <div className="bg">
            <Image src="/images/khota-about.webp" alt="مكتب دراسة هادئ" fill sizes="100vw" style={{ objectFit: "cover" }} loading="lazy" />
          </div>
          <div className="container cta-cinematic-content">
            <Reveal>
              <h2>هذا ما نبنيه، جلسة بعد جلسة.</h2>
              <Link className="btn" href="/motabaa/plans">ابدأ الآن ←</Link>
            </Reveal>
          </div>
        </section>
      </main>
    </Shell>
  );
}
