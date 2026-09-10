import Link from "next/link";
import Shell from "@/components/Shell";
import MessageThread from "@/components/MessageThread";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { authorizeMessageThreadAccess } from "@/lib/messaging-authorization";

export default async function P({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <Link className="btn" href="/login">تسجيل الدخول ←</Link>
          </div>
        </main>
      </Shell>
    );
  }

  // RLS (threads_of_parent) تمنع أصلًا أي محادثة لا تخصه من الوصول لهذا الاستعلام
  const { data: thread } = await supabase
    .from("message_threads")
    .select("id, child_id, teacher_user_id")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <p className="lead">هذه المحادثة غير متاحة.</p>
            <Link className="btn outline" href="/parent/messages">← الرسائل</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const { data: teacher } = await supabase.from("teachers").select("full_name").eq("user_id", thread.teacher_user_id).maybeSingle();
  const { data: child } = await supabase.from("children").select("first_name").eq("id", thread.child_id).maybeSingle();

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_role, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  const auth = await authorizeMessageThreadAccess(user.id, threadId);
  const canWrite = auth.ok && auth.canWrite;

  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <Link href="/parent/messages" style={{ color: "var(--t)", fontWeight: 800 }}>← كل الرسائل</Link>
          <p style={{ color: "var(--gray)", margin: "8px 0 16px" }}>بخصوص: {child?.first_name}</p>
          <MessageThread
            threadId={threadId}
            currentRole="parent"
            otherPartyLabel={teacher?.full_name ?? "المعلم"}
            canWrite={canWrite}
            initialMessages={(messages ?? []).map((m) => ({
              id: m.id,
              senderRole: m.sender_role as "parent" | "teacher",
              body: m.body,
              createdAt: m.created_at,
            }))}
          />
        </div>
      </main>
    </Shell>
  );
}
