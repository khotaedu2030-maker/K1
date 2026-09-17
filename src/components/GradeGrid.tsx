import Image from "next/image";
import Link from "next/link";

export type GradeBand = {
  band: string;
  desc: string;
  image: string;
  objectPosition: string;
};

// شبكة المراحل الأربع 2×2 — مكوّن مشترك بين الصفحة الرئيسية و/motabaa (كانا يكرّران نفس
// الترميز حرفيًا). صور كاملة الحجم فعليًا، لا بطاقات صغيرة.
export default function GradeGrid({ bands, showTitleLine = false }: { bands: GradeBand[]; showTitleLine?: boolean }) {
  return (
    <div className="grade-grid">
      {bands.map((g, i) => (
        <Link href="/motabaa/plans" className="grade-panel" key={g.band}>
          <div className="bg">
            <Image
              src={g.image}
              alt={g.band}
              fill
              sizes="(max-width: 850px) 100vw, 50vw"
              style={{ objectFit: "cover", objectPosition: g.objectPosition }}
              loading={i === 0 ? "eager" : "lazy"}
            />
          </div>
          <div className="grade-panel-content">
            <b>{g.band}</b>
            {showTitleLine ? <h3>{g.desc.split("،")[0]}</h3> : null}
            <p>{g.desc}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
