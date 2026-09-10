import Link from "next/link";
import Shell from "@/components/Shell";
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

  // RLS (threads_of_teacher) تعرض فقط محادثات طلابه — لا بحث حر عن أي أسرة أخرى
  const { data: threads } = await supabase
    .from("message_threads")
    .select("id, child_id, cohort_id, updated_at")
    .order("updated_at", { ascending: false });

  const childIds = [...new Set((threads ?? []).map((t) => t.child_id))];
  const { data: children } = childIds.length
    ? await supabase.from("children").select("id, first_name, grade").in("id", childIds)
    : { data: [] };
  const childInfo = new Map((children ?? []).map((c) => [c.id, c]));

  const threadIds = (threads ?? []).map((t) => t.id);
  const { data: allMessages } = threadIds.length
    ? await supabase.from("messages").select("thread_id, body, sender_user_id, read_at, created_at").in("thread_id", threadIds).order("created_at", { ascending: false })
    : { data: [] };

  const lastMessageByThread = new Map<string, string>();
  const unreadByThread = new Map<string, number>();
  for (const m of allMessages ?? []) {
    if (!lastMessageByThread.has(m.thread_id)) lastMessageByThread.set(m.thread_id, m.body);
    if (m.sender_user_id !== user.id && !m.read_at) {
      unreadByThread.set(m.thread_id, (unreadByThread.get(m.thread_id) ?? 0) + 1);
    }
  }

  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">لوحة المعلم</span>
          <h1 className="title" style={{ fontSize: 34 }}>الرسائل</h1>
          <p className="lead">محادثات أولياء أمور طلابك الحاليين فقط.</p>

          {(!threads || threads.length === 0) && (
            <div className="student-empty">
              <span className="icon">💬</span>
              <p>لا توجد محادثات بعد.</p>
            </div>
          )}

          {(threads ?? []).map((t) => {
            const child = childInfo.get(t.child_id);
            const unread = unreadByThread.get(t.id) ?? 0;
            return (
              <Link href={`/teacher/messages/${t.id}`} key={t.id} className={`thread-list-item${unread > 0 ? " unread" : ""}`}>
                <div>
                  <b>ولي أمر {child?.first_name ?? "الطالب"}</b>
                  <p className="thread-meta">
                    الصف {child?.grade} {lastMessageByThread.get(t.id) ? `• ${lastMessageByThread.get(t.id)!.slice(0, 40)}` : ""}
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
