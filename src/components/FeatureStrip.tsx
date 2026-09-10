const TONES: Record<string, { bg: string; color: string }> = {
  teal: { bg: "var(--teal-light)", color: "var(--t)" },
  peach: { bg: "#FFE9DE", color: "#E0745A" },
  gold: { bg: "#FFF3D6", color: "#B8860B" },
  navy: { bg: "#E9EEF1", color: "var(--n)" },
};

export default function FeatureStrip({
  items,
}: {
  items: { icon: string; title: string; desc: string; tone?: keyof typeof TONES }[];
}) {
  return (
    <div className="feature-strip">
      {items.map((it) => {
        const tone = TONES[it.tone ?? "teal"];
        return (
          <div className="feature-strip-item" key={it.title}>
            <span className="feature-strip-icon" style={{ background: tone.bg, color: tone.color }}>{it.icon}</span>
            <div>
              <b>{it.title}</b>
              <span style={{ color: "var(--gray)", fontSize: 13 }}>{it.desc}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
