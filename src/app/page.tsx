"use client";

import { useState } from "react";

type Step = {
  number: string;
  title: string;
  subtitle: string;
};

const steps: Step[] = [
  {
    number: "01",
    title: "التركيز",
    subtitle: "مهارات أساسية",
  },
  {
    number: "02",
    title: "تنظيم الوقت",
    subtitle: "قيد التطوير",
  },
  {
    number: "03",
    title: "التخطيط",
    subtitle: "الخطوة القادمة",
  },
];

const strengthsQuestions = [
  {
    question: "عندما أواجه مهمة جديدة، غالبًا أبدأ بـ:",
    options: [
      "تحديد المطلوب وترتيب الأفكار",
      "البدء مباشرة وتجربة الحل",
      "البحث والسؤال قبل البدء",
      "تأجيلها حتى تتضح الصورة",
    ],
  },
  {
    question: "عندما أتعلم مهارة جديدة، أفضل أن:",
    options: [
      "أطبقها بنفسي",
      "أشاهد شرحًا ثم أطبق",
      "أقرأ وأبحث عنها",
      "أتدرب مع شخص آخر",
    ],
  },
  {
    question: "أكثر شيء يساعدني على الإنجاز هو:",
    options: [
      "وجود هدف واضح",
      "خطة مرتبة",
      "موعد نهائي",
      "بيئة هادئة",
    ],
  },
  {
    question: "عندما أواجه صعوبة في مهمة:",
    options: [
      "أحلل المشكلة خطوة بخطوة",
      "أجرب أكثر من طريقة",
      "أطلب المساعدة",
      "أنتقل لمهمة أخرى وأعود لها",
    ],
  },
];

