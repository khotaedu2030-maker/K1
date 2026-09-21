import { NextResponse } from "next/server";
import {
  tracks,
  MAX_QUESTIONS,
  toPublicQuestion,
  type TrackId,
  type AnswerRecord,
  type QuestionId,
} from "@/lib/level-test/data";
import { chooseNextQuestion, getNextDifficulty, estimateLevel } from "@/lib/level-test/engine";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// الخادم هو مالك حالة الاختبار بالكامل. العميل يرسل الحد الأدنى فقط:
// sessionId, questionId, selectedIndex — لا شيء آخر يُصدَّق منه.
// history/answeredIds/targetDifficulty تُعاد بناؤها هنا من level_test_answers في كل طلب،
// ولا تُقرأ أبدًا من جسم الطلب القادم من المتصفح.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (JSON.stringify(body ?? {}).length > 4096) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const sessionId = body?.sessionId as string | undefined;
  const submittedQuestionId = body?.questionId;
  const selectedIndex = body?.selectedIndex as number | undefined;

  if (!sessionId || submittedQuestionId === undefined || selectedIndex === undefined) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 20) {
    return NextResponse.json({ error: "الإجابة غير صالحة" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: session } = await admin
    .from("level_test_sessions")
    .select("id, track_id, current_question_id, target_difficulty, max_questions, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "جلسة غير موجودة" }, { status: 404 });
  if (session.status !== "active") return NextResponse.json({ error: "الجلسة منتهية بالفعل" }, { status: 409 });

  // تحقق أن السؤال المُجاب عليه هو فعلًا السؤال الحالي المسجَّل عند الخادم لهذه الجلسة —
  // يمنع إرسال إجابة لسؤال لم يُقدَّم فعليًا (وليس مجرد مطابقة شكلية).
  if (String(submittedQuestionId) !== session.current_question_id) {
    return NextResponse.json({ error: "هذا السؤال لا يطابق حالة الجلسة الحالية" }, { status: 409 });
  }

  const track = tracks.find((t) => t.id === (session.track_id as TrackId));
  if (!track) return NextResponse.json({ error: "مسار غير معروف" }, { status: 500 });

  const question = track.questions.find((q) => String(q.id) === session.current_question_id);
  if (!question) return NextResponse.json({ error: "سؤال غير معروف" }, { status: 500 });

  const correct = selectedIndex === question.answer;

  // تسجيل الإجابة — القيد unique(session_id, question_id) في قاعدة البيانات يمنع الـ replay:
  // إعادة إرسال نفس السؤال لنفس الجلسة تُرفض تلقائيًا بخطأ تكرار مفتاح.
  const { error: insertError } = await admin.from("level_test_answers").insert({
    session_id: sessionId,
    question_id: session.current_question_id,
    selected_index: selectedIndex,
    correct,
    difficulty: question.difficulty,
    skill: question.skill,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "تمت الإجابة على هذا السؤال بالفعل" }, { status: 409 });
    }
    console.error("[level-test] answer save failed:", insertError.message);
    return NextResponse.json({ error: "تعذّر حفظ الإجابة" }, { status: 500 });
  }

  // إعادة بناء answeredIds/history الكاملين من قاعدة البيانات — مصدر الحقيقة الوحيد
  const { data: allAnswers } = await admin
    .from("level_test_answers")
    .select("question_id, correct, difficulty, skill")
    .eq("session_id", sessionId)
    .order("answered_at", { ascending: true });

  const answeredIds: QuestionId[] = [];
  const history: AnswerRecord[] = [];

  for (const row of allAnswers ?? []) {
    const matchedQuestion = track.questions.find((q) => String(q.id) === row.question_id);
    const qid: QuestionId = matchedQuestion ? matchedQuestion.id : row.question_id;
    answeredIds.push(qid);
    history.push({ questionId: qid, correct: row.correct, difficulty: row.difficulty, skill: row.skill as any });
  }

  const nextDifficulty = getNextDifficulty(session.target_difficulty, correct);
  const maxQuestions = Math.min(MAX_QUESTIONS, session.max_questions, track.questions.length);
  const reachedMaximum = answeredIds.length >= maxQuestions;

  const base = { correct, correctIndex: question.answer };

  if (reachedMaximum) {
    const estimated = estimateLevel(history);
    await admin
      .from("level_test_sessions")
      .update({ status: "finished", finished_at: new Date().toISOString() })
      .eq("id", sessionId);

    return NextResponse.json({
      ...base,
      finished: true,
      nextQuestion: null,
      result: { ...estimated, correctAnswers: history.filter((h) => h.correct).length, total: history.length },
    });
  }

  const next = chooseNextQuestion(track.questions, answeredIds, nextDifficulty, history);
  if (!next) {
    const estimated = estimateLevel(history);
    await admin
      .from("level_test_sessions")
      .update({ status: "finished", finished_at: new Date().toISOString() })
      .eq("id", sessionId);

    return NextResponse.json({
      ...base,
      finished: true,
      nextQuestion: null,
      result: { ...estimated, correctAnswers: history.filter((h) => h.correct).length, total: history.length },
    });
  }

  await admin
    .from("level_test_sessions")
    .update({ current_question_id: String(next.id), target_difficulty: nextDifficulty })
    .eq("id", sessionId);

  return NextResponse.json({
    ...base,
    finished: false,
    nextQuestion: toPublicQuestion(next),
  });
}
