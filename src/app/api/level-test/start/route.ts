import { NextResponse } from "next/server";
import { tracks, MAX_QUESTIONS, toPublicQuestion, type TrackId } from "@/lib/level-test/data";
import { chooseNextQuestion } from "@/lib/level-test/engine";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// ينشئ جلسة اختبار مملوكة بالكامل من الخادم (level_test_sessions) ويعيد أول سؤال فقط.
// المتصفح لن يرى أبدًا answeredIds/history/targetDifficulty كحقيقة يُعتمد عليها لاحقًا —
// فقط sessionId يُستخدم كمرجع للخادم في /submit.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (JSON.stringify(body ?? {}).length > 2048) return NextResponse.json({ error: "الطلب طويل جدًا" }, { status: 413 });
  const trackId = body?.trackId as TrackId | undefined;

  const track = tracks.find((t) => t.id === trackId);
  if (!track) {
    return NextResponse.json({ error: "مسار غير معروف" }, { status: 400 });
  }

  const first = chooseNextQuestion(track.questions, [], 2, []);
  if (!first) {
    return NextResponse.json({ error: "لا توجد أسئلة لهذا المسار" }, { status: 500 });
  }

  const maxQuestions = Math.min(MAX_QUESTIONS, track.questions.length);
  const admin = createSupabaseAdminClient();

  const { data: session, error } = await admin
    .from("level_test_sessions")
    .insert({
      track_id: track.id,
      current_question_id: String(first.id),
      target_difficulty: 2,
      max_questions: maxQuestions,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !session) {
    if (error) console.error("[level-test] session create failed:", error.message);
    return NextResponse.json({ error: "تعذّر إنشاء جلسة الاختبار" }, { status: 500 });
  }

  return NextResponse.json({
    sessionId: session.id,
    question: toPublicQuestion(first),
    maxQuestions,
  });
}
