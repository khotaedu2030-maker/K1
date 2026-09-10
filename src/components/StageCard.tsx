import Image from "next/image";
import Link from "next/link";

export default function StageCard({
  href,
  image,
  objectPosition = "center",
  band,
  title,
  desc,
}: {
  href: string;
  image: string;
  objectPosition?: string;
  band: string;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href} className="stage-card">
      <div className="stage-card-photo">
        <Image
          src={image}
          alt={`الصفوف ${band} — ${title}`}
          fill
          sizes="(max-width: 480px) 100vw, (max-width: 1024px) 45vw, 22vw"
          style={{ objectFit: "cover", objectPosition }}
          loading="lazy"
        />
      </div>
      <div className="stage-card-body">
        <span style={{ color: "var(--gray)", fontSize: 12.5, fontWeight: 700 }}>الصفوف {band}</span>
        <b>{title}</b>
        <p style={{ margin: 0, color: "var(--gray)", fontSize: 13.5 }}>{desc}</p>
        <span className="stage-card-arrow">التفاصيل ←</span>
      </div>
    </Link>
  );
}
