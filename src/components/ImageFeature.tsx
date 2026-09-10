import { LogoMark } from "./Logo";

// مساحة صورة "فارغة" بتصميم premium — بلا أي ملف صورة مرجعي إطلاقًا، فلا يمكن أن تظهر
// كصورة مكسورة (Broken Image) مهما حدث. تعرض تدرّج لوني هادئ بألوان الهوية + علامة خُطى
// شفافة خفيفة كعنصر تصميمي، وليست ادّعاءً بأنها صورة فوتوغرافية.
//
// عند توفر الصورة الحقيقية (حسب README_IMAGE_GUIDE.md)، استبدل هذا المكوّن في مكان استخدامه
// بـ next/image مباشرة: <Image src="/images/<filename>.webp" alt="..." fill />
export default function ImageFeature({
  ratio = "6 / 5",
  tone = "teal",
}: {
  ratio?: string;
  tone?: "teal" | "peach" | "gold";
}) {
  const gradients: Record<string, string> = {
    teal: "linear-gradient(135deg, var(--teal-light), var(--blue-light))",
    peach: "linear-gradient(135deg, #FFE9DE, var(--teal-light))",
    gold: "linear-gradient(135deg, #FFF3D6, var(--blue-light))",
  };

  return (
    <div
      className="image-feature"
      style={{ aspectRatio: ratio, background: gradients[tone] }}
      role="img"
      aria-label="مساحة مخصَّصة لصورة خُطى"
    >
      <div className="image-feature-mark">
        <LogoMark size={44} />
      </div>
    </div>
  );
}
