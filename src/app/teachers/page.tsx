import Image from "next/image";
import Link from "next/link";
import Shell from "@/components/Shell";
import Reveal from "@/components/Reveal";

export default function P() {
  return (
    <Shell transparentHeader>
      <main>
        <section className="hero-editorial-v28" style={{ minHeight: "68vh" }}>
          <div className="bg">
            <Image
              src="/images/khota-teacher.webp"
              alt="معلمة سعودية تقدّم جلسة تعليمية عن بُعد"
              fill
              sizes="100vw"
              style={{ objectFit: "cover", objectPosition: "45% 20%" }}
              priority
            />
          </div>
          <div className="container hero-editorial-v28-content">
            <Reveal>
              <h1 style={{ fontSize: "clamp(32px,5vw,60px)" }}>متابعة بشرية، بطريقة منظمة.</h1>
              <p className="lead">دور المعلم في خُطى ليس شرح الدرس من جديد، بل مساعدة الطالب على التركيز والاستمرار.</p>
            </Reveal>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="progression">
              {[
                ["إدارة الجلسة", "يبدأ بمراجعة أولويات الطالب لليوم."],
                ["التدخل عند الحاجة", "يوجّه فقط عند تعثر حقيقي، لا كل خطوة."],
                ["تشجيع الاستقلالية", "يترك مساحة للطالب لينجز بنفسه."],
                ["مراجعة الإنجاز", "يوثّق ما تم، ويحدّد ما يحتاج غدًا."],
              ].map(([title, desc]) => (
                <Reveal key={title}>
                  <div className="progression-item">
                    <h3 style={{ fontSize: 18 }}>{title}</h3>
                    <p style={{ color: "var(--gray)", fontSize: 14, marginTop: 8 }}>{desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <div className="actions" style={{ marginTop: 40, justifyContent: "center" }}>
              <Link className="btn outline" href="/teach-with-khota">انضم كمعلم في خُطى ←</Link>
            </div>
          </div>
        </section>
      </main>
    </Shell>
  );
}
