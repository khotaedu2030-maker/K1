import Link from "next/link";

export default function CTASection({
  title,
  desc,
  href = "/motabaa/plans",
  label = "ابدأ الآن ←",
}: {
  title: string;
  desc?: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="cta-section">
      <h2>{title}</h2>
      {desc && <p className="lead" style={{ margin: "0 auto 24px" }}>{desc}</p>}
      <Link className="btn" href={href}>{label}</Link>
    </div>
  );
}
