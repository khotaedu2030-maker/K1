export default function ParentDashboardHeader({ parentName, isPilot }: { parentName: string | null; isPilot: boolean }) {
  return (
    <div style={{ marginBottom: 8 }}>
      {isPilot && (
        <span className="badge" style={{ marginBottom: 14, display: "inline-flex" }}>
          وضع تجريبي — بيانات تجريبية
        </span>
      )}
      <h1 className="title" style={{ fontSize: "clamp(26px,3.6vw,36px)", color: "var(--n)" }}>
        {parentName ? `مرحبًا، ${parentName} 👋` : "مرحبًا بك 👋"}
      </h1>
      <p style={{ color: "var(--gray)" }}>هذا ملخص متابعة طفلك مع خُطى.</p>
    </div>
  );
}
