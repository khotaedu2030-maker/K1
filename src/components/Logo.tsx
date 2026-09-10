// شعار خُطى — الدرج المتصاعد (الخطوات) + النجمة، بألوان الهوية.
// الرمز المختصر LogoMark للاستخدام في المساحات الضيقة (Header الجوال، Favicon، بطاقات).
// اللوقو الكامل Logo يجمع الرمز مع الاسم "خُطى" و"KHOTA".

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="khota-steps" x1="6" y1="52" x2="52" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2CB1A1" />
          <stop offset="1" stopColor="#FFB199" />
        </linearGradient>
      </defs>
      {/* درج متصاعد بأربع خطوات، مستوحى من امتداد حرف الخاء */}
      <path
        d="M6 52H18V44H30V34H42V22H50V14H56"
        stroke="url(#khota-steps)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* النجمة أعلى الدرج */}
      <path
        d="M55 4l2.1 4.4 4.9.7-3.5 3.4.8 4.9-4.3-2.3-4.3 2.3.8-4.9-3.5-3.4 4.9-.7L55 4z"
        fill="#FFD166"
      />
    </svg>
  );
}

export default function Logo({
  compact = false,
  size = 34,
}: {
  compact?: boolean;
  size?: number;
}) {
  return (
    <span className="brand">
      <LogoMark size={size} />
      {!compact && (
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
          <b>خُطى</b>
          <span className="en">KHOTA</span>
        </span>
      )}
    </span>
  );
}
