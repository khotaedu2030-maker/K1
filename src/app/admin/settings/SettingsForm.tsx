"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Only settings connected to actual server-side business rules are editable.
// Values are validated again on the server, then saved through the audited RPC.
export type Settings = {
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

type SectionKey = "registration" | "groups" | "attendance" | "policies" | "messaging" | "other";
type NumericKey = Exclude<keyof Settings, "quiet_hours_start" | "quiet_hours_end" | "registration_enabled">;
type TimeKey = "quiet_hours_start" | "quiet_hours_end";
type NumericDefinition = {
  key: NumericKey;
  label: string;
  description: string;
  min: number;
  max: number;
  unit: string;
};

const SECTIONS: { key: SectionKey; icon: string; name: string; subtitle: string }[] = [
  { key: "registration", icon: "◉", name: "طلبات التسجيل والحجز", subtitle: "استقبال طلبات التسجيل وحجز المقاعد" },
  { key: "groups", icon: "▦", name: "المجموعات والسعات", subtitle: "الأعداد الافتراضية لكل مرحلة" },
  { key: "attendance", icon: "◷", name: "الحضور والجلسات", subtitle: "مهلة تعديل الحضور" },
  { key: "policies", icon: "≋", name: "التجميد والتعويض", subtitle: "ضوابط الاشتراكات" },
  { key: "messaging", icon: "☷", name: "أوقات التواصل والرد", subtitle: "تنظيم توقعات وقت الرد على الرسائل" },
  { key: "other", icon: "⚙", name: "إعدادات أخرى", subtitle: "الصلاحيات والربط والخدمات" },
];

const NUMERIC: Partial<Record<SectionKey, NumericDefinition[]>> = {
  registration: [
    { key: "seat_hold_hours", label: "مدة حجز المقعد المؤقت", description: "مدة الاحتفاظ بالحجز الجديد قبل انتهائه", min: 1, max: 72, unit: "ساعة" },
  ],
  groups: [
    { key: "default_capacity_1_3", label: "الصفوف 1–3", description: "السعة الافتراضية عند إنشاء مجموعة جديدة", min: 1, max: 20, unit: "طالب" },
    { key: "default_capacity_4_6", label: "الصفوف 4–6", description: "السعة الافتراضية عند إنشاء مجموعة جديدة", min: 1, max: 30, unit: "طالب" },
    { key: "default_capacity_7_9", label: "الصفوف 7–9", description: "السعة الافتراضية عند إنشاء مجموعة جديدة", min: 1, max: 30, unit: "طالب" },
    { key: "default_capacity_10_12", label: "الصفوف 10–12", description: "السعة الافتراضية عند إنشاء مجموعة جديدة", min: 1, max: 30, unit: "طالب" },
  ],
  attendance: [
    { key: "attendance_lock_hours", label: "مهلة تعديل الحضور", description: "آخر موعد لتعديل تقرير الحضور بعد الجلسة", min: 1, max: 168, unit: "ساعة" },
  ],
  policies: [
    { key: "makeup_monthly_limit", label: "أرصدة التعويض الشهرية", description: "الحد الأعلى المسموح به لتعويض غياب الطالب", min: 0, max: 10, unit: "رصيد" },
    { key: "pause_min_days", label: "الحد الأدنى للتجميد", description: "يجب ألا يتجاوز الحد الأقصى", min: 7, max: 28, unit: "يوم" },
    { key: "pause_max_days", label: "الحد الأقصى للتجميد", description: "يجب ألا يقل عن الحد الأدنى", min: 7, max: 28, unit: "يوم" },
  ],
};

const TIME: { key: TimeKey; label: string; description: string }[] = [
  { key: "quiet_hours_start", label: "تبدأ ساعات الهدوء", description: "ساعة الرياض — نظام 24 ساعة" },
  { key: "quiet_hours_end", label: "تنتهي ساعات الهدوء", description: "ساعة الرياض — نظام 24 ساعة" },
];

function snapshotOf(value: Settings) {
  return JSON.stringify({ ...value, quiet_hours_start: value.quiet_hours_start.slice(0, 5), quiet_hours_end: value.quiet_hours_end.slice(0, 5) });
}

export default function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [values, setValues] = useState<Settings>(initial);
  const [baseline, setBaseline] = useState<Settings>(initial);
  const [active, setActive] = useState<SectionKey>("registration");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const dirty = snapshotOf(values) !== snapshotOf(baseline);
  const selected = SECTIONS.find((x) => x.key === active)!;

  const matches = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("ar");
    if (!q) return SECTIONS;
    return SECTIONS.filter((s) => [
      s.name, s.subtitle, ...(NUMERIC[s.key] ?? []).flatMap((d) => [d.label, d.description]),
      ...(s.key === "registration" ? ["فتح التسجيل", "إيقاف التسجيل"] : []),
      ...(s.key === "messaging" ? TIME.map((d) => d.label) : []),
    ].some((t) => t.toLocaleLowerCase("ar").includes(q)));
  }, [search]);

  function change<K extends keyof Settings>(key: K, value: Settings[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSuccess(false);
    setError(null);
  }

  function validate(): string | null {
    for (const fields of Object.values(NUMERIC)) for (const field of fields ?? []) {
      const n = values[field.key];
      if (!Number.isInteger(n) || n < field.min || n > field.max) return `راجع «${field.label}»: المسموح ${field.min}–${field.max} ${field.unit}.`;
    }
    if (values.pause_min_days > values.pause_max_days) return "مدة التجميد الدنيا لا يمكن أن تتجاوز القصوى.";
    for (const field of TIME) {
      if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(values[field.key].slice(0, 5))) return `وقت ${field.label} غير صحيح.`;
    }
    return null;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !dirty) return;
    const invalid = validate();
    if (invalid) { setError(invalid); return; }
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        // Save only changed fields. The server merges with its latest settings so
        // editing one section won't overwrite unrelated changes from another admin.
        body: JSON.stringify({
          ...(values.makeup_monthly_limit !== baseline.makeup_monthly_limit ? { makeupMonthlyLimit: values.makeup_monthly_limit } : {}),
          ...(values.pause_min_days !== baseline.pause_min_days ? { pauseMinDays: values.pause_min_days } : {}),
          ...(values.pause_max_days !== baseline.pause_max_days ? { pauseMaxDays: values.pause_max_days } : {}),
          ...(values.quiet_hours_start.slice(0, 5) !== baseline.quiet_hours_start.slice(0, 5) ? { quietHoursStart: values.quiet_hours_start.slice(0, 5) } : {}),
          ...(values.quiet_hours_end.slice(0, 5) !== baseline.quiet_hours_end.slice(0, 5) ? { quietHoursEnd: values.quiet_hours_end.slice(0, 5) } : {}),
          ...(values.registration_enabled !== baseline.registration_enabled ? { registrationEnabled: values.registration_enabled } : {}),
          ...(values.seat_hold_hours !== baseline.seat_hold_hours ? { seatHoldHours: values.seat_hold_hours } : {}),
          ...(values.attendance_lock_hours !== baseline.attendance_lock_hours ? { attendanceLockHours: values.attendance_lock_hours } : {}),
          ...(values.default_capacity_1_3 !== baseline.default_capacity_1_3 ? { defaultCapacity1_3: values.default_capacity_1_3 } : {}),
          ...(values.default_capacity_4_6 !== baseline.default_capacity_4_6 ? { defaultCapacity4_6: values.default_capacity_4_6 } : {}),
          ...(values.default_capacity_7_9 !== baseline.default_capacity_7_9 ? { defaultCapacity7_9: values.default_capacity_7_9 } : {}),
          ...(values.default_capacity_10_12 !== baseline.default_capacity_10_12 ? { defaultCapacity10_12: values.default_capacity_10_12 } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "تعذّر حفظ الإعدادات.");
      setBaseline({ ...values });
      setSuccess(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر حفظ الإعدادات. حاول مجددًا.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="kh-settings" onSubmit={save}>
      <aside className="kh-settings-menu" aria-label="أقسام إعدادات خُطى">
        <label className="kh-settings-search-label" htmlFor="kh-settings-search">البحث في الإعدادات</label>
        <input id="kh-settings-search" className="kh-settings-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن إعداد..." />
        <div className="kh-settings-section-list">
          {matches.map((section) => (
            <button key={section.key} type="button" className={`kh-settings-tab ${active === section.key ? "selected" : ""}`} onClick={() => setActive(section.key)} aria-current={active === section.key ? "page" : undefined}>
              <span className="kh-settings-tab-icon" aria-hidden="true">{section.icon}</span>
              <span className="kh-settings-tab-copy"><strong>{section.name}</strong><small>{section.subtitle}</small></span>
              <span aria-hidden="true" className="kh-settings-chevron">‹</span>
            </button>
          ))}
          {matches.length === 0 && <p className="kh-settings-muted">لا توجد إعدادات مطابقة للبحث.</p>}
        </div>
        <p className="kh-settings-tip">أي تغيير هنا يُحفَظ في قاعدة البيانات مع تسجيله في سجل العمليات.</p>
      </aside>

      <section className="kh-settings-panel" aria-label={selected.name}>
        <div className="kh-settings-panel-head">
          <div><span className="kh-settings-overline">إعدادات المنصة</span><h2>{selected.name}</h2><p>{selected.subtitle}</p></div>
          <span className="kh-settings-live">إعدادات قابلة للحفظ</span>
        </div>

        {active === "registration" && (
          <div className="kh-settings-card">
            <label className="kh-settings-item" htmlFor="kh-setting-registration">
              <span><strong>السماح بتقديم طلبات اشتراك جديدة</strong><small>إيقافه يمنع إنشاء طلب اشتراك جديد. لا يمنع إنشاء حساب ولي أمر أو يلغِي الطلبات السابقة.</small></span>
              <input id="kh-setting-registration" className="kh-settings-switch" type="checkbox" role="switch" checked={values.registration_enabled} onChange={(e) => change("registration_enabled", e.target.checked)} />
            </label>
          </div>
        )}

        {active !== "other" && (NUMERIC[active] ?? []).length > 0 && (
          <div className="kh-settings-card">
            {(NUMERIC[active] ?? []).map((field) => (
              <label className="kh-settings-item" key={field.key} htmlFor={field.key}>
                <span><strong>{field.label}</strong><small>{field.description}</small></span>
                <span className="kh-settings-value">
                  <input id={field.key} type="number" min={field.min} max={field.max} step={1} inputMode="numeric" value={values[field.key]} onChange={(e) => change(field.key, e.target.value === "" ? NaN : Number(e.target.value))} />
                  <small>{field.unit}</small>
                </span>
              </label>
            ))}
          </div>
        )}

        {active === "groups" && <p className="kh-settings-note">السعة الافتراضية (1–20) تسري عند إنشاء مجموعة جديدة فقط، ولا تغير سعة مجموعة موجودة. للتعديل افتح <Link href="/admin/groups">إدارة المجموعات</Link>.</p>}
        {active === "attendance" && <p className="kh-settings-note">هذه المهلة تحدد قبول تعديل تقرير الحضور من الخادم بعد الجلسة، ولا تعدّل التقارير السابقة تلقائيًا.</p>}

        {active === "messaging" && (
          <>
          <p className="kh-settings-note">يمكن لولي الأمر والمعلم إرسال الرسائل في أي وقت. خلال الفترة المحددة تظهر رسالة تنبه لاحتمال تأخر الرد، ولا تُمنع الرسائل أو رموز OTP أو تذكيرات الجلسات. لا توجد حاليًا خدمة إشعارات فورية يمكن كتمها من هنا.</p>
          <div className="kh-settings-card">
            {TIME.map((field) => (
              <label key={field.key} className="kh-settings-item" htmlFor={field.key}>
                <span><strong>{field.label}</strong><small>{field.description}</small></span>
                <input id={field.key} type="time" className="kh-settings-time" value={values[field.key].slice(0, 5)} onChange={(e) => change(field.key, e.target.value)} />
              </label>
            ))}
          </div>
          <p className="kh-settings-note">يُحتسب الوقت بتوقيت الرياض وبالدقيقة. إذا تساوى وقت البداية والنهاية فلن تكون هناك فترة هدوء.</p>
          </>
        )}

        {active === "other" && (
          <>
            <div className="kh-settings-card">
              <Link className="kh-settings-destination" href="/admin/admins"><span><strong>الإداريون والصلاحيات</strong><small>إدارة الأدوار وصلاحيات الفريق بطريقة محمية</small></span><span>‹</span></Link>
              <Link className="kh-settings-destination" href="/admin/groups"><span><strong>المجموعات والمعلمون</strong><small>الإسناد والجداول وروابط Teams والسعات الحالية</small></span><span>‹</span></Link>
              <Link className="kh-settings-destination" href="/admin/audit"><span><strong>سجل العمليات</strong><small>سجل التغييرات الإدارية الحساسة</small></span><span>‹</span></Link>
              <Link className="kh-settings-destination" href="/admin/payments"><span><strong>المدفوعات</strong><small>المدفوعات الإلكترونية متوقفة؛ لا يتم تشغيلها من هذه الصفحة</small></span><span>‹</span></Link>
            </div>
            <p className="kh-settings-note">بريد الدعم العام، مدة الجلسة الافتراضية، ونافذة الحجز غير مرتبطة حتى الآن بوظائف تشغيلية كاملة؛ لذلك لا تظهر كمفاتيح تحرير وهمية.</p>
          </>
        )}

        {active !== "other" && <p className="kh-settings-note">التعديل على بيئة Staging الحالية. قد يستغرق تطبيق بعض القيم التشغيلية دقيقة بسبب ذاكرة التخزين المؤقت.</p>}

        <div className="kh-settings-actions" aria-live="polite">
          <span className="kh-settings-state">{dirty ? "لديك تغييرات لم تُحفَظ" : success ? "تم حفظ إعداداتك بنجاح" : "لم تُجرَ تعديلات جديدة"}</span>
          {dirty && <button type="button" className="btn outline small" disabled={loading} onClick={() => { setValues({ ...baseline }); setError(null); setSuccess(false); }}>تراجع عن التغييرات</button>}
          <button type="submit" className="btn small" disabled={!dirty || loading}>{loading ? "جارٍ الحفظ..." : "حفظ التعديلات"}</button>
        </div>
        {error && <p className="kh-settings-error" role="alert">{error}</p>}
        {success && <p className="kh-settings-success" role="status">تم تحديث الإعدادات من خلال المسار الإداري المعتمد.</p>}
      </section>
    </form>
  );
}
