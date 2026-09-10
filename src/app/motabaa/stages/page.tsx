import Shell from "@/components/Shell";
import Reveal from "@/components/Reveal";
import StagesExplorer from "@/components/StagesExplorer";

export const metadata = {
  title: "المراحل الدراسية",
  description: "أسلوب متابعة خُطى يتطوّر مع كل مرحلة، من الابتدائي المبكر حتى الثانوي.",
};

export default function P() {
  return (
    <Shell>
      <main className="section">
        <div className="container">
          <Reveal>
            <span className="eyebrow">المراحل</span>
            <h1 className="title" style={{ fontSize: "clamp(30px,4vw,46px)" }}>خُطى تكبر معه.</h1>
            <p className="lead" style={{ maxWidth: 560 }}>
              مراحل دراسية مصمَّمة لاحتياجات كل مرحلة — كلما كبر الطالب، زادت مساحة استقلاليته.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <StagesExplorer />
          </Reveal>
        </div>
      </main>
    </Shell>
  );
}
