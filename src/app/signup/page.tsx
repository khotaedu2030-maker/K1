import Shell from "@/components/Shell";
import AuthForm from "@/components/AuthForm";

export const metadata = {
  title: "إنشاء حساب ولي الأمر",
  description: "إنشاء حساب ولي الأمر في خُطى.",
};

export default function SignupPage() {
  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">KHOTA</span>
          <h1 className="title" style={{ fontSize: 34 }}>إنشاء حساب ولي الأمر</h1>
          <p className="lead">أنشئ حسابك ببريدك الإلكتروني لمتابعة رحلة طفلك.</p>
          <AuthForm mode="signup" />
        </div>
      </main>
    </Shell>
  );
}