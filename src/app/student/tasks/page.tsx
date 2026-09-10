import { redirect } from "next/navigation";
import StudentShell from "@/components/StudentShell";
import TaskList from "./TaskList";
import { getActiveStudentSession } from "@/lib/student-mode";
import { getToneLevel } from "@/lib/grade-config";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export default async function P() {
  const session = await getActiveStudentSession();
  if (!session) redirect("/student");

  const admin = createSupabaseAdminClient();
  const { data: tasks } = await admin
    .from("daily_tasks")
    .select("id, title, status")
    .eq("child_id", session.childId)
    .neq("status", "needs_review")
    .order("created_at", { ascending: false })
    .limit(20);

  const tone = getToneLevel(session.grade);
  const junior = tone === "junior";

  return (
    <StudentShell firstName={session.firstName} grade={session.grade}>
      <h1 className="title" style={{ fontSize: junior ? 26 : 22, marginBottom: 16 }}>
        مهامي
      </h1>
      <TaskList initialTasks={tasks ?? []} junior={junior} />
    </StudentShell>
  );
}
