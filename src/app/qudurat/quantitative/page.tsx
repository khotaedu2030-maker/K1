import Link from "next/link";
import Shell from "@/components/Shell";

export default function P() {
  return (
    <Shell>
      <main>
        <section className="hero">
          <div className="container">
            <span className="eyebrow">خُطى قدرات</span>
            <h1>القسم الكمي</h1>
            <p className="lead">التناسب والهندسة والجبر وتحليل المسائل — بخطة تدريب تصاعدية ضمن مجموعة أو معسكر مركّز.</p>
            <Link className="btn" href="/qudurat/programs">عرض البرامج ←</Link>
          </div>
        </section>
      </main>
    </Shell>
  );
}
