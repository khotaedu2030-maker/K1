import AdminShell from "@/components/AdminShell";
import SettingsForm from "./SettingsForm";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export default async function AdminSettingsPage() {
  const admin = await getAdminIdentity();
  if (!admin) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;

  const supabase = createSupabaseAdminClient();
  const { data: settings } = await supabase
    .from("platform_settings")
    .select("makeup_monthly_limit, pause_max_days, quiet_hours_start, quiet_hours_end")
    .eq("id", true)
    .maybeSingle();

  return (
    <AdminShell adminName={admin.full_name}>
      <div className="admin-page-head">
        <h1>الإعدادات</h1>
      </div>
      <p style={{ color: "var(--gray)", fontSize: 13, marginBottom: 16 }}>
        الحقول المعروضة هنا فقط تتحكم فعليًا بسلوك تشغيلي حقيقي (تحققتُ من كل واحد بالكود
        مباشرة) — لا إعداد هنا يعطي انطباعًا بتحكُّم لا يطبّقه النظام فعليًا. أي تغيير يُسجَّل
        بسجل العمليات.
      </p>

      {settings ? (
        <SettingsForm initial={settings} />
      ) : (
        <div className="admin-unavailable">
          <span className="badge">Migration غير مُطبَّقة بعد</span>
          <p style={{ marginTop: 8 }}>
            جدول <code>platform_settings</code> غير موجود بعد — النظام يعمل حاليًا بالقيم
            الافتراضية المطابقة للسلوك الحالي (تجميد 7 أيام، تعويض شهري 2، هدوء 8م-8ص). طبّق
            migration <code>20260917_platform_settings.sql</code> لتفعيل هذه الصفحة.
          </p>
        </div>
      )}

      <div className="admin-unavailable" style={{ marginTop: 20 }}>
        <span className="badge">مخفية عمدًا من الإدارة</span>
        <p style={{ marginTop: 8, fontSize: 13 }}>
          <code>pause_min_days</code>، <code>booking_window_days</code>،
          <code>default_session_duration_minutes</code>، <code>support_email</code>،
          <code>support_phone</code> — تحققتُ من الكود: لا يستهلكها أي منطق تشغيلي فعلي حاليًا
          (لا مفهوم "حد أدنى للتجميد"، لا ميزة حجز، الجلسات تأخذ توقيتها من جدول كل مجموعة لا من
          مدة عامة، وبريد/جوال الدعم مصدرهما الفعلي حاليًا <code>legal-profile.ts</code> لا هذا
          الجدول). إظهارها هنا كان سيعطي انطباعًا خاطئًا بالتحكم — تبقى بالـschema لاستخدام لاحق
          حين يُبنى المنطق الفعلي المقابل لها.
        </p>
      </div>
    </AdminShell>
  );
}
