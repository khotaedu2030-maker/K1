import Shell from "@/components/Shell";
import AuthForm from "@/components/AuthForm";

export const metadata = {
  title: "دخول فريق خُطى",
  description: "دخول للمعلمين وفريق التشغيل والإدارة في خُطى.",
};

export default function StaffLoginPage() {
  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">KHOTA</span>
          <h1 className="title" style={{ fontSize: 34 }}>دخول فريق خُطى</h1>
          <p className="lead">للمعلمين وفريق التشغيل والإدارة.</p>

          <div style={{ marginTop: 24 }}>
            <AuthForm mode="staff" />
          </div>

          <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 20 }}>
            هل أنت ولي أمر؟ <a href="/login" style={{ color: "var(--t)", fontWeight: 700 }}>دخول ولي الأمر من هنا ←</a>
          </p>
        </div>
      </main>
    </Shell>
  );
}
