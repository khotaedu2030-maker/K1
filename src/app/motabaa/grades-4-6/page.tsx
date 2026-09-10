import Link from "next/link";
import Shell from "@/components/Shell";

export default function P() {
  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">الصفوف 4–6 • حتى 4 طلاب</span>
          <h1 className="title" style={{ fontSize: 40 }}>المتابعة نحو الاستقلالية</h1>
          <p className="lead">
            الواجبات، مراجعة دروس اليوم، تنظيم المهام، الاستعداد للاختبارات، معالجة التعثرات
            البسيطة، وبناء استقلالية الطالب تدريجيًا.
          </p>
          <Link className="btn" href="/motabaa/plans">استعرض الخطط ←</Link>
        </div>
      </main>
    </Shell>
  );
}
