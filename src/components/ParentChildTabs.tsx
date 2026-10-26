import Link from "next/link";

type ChildOption = { id: string; first_name: string };
export default function ParentChildTabs({children, selectedId, basePath}: {
  children: ChildOption[];
  selectedId: string | null;
  basePath: "/parent" | "/parent/reports" | "/parent/reports/weekly";
}) {
  if (children.length < 2) return null;
  return (
    <nav aria-label="اختر الطفل" style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0 20px" }}>
      {children.map((child) => (
        <Link key={child.id} href={basePath + "?child=" + encodeURIComponent(child.id)}
          className={child.id === selectedId ? "btn small" : "btn small outline"}
          aria-current={child.id === selectedId ? "page" : undefined}>
          {child.first_name}
        </Link>
      ))}
    </nav>
  );
}
