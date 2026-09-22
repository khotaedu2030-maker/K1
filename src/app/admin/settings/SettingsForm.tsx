"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

// فقط الحقول التي تحكم فعليًا سلوكًا تشغيليًا حقيقيًا حاليًا (تحققتُ من كل استهلاك مباشرةً في
// الكود قبل عرضه هنا) — لا حقل يُعطي انطباعًا بالتحكم بسلوك يتجاهله التطبيق فعليًا.
type Settings = {
  makeup_monthly_limit: number;
  pause_min_days: number;
  pause_max_days: number;
  quiet_hours_start: string;
  quiet_hours_end: string;
  registration_enabled: boolean;
  seat_hold_hours: number;
  attendance_lock_hours: number;
  default_capacity_1_3: number;
  default_capacity_4_6: number;
  default_capacity_7_9: number;
  default_capacity_10_12: number;
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
        pauseMinDays: values.pause_min_days,
        pauseMaxDays: values.pause_max_days,
        quietHoursStart: values.quiet_hours_start.slice(0, 5),
        quietHoursEnd: values.quiet_hours_end.slice(0, 5),
        registrationEnabled: values.registration_enabled,
        seatHoldHours: values.seat_hold_hours,
        attendanceLockHours: values.attendance_lock_hours,
        defaultCapacity1_3: values.default_capacity_1_3,
        defaultCapacity4_6: values.default_capacity_4_6,
        defaultCapacity7_9: values.default_capacity_7_9,
        defaultCapacity10_12: values.default_capacity_10_12,
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
        <h2 style={{ fontSize: 18 }}>التسجيل والمقاعد</h2>
        <label>
          <span style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span>فتح التسجيل</span>
            <input type="checkbox" checked={values.registration_enabled} onChange={(e: ChangeEvent<HTMLInputElement>) => set("registration_enabled", e.target.checked)} />
          </span>
        </label>
        <label>
          مدة حجز المقعد قبل انتهاء الحجز (ساعات)
          <input dir="ltr" inputMode="numeric" value={values.seat_hold_hours}
            onChange={(e: ChangeEvent<HTMLInputElement>) => set("seat_hold_hours", Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </label>
        <label>
          السعة الافتراضية للصفوف 1–3
          <input dir="ltr" inputMode="numeric" value={values.default_capacity_1_3}
            onChange={(e: ChangeEvent<HTMLInputElement>) => set("default_capacity_1_3", Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </label>
        <label>
          السعة الافتراضية للصفوف 4–6
          <input dir="ltr" inputMode="numeric" value={values.default_capacity_4_6}
            onChange={(e: ChangeEvent<HTMLInputElement>) => set("default_capacity_4_6", Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </label>
        <label>
          السعة الافتراضية للصفوف 7–9
          <input dir="ltr" inputMode="numeric" value={values.default_capacity_7_9}
            onChange={(e: ChangeEvent<HTMLInputElement>) => set("default_capacity_7_9", Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </label>
        <label>
          السعة الافتراضية للصفوف 10–12
          <input dir="ltr" inputMode="numeric" value={values.default_capacity_10_12}
            onChange={(e: ChangeEvent<HTMLInputElement>) => set("default_capacity_10_12", Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </label>

        <h2 style={{ fontSize: 18, marginTop: 12 }}>الحضور والجلسات</h2>
        <label>
          مدة السماح بتعديل الحضور بعد الجلسة (ساعات)
          <input dir="ltr" inputMode="numeric" value={values.attendance_lock_hours}
            onChange={(e: ChangeEvent<HTMLInputElement>) => set("attendance_lock_hours", Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </label>

        <h2 style={{ fontSize: 18, marginTop: 12 }}>التعويض والتجميد</h2>
        <label>
          الحد الشهري لأرصدة التعويض (غياب الطالب)
          <input dir="ltr" inputMode="numeric" value={values.makeup_monthly_limit}
            onChange={(e: ChangeEvent<HTMLInputElement>) => set("makeup_monthly_limit", Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </label>
        <label>
          الحد الأدنى لمدة تجميد الاشتراك (أيام)
          <input dir="ltr" inputMode="numeric" value={values.pause_min_days}
            onChange={(e: ChangeEvent<HTMLInputElement>) => set("pause_min_days", Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </label>
        <label>
          أقصى مدة تجميد اشتراك (أيام)
          <input dir="ltr" inputMode="numeric" value={values.pause_max_days}
            onChange={(e: ChangeEvent<HTMLInputElement>) => set("pause_max_days", Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </label>

        <h2 style={{ fontSize: 18, marginTop: 12 }}>الرسائل</h2>
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
