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

  const { data: thread } = await supabase
    .from("message_threads")
    .select("id, child_id")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <p className="lead">هذه المحادثة غير متاحة.</p>
            <Link className="btn outline" href="/teacher/messages">← الرسائل</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const { data: child } = await supabase.from("children").select("first_name, grade").eq("id", thread.child_id).maybeSingle();

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
          <Link href="/teacher/messages" style={{ color: "var(--t)", fontWeight: 800 }}>← كل الرسائل</Link>
          <p style={{ color: "var(--gray)", margin: "8px 0 16px" }}>
            ولي أمر {child?.first_name} — الصف {child?.grade}
          </p>
          <MessageThread
            threadId={threadId}
            currentRole="teacher"
            otherPartyLabel={`ولي أمر ${child?.first_name ?? "الطالب"}`}
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
