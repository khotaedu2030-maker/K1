"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

const stages = [
  {
    band: "1–3", label: "الابتدائي المبكر",
    title: "بداية أكثر وضوحًا.",
    desc: "تساعده على بناء العادات الأساسية وفهم المهام بطريقة بسيطة ومنظمة.",
    image: "/images/khota-grade-1-3.webp", objectPosition: "50% 10%",
  },
  {
    band: "4–6", label: "الابتدائي العالي",
    title: "مساحة أكبر للاستقلالية.",
    desc: "يبدأ بترتيب أولوياته بنفسه، مع متابعة ثابتة تحافظ على التوازن.",
    image: "/images/khota-grade-4-6.webp", objectPosition: "50% 14%",
  },
  {
    band: "7–9", label: "المتوسط",
    title: "رحلة واضحة من البداية إلى الاستقلالية.",
    desc: "جلسات تركيز منظّمة تساعده على إدارة مسؤولياته وما يُتوقَّع منه.",
    image: "/images/khota-grade-7-9.webp", objectPosition: "50% 8%",
  },
  {
    band: "10–12", label: "الثانوي",
    title: "استقلالية حقيقية، واستعداد لما بعدها.",
    desc: "تركيز مستقل وتنظيم أكثر نضجًا للمهام والاختبارات والأهداف.",
    image: "/images/khota-grade-10-12.webp", objectPosition: "50% 18%",
  },
];

export default function StagesExplorer() {
  const [active, setActive] = useState(0);
  const s = stages[active];

  return (
    <div className="stages-explorer">
      <div>
        <div className="stages-tabs" role="tablist" aria-label="مراحل خُطى">
          {stages.map((st, i) => (
            <button
              key={st.band}
              role="tab"
              aria-selected={i === active}
              className={`stages-tab${i === active ? " active" : ""}`}
              onClick={() => setActive(i)}
            >
              <b>{st.band}</b>
              <span>{st.label}</span>
            </button>
          ))}
        </div>
        <div className="stages-desc">
          <h2 style={{ fontSize: 26 }}>{s.title}</h2>
          <p className="lead" style={{ marginTop: 10 }}>{s.desc}</p>
          <Link className="btn" href="/motabaa/plans">استعرض خطط هذه المرحلة ←</Link>
        </div>
      </div>
      <div className="stages-photo">
        <Image
          src={s.image}
          alt={`الصفوف ${s.band} — ${s.label}`}
          fill
          sizes="(max-width: 850px) 100vw, 55vw"
          style={{ objectFit: "cover", objectPosition: s.objectPosition }}
          priority={active === 0}
        />
      </div>
    </div>
  );
}