export default function BookingPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const currentQuestion = strengthsQuestions[questionIndex];

  const progress = showResult
    ? 100
    : showQuestions
      ? Math.round(
          ((questionIndex + (answers[questionIndex] !== undefined ? 1 : 0)) /
            strengthsQuestions.length) *
            100
        )
      : Math.round(((activeStep + 1) / steps.length) * 100);

  const handleStepChange = (index: number) => {
    setActiveStep(index);
    setShowQuestions(false);
    setShowResult(false);
    setQuestionIndex(0);
    setAnswers([]);
  };

  const startStrengths = () => {
    setActiveStep(0);
    setShowQuestions(true);
    setShowResult(false);
    setQuestionIndex(0);
  };

  const selectAnswer = (index: number) => {
    const updatedAnswers = [...answers];
    updatedAnswers[questionIndex] = index;
    setAnswers(updatedAnswers);
  };

  const nextQuestion = () => {
    if (answers[questionIndex] === undefined) return;

    if (questionIndex < strengthsQuestions.length - 1) {
      setQuestionIndex(questionIndex + 1);
    } else {
      setShowResult(true);
    }
  };

  const previousQuestion = () => {
    if (questionIndex > 0) {
      setQuestionIndex(questionIndex - 1);
    }
  };

  const restart = () => {
    setQuestionIndex(0);
    setAnswers([]);
    setShowQuestions(true);
    setShowResult(false);
  };

  const getResultText = () => {
  const counts = [0, 0, 0, 0];

  answers.forEach((answer) => {
    if (answer !== undefined) {
      counts[answer]++;
    }
  });

  const strongest = counts.indexOf(Math.max(...counts));

  const results = [
    {
      title: "لديك قدرة جيدة على التركيز والتحليل",
      description:
        "تميل إلى فهم المطلوب وترتيب الأفكار قبل البدء، وهذه نقطة قوة يمكن البناء عليها.",
    },
    {
      title: "تميل إلى التعلم من خلال التطبيق",
      description:
        "تتعلم بشكل أفضل عندما تنتقل من الفكرة إلى التطبيق وتجربة الحلول بنفسك.",
    },
    {
      title: "لديك فضول ورغبة في الفهم",
      description:
        "البحث والسؤال من الأدوات التي تساعدك على تطوير مهاراتك والوصول إلى حلول أفضل.",
    },
    {
      title: "تستفيد من التنظيم والدعم",
      description:
        "وجود بيئة مناسبة وخطوات واضحة يمكن أن يساعدك على تحويل قدراتك إلى نتائج أفضل.",
    },
  ];
return results[strongest];
  };

  return (
    <main className="booking-page" dir="rtl">
      {/* =========================
          HERO
      ========================== */}
      <section className="booking-hero">
        <div className="booking-container">
          <div className="booking-hero-content">
            <div className="booking-hero-text">
              <p className="booking-label">رحلة الطالب</p>

              <p className="booking-kicker">خطوة بخطوة نحو التميز</p>

              <h1>
                جاهز تبدأ
                <br />
                رحلة مختلفة
                <br />
                مع خطى؟
              </h1>

              <p className="booking-description">
                نبدأ من فهم احتياجك، ثم نبني معًا مسارًا تعليميًا يساعدك على
                التعلم بثقة، وتنظيم وقتك، وتطوير مهاراتك.
              </p>

              <div className="booking-actions">
                <button
                  className="booking-primary"
                  onClick={startStrengths}
                >
                  ابدأ رحلتك ←
                </button>

                <button
                  className="booking-secondary"
                  onClick={() =>
                    window.scrollTo({
                      top: document.body.scrollHeight,
                      behavior: "smooth",
                    })
                  }
                >
                  العودة للرئيسية
                </button>
              </div>
            </div>

            {/* بطاقة رحلة الطالب */}
            <div className="student-card">
              <div className="student-card-header">
                <strong>رحلة الطالب</strong>
                <span>تقدم مستمر</span>
              </div>

              <div className="student-card-goal">
                <small>الهدف</small>
                <h3>أتعلم بثقة واستقلالية</h3>
              </div>

              <div className="steps-list">
                {steps.map((step, index) => (
                  <button
                    key={step.number}
                    className={`step-item ${
                      activeStep === index ? "active" : ""
                    }`}
                    onClick={() => handleStepChange(index)}
                  >
                    <span className="step-number">{step.number}</span>

                    <div>
                      <strong>{step.title}</strong>
                      <small>{step.subtitle}</small>
                    </div>

                    <span className="step-check">
                      {activeStep > index
                        ? "✓"
                        : activeStep === index
                          ? "→"
                          : ""}
                    </span>
                  </button>
                ))}
              </div>

              <div className="progress-area">
                <div className="progress-label">
                  <span>التقدم</span>
                  <strong>{progress}%</strong>
                </div>

                <div className="progress-bar">
                  <span style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          CURRENT JOURNEY
      ========================== */}
      <section className="booking-next">
        <div className="booking-container">
          {!showQuestions && !showResult && (
            <>
              {activeStep === 0 && (
                <>
                  <p className="booking-label">الخطوة الأولى</p>

                  <h2>
                    خلنا نعرف احتياجك
                    <br />
                    ونبني المسار المناسب لك.
                  </h2>

                  <p>
                    اختر الخطوة التي تريد البدء منها، وسنساعدك على الانتقال إلى
                    المرحلة التالية بطريقة واضحة وبسيطة.
                  </p>
                </>
              )}

              {activeStep === 1 && (
                <>
                  <p className="booking-label">الخطوة الثانية</p>

                  <h2>
                    خلنا ننظم وقتك
                    <br />
                    ونبني لك طريقة عملية.
                  </h2>

                  <p>
                    رتب أدواتك ونظم وقتك بطريقة تساعدك على الاستمرار والتقدم.
                  </p>
                </>
              )}

              {activeStep === 2 && (
                <>
                  <p className="booking-label">الخطوة الثالثة</p>

                  <h2>
                    خلنا نخطط لخطوتك القادمة
                    <br />
                    ونحدد المسار المناسب لك.
                  </h2>

                  <p>
                    حوّل أهدافك إلى خطوات واضحة وعملية تساعدك على معرفة ما يجب
                    أن تفعله بعد ذلك.
                  </p>
                </>
              )}

              <div className="choice-grid">
                <button
                  className={`choice-card ${
                    activeStep === 0 ? "selected" : ""
                  }`}
                  onClick={() => {
                    setActiveStep(0);
                    startStrengths();
                  }}
                >
                  <span>01</span>
                  <strong>أحتاج أعرف نقاط قوتي</strong>
                  <small>ابدأ من هنا</small>
                </button>

                <button
                  className={`choice-card ${
                    activeStep === 1 ? "selected" : ""
                  }`}
                  onClick={() => handleStepChange(1)}
                >
                  <span>02</span>
                  <strong>أحتاج أنظم وقتي</strong>
                  <small>ابدأ من هنا</small>
                </button>

                <button
                  className={`choice-card ${
                    activeStep === 2 ? "selected" : ""
                  }`}
                  onClick={() => handleStepChange(2)}
                >
                  <span>03</span>
                  <strong>أحتاج أخطط لخطوتي القادمة</strong>
                  <small>ابدأ من هنا</small>
                </button>
              </div>
            </>
          )}

          {/* =========================
              QUESTIONS
          ========================== */}
          {showQuestions && !showResult && (
            <div className="booking-question">
              <p className="booking-label">اكتشف نقاط قوتك</p>

              <div className="question-header">
                <span>
                  السؤال {questionIndex + 1} من {strengthsQuestions.length}
                </span>

                <strong>{progress}%</strong>
              </div>

              <h2>{currentQuestion.question}</h2>

              <div className="answers-grid">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={option}
                    className={`answer-card ${
                      answers[questionIndex] === index ? "selected" : ""
                    }`}
                    onClick={() => selectAnswer(index)}
                  >
                    <span>{index + 1}</span>
                    <strong>{option}</strong>

                    {answers[questionIndex] === index && (
                      <b>✓</b>
                    )}
                  </button>
                ))}
              </div>

              <div className="question-actions">
                <button
                  className="booking-secondary"
                  onClick={previousQuestion}
                  disabled={questionIndex === 0}
                >
                  السابق
                </button>

                <button
                  className="booking-primary"
                  onClick={nextQuestion}
                  disabled={answers[questionIndex] === undefined}
                >
                  {questionIndex === strengthsQuestions.length - 1
                    ? "عرض النتيجة"
                    : "التالي ←"}
                </button>
              </div>
            </div>
          )}

          {/* =========================
              RESULT
          ========================== */}
          {showResult && (
            <div className="booking-result">
              <p className="booking-label">نتيجتك الأولية</p>

              <h2>تعرف على نقطة قوتك</h2>

              <div className="result-card">
                <span className="result-icon">✓</span>

                <div>
                  <h3>{getResultText().title}</h3>
                  <p>{getResultText().description}</p>
                </div>
              </div>

              <div className="result-actions">
                <button
                  className="booking-primary"
                  onClick={() => handleStepChange(1)}
                >
                  الخطوة التالية ←
                </button>

                <button
                  className="booking-secondary"
                  onClick={restart}
                >
                  إعادة التقييم
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}