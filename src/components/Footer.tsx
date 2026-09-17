import Link from "next/link";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer>
      <div className="container">
        <div className="footer-top">
          <div>
            <div className="step-motif" style={{ marginBottom: 18 }}><span /><span /><span /><span /></div>
            <h3>كل خطوة اليوم، تصنع استقلالًا أكبر غدًا.</h3>
          </div>
          <Link className="btn" href="/start">ابدأ مع خُطى ←</Link>
        </div>

        <div className="foot">
          <div>
            <Logo />
            <p style={{ marginTop: 16, color: "#9fb0bb", lineHeight: 1.9 }}>
              خُطى — الشريك التعليمي للأسرة بعد المدرسة.
            </p>
          </div>
          <div>
            <h4>البرامج</h4>
            <Link href="/motabaa">خُطى متابعة</Link>
          </div>
          <div>
            <h4>خُطى</h4>
            <Link href="/about">عن خُطى</Link>
            <Link href="/teachers">المعلمون</Link>
            <Link href="/teach-with-khota">انضم كمعلم</Link>
          </div>
          <div>
            <h4>الدعم</h4>
            <Link href="/help">الأسئلة الشائعة</Link>
            <Link href="/contact">تواصل معنا</Link>
            <Link href="/staff/login">دخول فريق خُطى</Link>
          </div>
          <div>
            <h4>قانوني</h4>
            <Link href="/privacy">سياسة الخصوصية</Link>
            <Link href="/terms">الشروط والأحكام</Link>
            <Link href="/refund-policy">الاسترجاع والاسترداد</Link>
            <Link href="/complaints">الشكاوى والمقترحات</Link>
            <Link href="/legal">بيانات مقدّم الخدمة</Link>
          </div>
        </div>
      </div>
      <div className="container copy">
        <span>© 2026 خُطى</span>
        <span style={{ display: "flex", gap: 16 }}>
          <Link href="/privacy">سياسة الخصوصية</Link>
          <Link href="/terms">الشروط والأحكام</Link>
        </span>
      </div>
    </footer>
  );
}
