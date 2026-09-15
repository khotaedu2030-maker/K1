import Shell from "@/components/Shell";
import { legalProfile } from "@/lib/legal-profile";

export type LegalSection = {
  id: string;
  label: string;
  title: string;
  body: React.ReactNode;
};

export default function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro?: string;
  sections: LegalSection[];
}) {
  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">خُطى</span>
          <h1 className="title" style={{ fontSize: 36 }}>{title}</h1>
          {intro && <p className="lead" style={{ marginTop: 10 }}>{intro}</p>}

          <nav
            aria-label="أقسام الصفحة"
            style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 18, borderBottom: "1px solid var(--line)", paddingBottom: 16 }}
          >
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} style={{ color: "var(--t)", fontWeight: 700, fontSize: 14 }}>
                {s.label}
              </a>
            ))}
          </nav>

          <div className="list" style={{ marginTop: 24 }}>
            {sections.map((s) => (
              <article key={s.id} id={s.id}>
                <b>{s.title}</b>
                <div style={{ color: "var(--gray)", marginTop: 6, lineHeight: 1.9 }}>{s.body}</div>
              </article>
            ))}
          </div>

          <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 32 }}>
            آخر تحديث: {legalProfile.lastLegalUpdate}
          </p>
        </div>
      </main>
    </Shell>
  );
}
