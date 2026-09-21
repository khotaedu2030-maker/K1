import AdminShell from "@/components/AdminShell";
import StatusSelect from "./StatusSelect";
import ActivateTeacherButton from "./ActivateTeacherButton";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export default async function P() {
  const adminIdentity = await getAdminIdentity();

  if (!adminIdentity) {
    return (
      <div className="placeholder-page">
        <div className="narrow">
          <span className="badge">غير مصرَّح</span>
          <h1 className="title" style={{ fontSize: 30, marginTop: 16 }}>هذه الصفحة لفريق خُطى فقط</h1>
        </div>
      </div>
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: applications } = await admin
    .from("teacher_applications")
    .select("id, full_name, email, phone, specialization, years_experience, cv_url, status, created_at")
    .order("created_at", { ascending: false });
  const applicationIds = (applications ?? []).map((application) => application.id);
  const { data: linkedTeachers } = applicationIds.length
    ? await admin.from("teachers").select("application_id").in("application_id", applicationIds)
    : { data: [] as { application_id: string | null }[] };
  const activatedApplicationIds = new Set((linkedTeachers ?? []).map((teacher) => teacher.application_id).filter(Boolean));

  return (
    <AdminShell adminName={adminIdentity.full_name}>
      <div className="admin-page-head">
        <h1>طلبات الانضمام كمعلم</h1>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>البريد</th>
              <th>الجوال</th>
              <th>التخصص</th>
              <th>الخبرة</th>
              <th>السيرة</th>
              <th>التاريخ</th>
              <th>الحالة</th>
              <th>تفعيل المعلم</th>
            </tr>
          </thead>
          <tbody>
            {(applications ?? []).map((a: { id: string; full_name: string; email: string; phone: string; specialization: string; years_experience: number | null; cv_url: string | null; status: string; created_at: string }) => (
              <tr key={a.id}>
                <td>{a.full_name}</td>
                <td dir="ltr">{a.email}</td>
                <td dir="ltr">{a.phone}</td>
                <td>{a.specialization}</td>
                <td>{a.years_experience ?? "—"}</td>
                <td>{a.cv_url ? <a href={a.cv_url} target="_blank" rel="noreferrer">رابط</a> : "—"}</td>
                <td>{new Date(a.created_at).toLocaleDateString("ar-SA")}</td>
                <td><StatusSelect applicationId={a.id} currentStatus={a.status} /></td>
                <td>{a.status === "accepted" ? <ActivateTeacherButton applicationId={a.id} alreadyActivated={activatedApplicationIds.has(a.id)} /> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(applications ?? []).length === 0 && <p className="admin-empty-state" style={{ marginTop: 16 }}>لا توجد طلبات بعد.</p>}
      </div>
    </AdminShell>
  );
}
