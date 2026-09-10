"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Shell from "@/components/Shell";

type TrackId = "general" | "schools" | "business";
type QuestionId = number | string;

type PublicQuestion = {
  id: QuestionId;
  skill: "Conversation" | "Grammar" | "Vocabulary" | "Use of English" | "Reading";
  difficulty: number;
  question: string;
  options: string[];
};

type TrackMeta = { id: TrackId; title: string; subtitle: string; description: string };

const levelDescriptions: Record<string, string> = {
  A1: "مستوى مبتدئ. تستطيع فهم واستخدام عبارات أساسية في المواقف اليومية البسيطة.",
  A2: "مستوى أساسي. تستطيع التعامل مع المواقف اليومية والتواصل في موضوعات مألوفة.",
  B1: "مستوى متوسط. تستطيع التعامل مع معظم المواقف اليومية والتعبير عن أفكارك بشكل مفهوم.",
  B2: "مستوى فوق المتوسط. تستطيع التواصل بثقة وفهم نصوص ومواقف أكثر تعقيدًا.",
  C1: "مستوى متقدم. تستطيع استخدام الإنجليزية بمرونة وفهم اللغة في مواقف أكاديمية ومهنية متقدمة.",
};

function LevelTestInner() {
  const searchParams = useSearchParams();
  const requestedTrack = searchParams.get("track");

  const [tracksMeta, setTracksMeta] = useState<TrackMeta[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<TrackId | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0); // للعرض فقط (progress bar) — الخادم يملك الحقيقة
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [maxQuestions, setMaxQuestions] = useState(0);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/level-test/tracks")
      .then((r) => r.json())
      .then((d) => setTracksMeta(d.tracks ?? []));
  }, []);

  async function startTest(trackId: TrackId) {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/level-test/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "تعذّر بدء الاختبار.");
      setLoading(false);
      return;
    }
    setSelectedTrack(trackId);
    setSessionId(data.sessionId);
    setQuestion(data.question);
    setMaxQuestions(data.maxQuestions);
    setAnsweredCount(0);
    setSelectedAnswer(null);
    setAnswerLocked(false);
    setCorrectIndex(null);
    setFinished(false);
    setResult(null);
    setLoading(false);
  }

  useEffect(() => {
    if (
      requestedTrack &&
      (requestedTrack === "general" || requestedTrack === "schools" || requestedTrack === "business") &&
      !selectedTrack
    ) {
      startTest(requestedTrack);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedTrack]);

  async function submitAnswer() {
    if (!sessionId || !question || selectedAnswer === null || answerLocked) return;
    setLoading(true);
    setError(null);

    // العميل يرسل الحد الأدنى فقط: sessionId + questionId + selectedIndex.
    // الخادم يملك history/answeredIds/targetDifficulty بالكامل ويعيد بناءها من قاعدة البيانات.
    const res = await fetch("/api/level-test/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        questionId: question.id,
        selectedIndex: selectedAnswer,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "تعذّر إرسال الإجابة.");
      return;
    }

    setCorrectIndex(data.correctIndex);
    setAnswerLocked(true);
    setAnsweredCount((prev) => prev + 1);

    if (data.finished) {
      setResult(data.result);
      setFinished(true);
    } else {
      // نحتفظ بالسؤال التالي جاهزًا عند الضغط على "التالي"
      (window as any).__khotaNextQuestion = data.nextQuestion;
    }
  }

  function nextQuestion() {
    const next = (window as any).__khotaNextQuestion as PublicQuestion | undefined;
    if (!next) return;
    setQuestion(next);
    setSelectedAnswer(null);
    setAnswerLocked(false);
    setCorrectIndex(null);
  }

  function resetTest() {
    setSelectedTrack(null);
    setSessionId(null);
    setQuestion(null);
    setAnsweredCount(0);
    setSelectedAnswer(null);
    setAnswerLocked(false);
    setCorrectIndex(null);
    setFinished(false);
    setResult(null);
    setError(null);
  }

  const progress = maxQuestions ? Math.min(100, Math.round((answeredCount / maxQuestions) * 100)) : 0;

  if (!selectedTrack) {
    return (
      <section className="quiz-shell">
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <span className="badge">KHOTA English</span>
            <h1 className="title" style={{ fontSize: 42, marginTop: 16 }}>
              اعرف مستواك في اللغة الإنجليزية
            </h1>
            <p className="lead" style={{ margin: "16px auto 0" }}>
              اختبار تكيفي يساعدك على معرفة نقطة البداية المناسبة لك، ثم نقترح
              عليك المجموعة المناسبة.
            </p>
            {error && <p style={{ color: "var(--p)", marginTop: 12 }}>{error}</p>}
          </div>
          <div className="track-grid">
            {tracksMeta.map((t) => (
              <button key={t.id} className="track-card" onClick={() => startTest(t.id)} disabled={loading}>
                <span className="badge">{t.subtitle}</span>
                <h3 className="en" style={{ marginTop: 14 }}>{t.title}</h3>
                <p style={{ color: "var(--gray)" }}>{t.description}</p>
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (finished && result) {
    return (
      <section className="quiz-shell">
        <div className="container narrow">
          <div className="result-level">
            <span className="en" style={{ opacity: 0.7, fontSize: 13, letterSpacing: "0.08em" }}>
              YOUR ESTIMATED LEVEL
            </span>
            <strong>{result.level}</strong>
            <span>{levelDescriptions[result.level]}</span>
          </div>

          <div className="quiz-card">
            <h3 style={{ marginTop: 0 }}>ملخص الأداء</h3>
            <p style={{ color: "var(--gray)" }}>
              {result.correctAnswers} إجابة صحيحة من أصل {result.total} • مستوى الثقة: {result.confidence}
            </p>

            <div className="summary" style={{ marginTop: 20 }}>
              <strong>المسار المقترح: {result.level}</strong>
              <Link className="btn" href="/english/programs">عرض المجموعات المتاحة ←</Link>
            </div>

            <div className="actions" style={{ marginTop: 20 }}>
              <button className="btn outline" onClick={resetTest}>إعادة الاختبار</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!question) return <section className="quiz-shell" />;

  return (
    <section className="quiz-shell">
      <div className="container narrow">
        <div className="progressbar">
          <div style={{ width: `${progress}%` }} />
        </div>
        <div className="quiz-card">
          <div className="quiz-skill en">
            {question.skill} • سؤال {answeredCount + 1} من {maxQuestions}
          </div>
          <div className="quiz-q en" style={{ direction: "ltr", textAlign: "right" }}>
            {question.question}
          </div>
          <div className="quiz-options">
            {question.options.map((option, index) => {
              const isSelected = selectedAnswer === index;
              const isCorrect = answerLocked && index === correctIndex;
              const isWrongSelected = answerLocked && isSelected && index !== correctIndex;

              return (
                <button
                  key={option}
                  className={
                    "quiz-option en" +
                    (isSelected && !answerLocked ? " selected" : "") +
                    (isCorrect ? " correct" : "") +
                    (isWrongSelected ? " incorrect" : "")
                  }
                  style={{ direction: "ltr", textAlign: "right" }}
                  disabled={answerLocked || loading}
                  onClick={() => setSelectedAnswer(index)}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <div className="quiz-footer">
            <span style={{ color: "var(--gray)", fontSize: 13 }}>الصعوبة الحالية: {question.difficulty} / 5</span>
            {error && <span style={{ color: "var(--p)", fontSize: 13 }}>{error}</span>}
            {answerLocked ? (
              <button className="btn" onClick={nextQuestion} disabled={loading}>التالي ←</button>
            ) : (
              <button className="btn" disabled={selectedAnswer === null || loading} onClick={submitAnswer}>
                تأكيد الإجابة
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LevelTestPage() {
  return (
    <Shell>
      <main>
        <Suspense fallback={<div className="quiz-shell" />}>
          <LevelTestInner />
        </Suspense>
      </main>
    </Shell>
  );
}
