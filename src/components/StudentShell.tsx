import Link from "next/link";
import ExitStudentMode from "./ExitStudentMode";
import { LogoMark } from "./Logo";
import { getToneLevel } from "@/lib/grade-config";

const navItems = [
  { href: "/student/today", label: "اليوم", icon: "☀️" },
  { href: "/student/tasks", label: "مهامي", icon: "✅" },
  { href: "/student/schedule", label: "جدولي", icon: "📅" },
  { href: "/student/progress", label: "تقدّمي", icon: "📈" },
  { href: "/student/achievements", label: "إنجازاتي", icon: "🏅" },
];

// Shell مستقل تمامًا عن Header/Footer الموقع العام — الطفل لا يرى أي رابط لولي الأمر
// أو المعلم أو الأدمن بالبناء، وليس بمجرد إخفاء بصري.
export default function StudentShell({
  firstName,
  grade,
  children,
}: {
  firstName: string;
  grade: number;
  children: React.ReactNode;
}) {
  const tone = getToneLevel(grade);

  return (
    <div className={`student-shell${tone === "junior" ? " student-junior" : ""}`}>
      <header className="student-header">
        <div className="student-header-inner">
          <div className="student-brand">
            <LogoMark size={32} />
            <span>{tone === "focus" ? `أهلًا ${firstName}` : `مرحبًا ${firstName} 👋`}</span>
          </div>
          <ExitStudentMode />
        </div>
      </header>

      <main className="student-main">{children}</main>

      <nav className="student-bottom-nav">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="student-nav-item">
            <span className="student-nav-icon">{item.icon}</span>
            <span className="student-nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
