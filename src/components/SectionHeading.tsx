export default function SectionHeading({
  eyebrow,
  title,
  lead,
  center = true,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  center?: boolean;
}) {
  return (
    <div className="section-head" style={{ textAlign: center ? "center" : "start" }}>
      {eyebrow && <span className="eyebrow" style={center ? { justifyContent: "center" } : undefined}>{eyebrow}</span>}
      <h2>{title}</h2>
      {lead && <p className="lead">{lead}</p>}
    </div>
  );
}
