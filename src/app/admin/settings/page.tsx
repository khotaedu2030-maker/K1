import AdminShell from "@/components/AdminShell";
import SettingsForm from "./SettingsForm";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// Phase 8.5/8.6 — تصنيف كل إعداد ACTIVE (يستهلكه منطق تشغيلي فعلي حقيقي الآن) أو FOUNDATION
// (مخزَّن لكن بلا مستهلك بعد). راجَعت كل استخدام فعلي بالكود قبل هذا الجدول — لا تصنيف افتراضي.
const SETTING_CLASSIFICATION: { key: string; label: string; status: "ACTIVE" | "FOUNDATION"; consumer: string }[] = [
  { key: "makeup_monthly_limit", label: "الحد الشهري لأرصدة التعويض", status: "ACTIVE", consumer: "admin_issue_makeup_credit_atomic (RPC) + issueMakeupCreditIfEligible (src/lib/makeup-credits.ts)" },
  { key: "pause_min_days", label: "أدنى مدة تجميد", status: "ACTIVE", consumer: "admin_create_subscription_pause_atomic (RPC) — Phase 6" },
  { key: "pause_max_days", label: "أقصى مدة تجميد", status: "ACTIVE", consumer: "admin_create_subscription_pause_atomic (RPC) — منذ Phase 1 Correction" },
  { key: "quiet_hours_start/end", label: "ساعات الهدوء (تقييد الرسائل)", status: "ACTIVE", consumer: "src/lib/messaging-config.ts عبر getRuntimeSettings()" },
  { key: "registration_enabled", label: "التسجيل مفعَّل", status: "ACTIVE", consumer: "src/app/api/enroll/route.ts (يرفض التسجيل الجديد إن كان false)" },
  { key: "seat_hold_hours", label: "مدة حجز المقعد المؤقت", status: "ACTIVE", consumer: "enroll_subscription_atomic (RPC) — Phase 3" },
  { key: "attendance_lock_hours", label: "مهلة قفل تعديل الحضور", status: "ACTIVE", consumer: "src/app/api/session-report/submit/route.ts — Phase 3" },
  { key: "default_capacity_1_3/4_6/7_9/10_12", label: "السعات الافتراضية حسب المرحلة", status: "ACTIVE", consumer: "src/app/api/admin/cohorts/route.ts — قيمة افتراضية عند عدم إرسال capacity صراحةً؛ لا رجعية على مجموعات موجودة (Phase 9 correction)" },
  { key: "booking_window_days", label: "نافذة الحجز (أيام)", status: "FOUNDATION", consumer: "لا مفهوم \"نافذة حجز\" مطبَّق بالمنتج الحالي إطلاقًا" },
  { key: "default_session_duration_minutes", label: "مدة الجلسة الافتراضية", status: "FOUNDATION", consumer: "الجلسات تأخذ توقيتها من starts_at/ends_at بجدول كل مجموعة، لا من مدة عامة" },
  { key: "support_email/phone", label: "بريد/جوال الدعم", status: "FOUNDATION", consumer: "المصدر الفعلي الحالي لا يزال src/lib/legal-profile.ts، لا هذا الجدول" },
];

export default async function AdminSettingsPage() {
  const admin = await getAdminIdentity();
  if (!admin) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;

  // Phase 9 Step 9.2A production reconciliation — reads admin_platform_settings, not
  // platform_settings (a pre-existing, unrelated Production table with a key/value shape;
  // left untouched — see supabase/migrations/20261002_phase9_production_reconciliation.sql).
  const supabase = createSupabaseAdminClient();
  const { data: settings } = await supabase
    .from("admin_platform_settings")
    .select("makeup_monthly_limit, pause_min_days, pause_max_days, quiet_hours_start, quiet_hours_end, registration_enabled, seat_hold_hours, attendance_lock_hours, default_capacity_1_3, default_capacity_4_6, default_capacity_7_9, default_capacity_10_12")
    .eq("id", true)
    .maybeSingle();

  return (
    <AdminShell adminName={admin.full_name}>
      <div className="admin-page-head">
        <h1>الإعدادات</h1>
      </div>
      <p style={{ color: "var(--gray)", fontSize: 13, marginBottom: 16 }}>
        الحقول المعروضة بالنموذج أدناه محدَّدة الحدود ومُتحقَّق منها خادميًا. أي تغيير يُسجَّل بسجل العمليات (settings_update).
      </p>

      {settings ? (
        <SettingsForm initial={settings} />
      ) : (
        <div className="admin-unavailable">
          <span className="badge">Migration غير مُطبَّقة بعد</span>
          <p style={{ marginTop: 8 }}>
            جدول <code>admin_platform_settings</code> غير موجود بعد — النظام يعمل حاليًا بالقيم
            الافتراضية المطابقة للسلوك الحالي (تجميد 7 أيام، تعويض شهري 2، هدوء 8م-8ص). طبّق
            migration <code>20261002_phase9_production_reconciliation.sql</code> لتفعيل هذه الصفحة.
          </p>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <b style={{ display: "block", marginBottom: 10, fontSize: 15 }}>تصنيف الإعدادات (Phase 8.6)</b>
        <p style={{ color: "var(--gray)", fontSize: 12, marginBottom: 10 }}>
          ACTIVE = يستهلكه منطق تشغيلي فعلي حقيقي الآن. FOUNDATION = مخزَّن بالجدول لكن لا مستهلك فعلي بعد — تعديله الآن لن يغيّر أي سلوك.
        </p>
        <table className="admin-table">
          <thead><tr><th>الإعداد</th><th>التصنيف</th><th>المستهلك الفعلي</th></tr></thead>
          <tbody>
            {SETTING_CLASSIFICATION.map((s) => (
              <tr key={s.key}>
                <td>{s.label} <code style={{ fontSize: 11, color: "var(--gray)" }}>({s.key})</code></td>
                <td>
                  <span className="badge" style={{ color: s.status === "ACTIVE" ? "#1f9d55" : "var(--gray)" }}>{s.status}</span>
                </td>
                <td style={{ fontSize: 12 }}>{s.consumer}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
