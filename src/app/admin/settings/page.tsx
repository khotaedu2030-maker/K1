import AdminShell from "@/components/AdminShell";
import SettingsForm from "./SettingsForm";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// The settings page only exposes fields with real operational consumers.
// Commercial gateway flags and secrets are deliberately not editable here.
export default async function AdminSettingsPage() {
  const identity = await getAdminIdentity("settings.manage");
  if (!identity) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;

  const supabase = createSupabaseAdminClient();
  const { data: settings, error } = await supabase.from("admin_platform_settings")
    .select("makeup_monthly_limit, pause_min_days, pause_max_days, quiet_hours_start, quiet_hours_end, registration_enabled, seat_hold_hours, attendance_lock_hours, default_capacity_1_3, default_capacity_4_6, default_capacity_7_9, default_capacity_10_12")
    .eq("id", true)
    .maybeSingle();

  return (
    <AdminShell adminName={identity.full_name} role={identity.role}>
      <div className="admin-page-head">
        <div>
          <h1>الإعدادات</h1>
          <p style={{ fontSize: 13, color: "var(--gray)", marginTop: 7 }}>
            تحكّم في إعدادات خُطى التشغيلية من مكان واحد، مع حفظ حقيقي وتدقيق لكل تغيير.
          </p>
        </div>
      </div>
      {error ? (
        <div className="admin-unavailable" role="alert">
          <b>تعذّر تحميل إعدادات المنصة</b>
          <p>لم نعرض بيانات افتراضية على أنها إعدادات محفوظة. راجع الاتصال بقاعدة الاختبار وأعد المحاولة.</p>
        </div>
      ) : !settings ? (
        <div className="admin-unavailable" role="alert">
          <b>التهيئة الأولية مطلوبة</b>
          <p>جدول الإعدادات موجود، لكن سجل الإعدادات الرئيسي غير موجود. يلزم تهيئته من خلال الإدارة الفنية أولًا.</p>
        </div>
      ) : (
        <SettingsForm initial={settings} />
      )}
    </AdminShell>
  );
}
