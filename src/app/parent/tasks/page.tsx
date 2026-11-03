import Link from "next/link";
import Shell from "@/components/Shell";
import ParentChildTabs from "@/components/ParentChildTabs";
import { resolveParentContext } from "@/lib/pilot-parent";
import { resolveOwnedChild } from "@/lib/parent-child-selection";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { summarizeParentTasks, type ParentTask } from "@/lib/parent-task-summary";
import { getRiyadhCalendarDate, formatRiyadhCalendarDate } from "@/lib/riyadh-time";

function TaskSection({
  heading, items, tone, today,
}: {
  heading: string;
  items: ParentTask[];
  tone: "pending" | "done" | "needs_review";
  today: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="dashcard" style={{ marginTop: 18 }} aria-label={heading}>
      <h2 style={{ fontSize: 19, margin: 0 }}>{heading} ({items.length})</h2>
      {items.map((task) => {
        const overdue = tone === "pending" && task.due_date !== null && task.due_date < today;
        return (
          <div className="taskline" key={task.id}>
            <span className={tone === "done" ? "ok" : "warn"} aria-hidden="true">{tone === "done" ? "✓" : "△"}</span>
            <div style={{ flex: 1 }}>
              <b>{task.title}</b>
              {task.subject && <p style={{ color: "var(--gray)", margin: "4px 0 0", fontSize: 13 }}>المادة: {task.subject}</p>}
              {task.due_date && <p style={{ color: overdue ? "var(--p)" : "var(--gray)", margin: "4px 0 0", fontSize: 13 }}>
                {overdue ? "متأخرة منذ: " : "تاريخ الاستحقاق: "}{task.due_date}
              </p>}
              {tone === "needs_review" && <p style={{ color: "var(--gray)", margin: "4px 0 0", fontSize: 13 }}>بانتظار مراجعة المعلم، وليس مطلوبًا تغييرها من ولي الأمر.</p>}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export default async function ParentTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const context = await resolveParentContext();
  if (!context) {
    return (
      <Shell>
        <main className="placeholder-page">
          <div className="narrow">
            <span className="badge">تسجيل الدخول مطلوب</span>
            <h1 className="title" style={{ fontSize: 32 }}>مهام الأبناء</h1>
            <Link className="btn" href="/login">تسجيل الدخول ←</Link>
          </div>
        </main>
      </Shell>
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: children, error: childError } = await admin.from("children")
    .select("id, first_name").eq("parent_id", context.parentId).order("first_name");
  const chosen = resolveOwnedChild(children ?? [], (await searchParams).child);

  let tasks: ParentTask[] = [];
  let taskError = false;
  if (chosen && !childError) {
    const result = await admin.from("daily_tasks")
      .select("id, title, subject, status, due_date, created_at")
      .eq("child_id", chosen.id)
      .order("created_at", { ascending: false }).limit(100);
    taskError = Boolean(result.error);
    tasks = (result.data ?? []) as ParentTask[];
  }

  const today = formatRiyadhCalendarDate(getRiyadhCalendarDate(new Date()));
  const summary = summarizeParentTasks(tasks, today);

  return (
    <Shell>
      <main className="section">
        <div className="narrow">
          <span className="eyebrow">لوحة ولي الأمر</span>
          <h1 className="title" style={{ fontSize: 34 }}>مهام الأبناء</h1>
          <p className="lead">اطّلع على ما بقي من مهام طفلك وما أنجزه، دون تغيير حالتها.</p>
          <Link className="btn small outline" href="/parent">← لوحة ولي الأمر</Link>
          {!childError && (children ?? []).length > 1 && (
            <ParentChildTabs options={children ?? []} selectedId={chosen?.id ?? null} basePath="/parent/tasks" />
          )}
          {childError ? (
            <p className="lead">تعذّر تحميل الأبناء. أعد المحاولة.</p>
          ) : !chosen ? (
            <div className="dashcard" style={{ marginTop: 18 }}>
              <p>{(children ?? []).length ? "الطفل المطلوب غير مرتبط بحسابك." : "لا يوجد أبناء مسجّلون بعد."}</p>
            </div>
          ) : taskError ? (
            <p className="lead">تعذّر تحميل المهام الآن. أعد المحاولة.</p>
          ) : (
            <>
              <h2 style={{ fontSize: 21, marginTop: 24 }}>متابعة مهام {chosen.first_name}</h2>
              <div className="dashcard" style={{ marginTop: 12 }}>
                <div className="taskline"><span>قيد الإنجاز</span><b>{summary.pending.length}</b></div>
                <div className="taskline"><span>بانتظار مراجعة المعلم</span><b>{summary.needsReview.length}</b></div>
                <div className="taskline"><span>منجزة</span><b>{summary.done.length}</b></div>
                <div className="taskline"><span>متأخرة عن الاستحقاق</span><b>{summary.overdueCount}</b></div>
              </div>
              {tasks.length === 0 ? (
                <div className="dashcard" style={{ marginTop: 18 }}>
                  <p>لم تُسجّل مهام لهذا الطفل بعد.</p>
                </div>
              ) : (
                <>
                  <TaskSection heading="المهام قيد الإنجاز" items={summary.pending} tone="pending" today={today} />
                  <TaskSection heading="بانتظار مراجعة المعلم" items={summary.needsReview} tone="needs_review" today={today} />
                  <TaskSection heading="المهام المنجزة" items={summary.done} tone="done" today={today} />
                  {tasks.length === 100 && (
                    <p style={{ color: "var(--gray)", fontSize: 13 }}>يُعرض أحدث 100 مهمة فقط، لذلك قد توجد مهام أقدم غير مشمولة في الأعداد أعلاه.</p>
                  )}
                </>
              )}
              <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 20 }}>
                يُحدّث الطالب إنجاز مهامه من مساحته، ويُتابع المعلم المهام التي تحتاج مراجعته. هذه الصفحة للعرض فقط.
              </p>
            </>
          )}
        </div>
      </main>
    </Shell>
  );
}
