import AdminShell from "@/components/AdminShell";
import CycleManager from "./CycleManager";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export default async function AdminCyclesPage() {
  const admin = await getAdminIdentity("cohort.manage");
  if (!admin) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;

  const client = createSupabaseAdminClient();
  const [{ data: cycles }, { data: cohorts }] = await Promise.all([
    client.from("cycles").select("id, name, start_date, end_date, registration_start, registration_end, enabled_grade_bands, status").order("start_date", { ascending: false }),
    client.from("cohorts").select("id, title, cycle_id, status, capacity").not("cycle_id", "is", null),
  ]);

  return (
    <AdminShell adminName={admin.full_name}>
      <div className="admin-page-head"><h1>الدورات</h1></div>
      <p style={{ color: "var(--gray)", marginBottom: 20 }}>إدارة دورة التشغيل ومتابعة مجموعاتها وحالتها قبل الإغلاق.</p>
      <CycleManager initialCycles={cycles ?? []} initialCohorts={cohorts ?? []} />
    </AdminShell>
  );
}
