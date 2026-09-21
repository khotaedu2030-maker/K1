import AdminShell from "@/components/AdminShell";
import SubstituteTeacherControl from "./SubstituteTeacherControl";
import { getAdminIdentity } from "@/lib/admin-identity";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export default async function AdminSessionsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const admin = await getAdminIdentity("session.manage");
  if (!admin) return <div className="placeholder-page"><div className="narrow"><span className="badge">غير مصرَّح</span></div></div>;

  const params = await searchParams;
  const range = params.range ?? "today";
  const today = new Date().toISOString().slice(0, 10);

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("sessions")
    .select("id, session_date, starts_at, ends_at, status, teacher_id, cohorts(title, teacher_id), teachers(full_name)")
    .order("starts_at", { ascending: range !== "past" });

  if (range === "today") query = query.eq("session_date", today);
  else if (range === "upcoming") query = query.gte("session_date", today);
  else if (range === "past") query = query.lt("session_date", today);

  const { data: sessions } = await query.limit(100);
  const { data: activeTeachers } = await supabase.from("teachers").select("id, full_name").eq("active", true);

  const cohortPrimaryTeacherIds = Array.from(new Set((sessions ?? []).map((s: any) => s.cohorts?.teacher_id).filter(Boolean)));
  const { data: primaryTeachers } = cohortPrimaryTeacherIds.length
    ? await supabase.from("teachers").select("id, full_name").in("id", cohortPrimaryTeacherIds)
    : { data: [] };
  const primaryTeacherName = new Map((primaryTeachers ?? []).map((t: { id: string; full_name: string }) => [t.id, t.full_name]));

  const STATUS_LABELS: Record<string, string> = { scheduled: "مجدولة", completed: "مكتملة", cancelled: "ملغاة" };

  return (
    <AdminShell adminName={admin.full_name}>
      <div className="admin-page-head">
        <h1>الجلسات</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {[["today", "اليوم"], ["upcoming", "القادمة"], ["past", "السابقة"]].map(([v, l]) => (
            <a key={v} href={`/admin/sessions?range=${v}`} className={`btn small${range === v ? "" : " outline"}`}>{l}</a>
          ))}
        </div>
      </div>

      {(sessions ?? []).length === 0 ? (
        <p className="admin-empty-state">لا توجد جلسات في هذا النطاق.</p>
      ) : (
        <table className="admin-table">
          <thead><tr><th>التاريخ</th><th>الوقت</th><th>المجموعة</th><th>المعلم</th><th>الحالة</th><th></th></tr></thead>
          <tbody>
            {(sessions ?? []).map((s: any) => {
              const primaryId = s.cohorts?.teacher_id;
              const isSubstitute = primaryId && s.teacher_id && primaryId !== s.teacher_id;
              const canOverride = s.status === "scheduled" && new Date(s.starts_at) > new Date();
              return (
                <tr key={s.id}>
                  <td>{new Date(s.session_date).toLocaleDateString("ar-SA")}</td>
                  <td>{s.starts_at ? new Date(s.starts_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td>{s.cohorts?.title ?? "—"}</td>
                  <td>
                    {s.teachers?.full_name ?? "—"}
                    {isSubstitute && (
                      <div style={{ fontSize: 12, color: "var(--p)", fontWeight: 700 }}>
                        بديل (الأساسي: {primaryTeacherName.get(primaryId) ?? "—"})
                      </div>
                    )}
                  </td>
                  <td>{STATUS_LABELS[s.status] ?? s.status}</td>
                  <td>{canOverride && <SubstituteTeacherControl sessionId={s.id} teachers={activeTeachers ?? []} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}
