"use client";

import { useEffect, useRef, useState } from "react";

// كشف تدريجي عند التمرير — بدون أي مكتبة خارجية (لا Framer Motion، لا GSAP)، فقط
// IntersectionObserver + CSS transitions. عنصر واحد بسيط يُلفّ حوله أي قسم لإعطائه حركة
// دخول أنيقة وخفيفة عند وصوله لمنطقة الرؤية — يُطبَّق مرة واحدة فقط (لا يتكرر عند التمرير للأعلى).
export default function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Component = Tag as any;
  return (
    <Component
      ref={ref}
      className={`reveal${visible ? " reveal-in" : ""} ${className}`.trim()}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Component>
  );
}
