import Image from "next/image";
import Shell from "@/components/Shell";
import Reveal from "@/components/Reveal";
import TeacherApplyForm from "./TeacherApplyForm";

export default function P() {
  return (
    <Shell transparentHeader>
      <main>
        <section className="hero-editorial-v28" style={{ minHeight: "56vh" }}>
          <div className="bg">
            <Image
              src="/images/khota-teacher.webp"
              alt="معلمة تقدّم جلسة متابعة عن بُعد"
              fill
              sizes="100vw"
              style={{ objectFit: "cover", objectPosition: "45% 20%" }}
              priority
            />
          </div>
          <div className="container hero-editorial-v28-content">
            <Reveal>
              <h1 style={{ fontSize: "clamp(30px,4.4vw,52px)" }}>انضم إلى معلمي خُطى.</h1>
              <p className="lead">نبحث عن معلمين ومعلمات متمكنين لخُطى متابعة وجلسات التركيز — لا تدريس مادة، بل بناء متابعة واستقلالية.</p>
            </Reveal>
          </div>
        </section>

        <section className="section">
          <div className="narrow">
            <Reveal>
              <TeacherApplyForm />
            </Reveal>
          </div>
        </section>
      </main>
    </Shell>
  );
}
