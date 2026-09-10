"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export type HeroStory = {
  label: string;
  image: string;
  alt: string;
  objectPosition: string;
  h1: [string, string];
  lead: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

// شريط القصص أسفل الـHero — جزء من نفس اللقطة التصويرية، لا Carousel منفصل. تقدّم تلقائي بطيء
// يتوقف نهائيًا بعد أول تفاعل من المستخدم (نقر أو كيبورد)، ويحترم prefers-reduced-motion عبر
// القاعدة العامة أعلى globals.css (لا حاجة لمنطق JS إضافي لذلك — القاعدة العامة تُلغي كل الحركة).
export default function HeroStoryRail({ stories }: { stories: HeroStory[] }) {
  const [active, setActive] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (userInteracted) return;
    timerRef.current = setInterval(() => {
      setActive((a: number) => (a + 1) % stories.length);
    }, 6000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [userInteracted, stories.length]);

  function select(i: number) {
    setUserInteracted(true);
    setActive(i);
  }

  const story = stories[active];

  return (
    <>
      <div className="bg">
        {stories.map((s, i) => (
          <Image
            key={s.image}
            src={s.image}
            alt={s.alt}
            fill
            sizes="100vw"
            style={{ objectFit: "cover", objectPosition: s.objectPosition, opacity: i === active ? 1 : 0, transition: "opacity 700ms var(--ease-premium)" }}
            priority={i === 0}
            loading={i === 0 ? "eager" : "lazy"}
          />
        ))}
      </div>
      <div className="container hero-editorial-v28-content">
        <h1>
          <span>{story.h1[0]}</span>
          <br />
          <span>{story.h1[1]}</span>
        </h1>
        <p className="lead">{story.lead}</p>
        <div className="actions">
          <Link className="btn" href={story.ctaHref}>{story.ctaLabel} ←</Link>
          {story.secondaryLabel && story.secondaryHref && (
            <Link className="btn outline" style={{ borderColor: "#ffffff55", color: "#fff" }} href={story.secondaryHref}>
              {story.secondaryLabel}
            </Link>
          )}
        </div>

        <div className="story-rail" role="tablist" aria-label="قصص خُطى">
          {stories.map((s, i) => (
            <button
              key={s.label}
              role="tab"
              aria-selected={i === active}
              className={`story-rail-item${i === active ? " active" : ""}`}
              onClick={() => select(i)}
            >
              <b>{String(i + 1).padStart(2, "0")}</b>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
