const COLORS = ["var(--t)", "var(--g)", "#E0745A", "var(--n)"];

export default function StepCard({ index, title, desc }: { index: number; title: string; desc: string }) {
  return (
    <div className="step-item">
      <div className="step-item-num" style={{ background: COLORS[index % COLORS.length] }}>{index + 1}</div>
      <b>{title}</b>
      <p>{desc}</p>
    </div>
  );
}
