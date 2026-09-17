import Shell from "@/components/Shell";
import FaqAccordion from "@/components/FaqAccordion";

const faqs: [string, string][] = [
  ["هل المعلم يحل الواجب؟", "لا. نساعد الطفل على فهم مهامه وإنجازها بنفسه."],
  ["ماذا لو لم يوجد واجب؟", "نراجع دروس اليوم ونستعد لاختبارات أو مهام قادمة."],
  ["ماذا لو غاب الطالب؟", "يمكن تعويض الجلسة حسب سياسة الخطة."],
  ["هل المعلم ثابت؟", "نعم، يتابع نفس المعلم الطفل قدر الإمكان."],
  ["كم طفلًا في المجموعة؟", "حتى 3 للصفوف 1–3، وحتى 4 للصفوف 4–6."],
  ["كيف يصل التقرير؟", "بطاقة إنجاز مختصرة بعد كل جلسة."],
];

export default function P() {
  return (
    <Shell>
      <main>
        <section className="statement" style={{ padding: "80px 0 60px" }}>
          <div className="container">
            <div className="step-motif" style={{ margin: "0 auto 18px", justifyContent: "center" }}><span /><span /><span /><span /></div>
            <span className="eyebrow" style={{ justifyContent: "center" }}>مركز المساعدة</span>
            <h2 style={{ fontSize: "clamp(30px,4vw,44px)" }}>الأسئلة الشائعة</h2>
            <p style={{ color: "var(--gray)", fontSize: 16, maxWidth: 480, margin: "16px auto 0" }}>
              لا نحل الواجب عن الطفل. لا نطلب كلمات مرور مدرستي أو توكلنا. جميع الخدمات عن بُعد.
            </p>
          </div>
        </section>

        <section className="section">
          <div className="narrow">
            <FaqAccordion items={faqs} />
          </div>
        </section>
      </main>
    </Shell>
  );
}
