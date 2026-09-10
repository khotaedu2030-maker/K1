import Image from "next/image";
import type { ReactNode } from "react";

// قسم Split تحريري غير متماثل (60/40 افتراضيًا) — يُستخدَم بكثرة عبر الصفحة الرئيسية و/motabaa
// و/about و/motabaa/how-it-works. يقبل الصورة من أي جهة (reverse) وخلفية المحتوى.
export default function EditorialSplit({
  image,
  alt,
  objectPosition = "center",
  reverse = false,
  contentBg = "var(--bg)",
  children,
}: {
  image: string;
  alt: string;
  objectPosition?: string;
  reverse?: boolean;
  contentBg?: string;
  children: ReactNode;
}) {
  const visual = (
    <div className="split-visual">
      <Image
        src={image}
        alt={alt}
        fill
        sizes="(max-width: 850px) 100vw, 40vw"
        style={{ objectFit: "cover", objectPosition }}
        loading="lazy"
      />
    </div>
  );
  const content = (
    <div className="split-content" style={{ background: contentBg }}>
      {children}
    </div>
  );

  return (
    <div className={reverse ? "split-40" : "split-60"}>
      {reverse ? (
        <>
          {visual}
          {content}
        </>
      ) : (
        <>
          {content}
          {visual}
        </>
      )}
    </div>
  );
}
