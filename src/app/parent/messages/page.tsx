import Link from "next/link";
import Shell from "@/components/Shell";
import StartThreadButton from "./StartThreadButton";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function P() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <span className="badge">تسجيل الدخول مطلوب</span>
            <Link className="btn" href="/login">تسجيل الدخول ←</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const { data: threads } = await supabase
    .from("message_threads")
    .select("id, child_id, teacher_user_id, cohort_id, updated_at")
    .order("updated_at", { ascending: false });

  const childIds = [...new Set((threads ?? []).map((t) => t.child_id))];
  const teacherUserIds = [...new Set((threads ?? []).map((t) => t.teacher_user_id))];

  const { data: children } = childIds.length
    ? await supabase.from("children").select("id, first_name, parent_id").in("id", childIds)
    : { data: [] };
  const { data: teachers } = teacherUserIds.length
    ? await supabase.from("teachers").select("user_id, full_name").in("user_id", teacherUserIds)
    : { data: [] };

  const childName = new Map((children ?? []).map((c) => [c.id, c.first_name]));
  const teacherName = new Map((teachers ?? []).map((t) => [t.user_id, t.full_name]));

  const threadIds = (threads ?? []).map((t) => t.id);
  const { data: allMessages } = threadIds.length
    ? await supabase.from("messages").select("thread_id, body, sender_user_id, read_at, created_at").in("thread_id", threadIds).order("created_at", { ascending: false })
    : { data: [] };

  const lastMessageByThread = new Map<string, { body: string; createdAt: string }>();
  const unreadByThread = new Map<string, number>();
  for (const m of allMessages ?? []) {
    if (!lastMessageByThread.has(m.thread_id)) lastMessageByThread.set(m.thread_id, { body: m.body, createdAt: m.created_at });
    if (m.sender_user_id !== user.id && !m.read_at) {
      unreadByThread.set(m.thread_id, (unreadByThread.get(m.thread_id) ?? 0) + 1);
    }
  }

  // فرص بدء محادثة جديدة: أبناء لديهم اشتراك فعّال بمعلم لا توجد معه محادثة بعد
  const { data: parent } = await supabase.from("parents").select("id").eq("user_id", user.id).maybeSingle();
  const { data: myChildren } = parent ? await supabase.from("children").select("id, first_name").eq("parent_id", parent.id) : { data: [] };
  const myChildIds = (myChildren ?? []).map((c) => c.id);

  const { data: activeSubs } = myChildIds.length
    ? await supabase.from("subscriptions").select("child_id, cohort_id, cohorts(title)").in("child_id", myChildIds).eq("status", "active")
    : { data: [] };

  const existingThreadCohorts = new Set((threads ?? []).map((t) => t.cohort_id));
  const startable = (activeSubs ?? []).filter((s) => s.cohort_id && !existingThreadCohorts.has(s.cohort_id));

  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">لوحة ولي الأمر</span>
          <h1 className="title" style={{ fontSize: 34 }}>الرسائل</h1>
          <p className="lead">تواصل مباشر مع معلم طفلك داخل خُطى.</p>

          {startable.length > 0 && (
            <div className="dashcard" style={{ marginBottom: 20 }}>
              <b>بدء محادثة جديدة</b>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                {startable.map((s: any, i) => (
                  <StartThreadButton key={i} childId={s.child_id} cohortId={s.cohort_id} label={s.cohorts?.title ?? "البرنامج"} />
                ))}
              </div>
            </div>
          )}

          {(!threads || threads.length === 0) && (
            <div className="student-empty">
              <span className="icon">💬</span>
              <p>لا توجد محادثات بعد.</p>
            </div>
          )}

          {(threads ?? []).map((t) => {
            const unread = unreadByThread.get(t.id) ?? 0;
            const last = lastMessageByThread.get(t.id);
            return (
              <Link href={`/parent/messages/${t.id}`} key={t.id} className={`thread-list-item${unread > 0 ? " unread" : ""}`}>
                <div>
                  <b>{teacherName.get(t.teacher_user_id) ?? "المعلم"}</b>
                  <p className="thread-meta">
                    {childName.get(t.child_id)} {last ? `• ${last.body.slice(0, 40)}` : ""}
                  </p>
                </div>
                {unread > 0 && <span className="unread-dot" />}
              </Link>
            );
          })}
        </div>
      </main>
    </Shell>
  );
}
