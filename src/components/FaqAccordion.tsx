"use client";

import { useState } from "react";

export default function FaqAccordion({ items }: { items: [string, string][] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div>
      {items.map(([q, a], i) => {
        const open = openIndex === i;
        return (
          <div key={q} style={{ borderBottom: "1px solid var(--line)" }}>
            <button
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                padding: "22px 4px",
                background: "transparent",
                border: 0,
                fontFamily: "inherit",
                fontSize: 17,
                fontWeight: 800,
                textAlign: "right",
                cursor: "pointer",
                color: "var(--n)",
              }}
            >
              <span>{q}</span>
              <span style={{ flexShrink: 0, color: "var(--t)", fontSize: 20, transform: open ? "rotate(45deg)" : "none", transition: "transform .2s" }}>+</span>
            </button>
            {open && <p style={{ margin: "0 4px 22px", color: "var(--gray)", lineHeight: 1.9 }}>{a}</p>}
          </div>
        );
      })}
    </div>
  );
}
