import Shell from "@/components/Shell";
import StatusSelect from "./StatusSelect";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export default async function P() {
  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  const { data: adminRow } = user
    ? await authed.from("admins").select("id").eq("user_id", user.id).maybeSingle()
    : { data: null };

  if (!adminRow) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <span className="badge">غير مصرَّح</span>
            <h1 className="title" style={{ fontSize: 30, marginTop: 16 }}>هذه الصفحة لفريق خُطى فقط</h1>
          </div>
        </main>
      </Shell>
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: applications } = await admin
    .from("teacher_applications")
    .select("id, full_name, email, phone, specialization, years_experience, cv_url, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <Shell>
      <main className="section">
        <div className="container">
          <span className="eyebrow">لوحة الإدارة</span>
          <h1 className="title" style={{ fontSize: 30 }}>طلبات الانضمام كمعلم</h1>

          <div style={{ overflowX: "auto", marginTop: 24 }}>
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
                  </tr>
                ))}
              </tbody>
            </table>
            {(applications ?? []).length === 0 && <p style={{ color: "var(--gray)", marginTop: 16 }}>لا توجد طلبات بعد.</p>}
          </div>
        </div>
      </main>
    </Shell>
  );
}
