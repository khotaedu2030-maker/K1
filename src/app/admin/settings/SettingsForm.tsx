"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

// فقط الحقول التي تحكم فعليًا سلوكًا تشغيليًا حقيقيًا حاليًا (تحققتُ من كل استهلاك مباشرةً في
// الكود قبل عرضه هنا) — لا حقل يُعطي انطباعًا بالتحكم بسلوك يتجاهله التطبيق فعليًا.
type Settings = {
  makeup_monthly_limit: number;
  pause_max_days: number;
  quiet_hours_start: string;
  quiet_hours_end: string;
};

export default function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setValues((v: Settings) => ({ ...v, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        makeupMonthlyLimit: values.makeup_monthly_limit,
        pauseMaxDays: values.pause_max_days,
        quietHoursStart: values.quiet_hours_start.slice(0, 5),
        quietHoursEnd: values.quiet_hours_end.slice(0, 5),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "تعذّر الحفظ");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="dashcard" style={{ maxWidth: 560 }}>
      <div className="form">
        <label>
          الحد الشهري لأرصدة التعويض (غياب الطالب)
          <input dir="ltr" inputMode="numeric" value={values.makeup_monthly_limit}
            onChange={(e: ChangeEvent<HTMLInputElement>) => set("makeup_monthly_limit", Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </label>
        <label>
          أقصى مدة تجميد اشتراك (أيام)
          <input dir="ltr" inputMode="numeric" value={values.pause_max_days}
            onChange={(e: ChangeEvent<HTMLInputElement>) => set("pause_max_days", Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </label>
        <label>
          بداية ساعات الهدوء (تقييد الرسائل)
          <input dir="ltr" type="time" value={values.quiet_hours_start.slice(0, 5)}
            onChange={(e: ChangeEvent<HTMLInputElement>) => set("quiet_hours_start", e.target.value)} />
        </label>
        <label>
          نهاية ساعات الهدوء
          <input dir="ltr" type="time" value={values.quiet_hours_end.slice(0, 5)}
            onChange={(e: ChangeEvent<HTMLInputElement>) => set("quiet_hours_end", e.target.value)} />
        </label>
        {error && <p role="alert" style={{ color: "var(--p)" }}>{error}</p>}
        {saved && <p style={{ color: "var(--t)", fontWeight: 700 }}>تم الحفظ — يسري خلال دقيقة (ذاكرة مؤقتة قصيرة).</p>}
        <button className="btn" disabled={loading} onClick={save}>{loading ? "جارٍ الحفظ..." : "حفظ"}</button>
      </div>
    </div>
  );
}
