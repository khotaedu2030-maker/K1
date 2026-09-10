"use client";

import { useState } from "react";
import Image from "next/image";

const stages = [
  { band: "1–3", label: "1–3", title: "البداية المنظَّمة", desc: "بطاقات كبيرة، توجيه مباشر، وتشجيع مستمر يبني ثقة الطفل بنفسه من أول خطوة.", image: "/images/khota-grade-1-3.webp", objectPosition: "50% 12%" },
  { band: "4–6", label: "4–6", title: "الاستقلال التدريجي", desc: "مسؤولية أكبر تدريجيًا، مع متابعة ثابتة تحافظ على الاتزان بين الحرية والدعم.", image: "/images/khota-grade-4-6.webp", objectPosition: "50% 15%" },
  { band: "7–9", label: "7–9", title: "جلسات التركيز", desc: "تنظيم أولويات وإدارة وقت — لا شرح مواد، بل تركيز فعلي بعد يوم مدرسي طويل.", image: "/images/khota-grade-7-9.webp", objectPosition: "50% 10%" },
  { band: "10–12", label: "10–12", title: "الاستعداد والمسؤولية", desc: "تركيز مستقل واستعداد فعلي للاختبارات، بمسؤولية أقرب لما ينتظره الطالب بعد الثانوية.", image: "/images/khota-grade-10-12.webp", objectPosition: "50% 20%" },
];

export default function StagePicker() {
  const [active, setActive] = useState(0);
  const stage = stages[active];

  return (
    <div className="stage-picker">
      <div className="stage-picker-bg">
        <Image
          key={stage.image + stage.objectPosition}
          src={stage.image}
          alt={`المرحلة ${stage.band} — ${stage.title}`}
          fill
          sizes="(max-width: 850px) 100vw, 1180px"
          style={{ objectFit: "cover", objectPosition: stage.objectPosition }}
          loading="lazy"
        />
      </div>
      <div className="stage-picker-content">
        <div className="stage-tabs" role="tablist" aria-label="اختر المرحلة الدراسية">
          {stages.map((s, i) => (
            <button
              key={s.band}
              role="tab"
              aria-selected={i === active}
              className={`stage-tab${i === active ? " on" : ""}`}
              onClick={() => setActive(i)}
            >
              الصفوف {s.label}
            </button>
          ))}
        </div>
        <h3 style={{ fontSize: "clamp(24px,3.2vw,34px)", fontWeight: 800, margin: "0 0 10px" }}>{stage.title}</h3>
        <p style={{ maxWidth: 520, color: "#e3e9ec", fontSize: 16, lineHeight: 1.9 }}>{stage.desc}</p>
      </div>
    </div>
  );
}
