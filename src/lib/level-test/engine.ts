// محرك الاختبار التكيفي — Server-only، يُستدعى من route handlers فقط.
import { levelNames } from "./data";
import type { AnswerRecord, Question, QuestionId } from "./data";

export function getNextDifficulty(
  currentDifficulty: number,
  correct: boolean
) {
  if (correct) {
    return Math.min(5, currentDifficulty + 1);
  }

  return Math.max(1, currentDifficulty - 1);
}

export function chooseNextQuestion(
  questions: Question[],
  answeredIds: QuestionId[],
  targetDifficulty: number,
  history: AnswerRecord[]
) {
  const available = questions.filter(
    (question) => !answeredIds.includes(question.id)
  );

  if (!available.length) {
    return null;
  }

  const skillCounts: Record<string, number> = {};

  history.forEach((item) => {
    skillCounts[item.skill] =
      (skillCounts[item.skill] ?? 0) + 1;
  });

  const sorted = [...available].sort((a, b) => {
    const distanceA = Math.abs(
      a.difficulty - targetDifficulty
    );

    const distanceB = Math.abs(
      b.difficulty - targetDifficulty
    );

    if (distanceA !== distanceB) {
      return distanceA - distanceB;
    }

    const countA = skillCounts[a.skill] ?? 0;
    const countB = skillCounts[b.skill] ?? 0;

    if (countA !== countB) {
      return countA - countB;
    }

    // ملاحظة: QuestionId = number | string (لأسئلة Business: "business-1"...).
    // لا يصح طرح المعرّفين حسابيًا؛ نستخدم مقارنة نصية لضمان ترتيب ثابت وحتمي فقط
    // (لا نحتاج ترتيبًا رقميًا حقيقيًا هنا، فقط كسر تعادل ثابت).
    return String(a.id).localeCompare(String(b.id));
  });

  return sorted[0];
}

/*
 * محرك تقدير المستوى الجديد.
 *
 * كل إجابة صحيحة تضيف وزنًا بحسب صعوبة السؤال.
 * كل إجابة خاطئة تخصم وزنًا بحسب صعوبة السؤال.
 *
 * بهذه الطريقة لا يكفي أن يحصل المتدرب على أسئلة صعبة؛
 * يجب أن يثبت قدرته على الإجابة عليها.
 */
export function estimateLevel(history: AnswerRecord[]) {
  if (!history.length) {
    return {
      level: "A1",
      confidence: "منخفضة",
      score: 0,
    };
  }

  let earned = 0;
  let possible = 0;

  history.forEach((item) => {
    const weight = item.difficulty;

    possible += weight;

    if (item.correct) {
      earned += weight;
    }
  });

  const accuracy =
    possible > 0 ? earned / possible : 0;

  /*
   * نحسب مؤشر قدرة من 1 إلى 5.
   *
   * 0% ≈ A1
   * 100% ≈ C1
   *
   * ثم نضيف عامل "أعلى مستوى تم إثباته"
   * حتى لا ترفع إجابة واحدة المستوى بشكل مبالغ فيه.
   */
  let ability = 1 + accuracy * 4;

  const highDifficultyCorrect = history.filter(
    (item) =>
      item.correct && item.difficulty >= 4
  ).length;

  const mediumDifficultyCorrect = history.filter(
    (item) =>
      item.correct && item.difficulty === 3
  ).length;

  const lowDifficultyWrong = history.filter(
    (item) =>
      !item.correct && item.difficulty <= 2
  ).length;

  if (highDifficultyCorrect >= 2) {
    ability += 0.35;
  }

  if (mediumDifficultyCorrect >= 3) {
    ability += 0.15;
  }

  if (lowDifficultyWrong >= 3) {
    ability -= 0.35;
  }

  ability = Math.max(1, Math.min(5, ability));

  let levelNumber: number;

  if (ability < 1.75) {
    levelNumber = 1;
  } else if (ability < 2.55) {
    levelNumber = 2;
  } else if (ability < 3.35) {
    levelNumber = 3;
  } else if (ability < 4.25) {
    levelNumber = 4;
  } else {
    levelNumber = 5;
  }

  /*
   * حماية إضافية:
   * إذا كانت الدقة الفعلية منخفضة جدًا،
   * لا نسمح للمستوى بالقفز إلى مستوى مرتفع.
   */
  const rawAccuracy =
    history.filter((item) => item.correct).length /
    history.length;

  if (rawAccuracy < 0.3) {
    levelNumber = Math.min(levelNumber, 1);
  } else if (rawAccuracy < 0.45) {
    levelNumber = Math.min(levelNumber, 2);
  } else if (rawAccuracy < 0.6) {
    levelNumber = Math.min(levelNumber, 3);
  }

  /*
   * الثقة ترتفع كلما زاد عدد الأسئلة
   * واستقر الأداء.
   */
  const recent = history.slice(-6);

  let confidence = "منخفضة";

  if (history.length >= 20) {
    confidence = "متوسطة";

    if (recent.length >= 5) {
      const recentAccuracy =
        recent.filter((item) => item.correct).length /
        recent.length;

      const recentDifficulty =
        recent.reduce(
          (sum, item) => sum + item.difficulty,
          0
        ) / recent.length;

      const stable =
        Math.abs(
          recentAccuracy -
            rawAccuracy
        ) < 0.2;

      if (
        stable &&
        recentDifficulty >= 2
      ) {
        confidence = "مرتفعة";
      }
    }
  } else if (history.length >= 15) {
    confidence = "متوسطة";
  }

  return {
    level: levelNames[levelNumber],
    confidence,
    score: Math.round(rawAccuracy * 100),
  };
}
