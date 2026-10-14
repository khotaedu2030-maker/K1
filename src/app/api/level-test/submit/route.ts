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
import { checkRateLimit, declaredBodyExceeds, rateLimitRejectionResponse, readJsonBodyLimited } from "@/lib/api-rate-limit";

// الخادم هو مالك حالة الاختبار بالكامل. العميل يرسل الحد الأدنى فقط:
// sessionId, questionId, selectedIndex — لا شيء آخر يُصدَّق منه.
// history/answeredIds/targetDifficulty تُعاد بناؤها هنا من level_test_answers في كل طلب،
// ولا تُقرأ أبدًا من جسم الطلب القادم من المتصفح.
export async function POST(req: Request) {
  if (declaredBodyExceeds(req, 8 * 1024)) {
    return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  }

  const parsed = await readJsonBodyLimited(req, 8 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const body = parsed.body;
  if (JSON.stringify(body ?? {}).length > 4096) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const sessionId = body?.sessionId as string | undefined;
  const submittedQuestionId = body?.questionId;
  const selectedIndex = body?.selectedIndex as number | undefined;

  if (typeof sessionId !== "string" || !sessionId || sessionId.length > 100 || submittedQuestionId === undefined || selectedIndex === undefined) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 20) {
    return NextResponse.json({ error: "الإجابة غير صالحة" }, { status: 400 });
  }

  const ipLimit = await checkRateLimit({ request: req, scope: "level-test:submit:ip", limit: 60, windowSeconds: 600 });
  const ipRejection = rateLimitRejectionResponse(ipLimit);
  if (ipRejection) return ipRejection;

  const sessionLimit = await checkRateLimit({
    request: req,
    scope: "level-test:submit:session",
    identifier: sessionId,
    limit: 30,
    windowSeconds: 600,
  });
  const sessionRejection = rateLimitRejectionResponse(sessionLimit);
  if (sessionRejection) return sessionRejection;

  const admin = createSupabaseAdminClient();

  const { data: session, error: sessionError } = await admin
    .from("level_test_sessions")
    .select("id, track_id, current_question_id, target_difficulty, max_questions, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    console.error("[level-test] session lookup failed:", sessionError.message);
    return NextResponse.json({ error: "تعذّر التحقق من جلسة الاختبار" }, { status: 503 });
  }
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
  const { data: allAnswers, error: answersError } = await admin
    .from("level_test_answers")
    .select("question_id, correct, difficulty, skill")
    .eq("session_id", sessionId)
    .order("answered_at", { ascending: true });

  if (answersError) {
    console.error("[level-test] answer history lookup failed:", answersError.message);
    return NextResponse.json({ error: "تعذّر تحميل سجل الإجابات" }, { status: 500 });
  }

  const answeredIds: QuestionId[] = [];
  const history: AnswerRecord[] = [];

  for (const row of allAnswers ?? []) {
    const matchedQuestion = track.questions.find((q) => String(q.id) === row.question_id);
    const qid: QuestionId = matchedQuestion ? matchedQuestion.id : row.question_id;
    const skill = typeof row.skill === "string"
      ? track.questions.find((candidate) => candidate.skill === row.skill)?.skill
      : undefined;
    if (!skill) {
      return NextResponse.json({ error: "سجل مهارة غير صالح" }, { status: 500 });
    }
    answeredIds.push(qid);
    history.push({ questionId: qid, correct: row.correct, difficulty: row.difficulty, skill });
  }

  const nextDifficulty = getNextDifficulty(session.target_difficulty, correct);
  const maxQuestions = Math.min(MAX_QUESTIONS, session.max_questions, track.questions.length);
  const reachedMaximum = answeredIds.length >= maxQuestions;

  const base = { correct, correctIndex: question.answer };

  if (reachedMaximum) {
    const estimated = estimateLevel(history);
    const { data: finishedSession, error: finishError } = await admin
      .from("level_test_sessions")
      .update({ status: "finished", finished_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (finishError) {
      console.error("[level-test] session finish failed:", finishError.message);
      return NextResponse.json({ error: "تعذّر إنهاء جلسة الاختبار" }, { status: 500 });
    }
    if (!finishedSession) {
      return NextResponse.json({ error: "تغيّرت حالة جلسة الاختبار، حدّث الصفحة وحاول مرة أخرى" }, { status: 409 });
    }

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
    const { data: finishedSession, error: finishError } = await admin
      .from("level_test_sessions")
      .update({ status: "finished", finished_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (finishError) {
      console.error("[level-test] session finish failed:", finishError.message);
      return NextResponse.json({ error: "تعذّر إنهاء جلسة الاختبار" }, { status: 500 });
    }
    if (!finishedSession) {
      return NextResponse.json({ error: "تغيّرت حالة جلسة الاختبار، حدّث الصفحة وحاول مرة أخرى" }, { status: 409 });
    }

    return NextResponse.json({
      ...base,
      finished: true,
      nextQuestion: null,
      result: { ...estimated, correctAnswers: history.filter((h) => h.correct).length, total: history.length },
    });
  }

  const { data: advancedSession, error: advanceError } = await admin
    .from("level_test_sessions")
    .update({ current_question_id: String(next.id), target_difficulty: nextDifficulty })
    .eq("id", sessionId)
    .eq("status", "active")
    .eq("current_question_id", session.current_question_id)
    .select("id")
    .maybeSingle();
  if (advanceError) {
    console.error("[level-test] session advance failed:", advanceError.message);
    return NextResponse.json({ error: "تعذّر تحديث جلسة الاختبار" }, { status: 500 });
  }
  if (!advancedSession) {
    return NextResponse.json({ error: "تغيّرت حالة جلسة الاختبار، حدّث الصفحة وحاول مرة أخرى" }, { status: 409 });
  }

  return NextResponse.json({
    ...base,
    finished: false,
    nextQuestion: toPublicQuestion(next),
  });
}
