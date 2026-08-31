"use client";

import { useState } from "react";

const steps = [
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

export default function BookingPage() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <main className="booking-page">
      <section className="booking-hero">
        <div className="booking-container">
          <div className="booking-header">
            <span className="booking-kicker">رحلة الطالب</span>

            <span className="booking-status">
              تقدم مستمر
            </span>
          </div>

          <div className="booking-content">
            <div className="booking-copy">
              <p className="booking-label">خطوة بخطوة نحو التميز</p>

              <h1>
                جاهز تبدأ
                <br />
                رحلة مختلفة
                <br />
                مع خطى؟
              </h1>

              <p className="booking-description">
                نبدأ من فهم احتياجك، ثم نبني معًا مسارًا
                تعليميًا يساعدك على التعلم بثقة، وتنظيم
                وقتك، وتطوير مهاراتك.
              </p>

              <div className="booking-actions">
                <button
                  className="booking-primary"
                  onClick={() => setActiveStep(0)}
                >
                  ابدأ رحلتك ←
                </button>

                <a href="/" className="booking-secondary">
                  العودة للرئيسية
                </a>
              </div>
            </div>

            <div className="student-card">
              <div className="student-card-top">
                <span>رحلة الطالب</span>
                <small>تقدم مستمر</small>
              </div>

              <div className="student-goal">
                <span>الهدف</span>
                <h2>أتعلم بثقة واستقلالية</h2>
              </div>

              <div className="steps-list">
                {steps.map((step, index) => (
                  <button
                    key={step.number}
                    className={`step-item ${
                      activeStep === index ? "active" : ""
                    }`}
                    onClick={() => setActiveStep(index)}
                  >
                    <span className="step-check">
                      {index < activeStep ? "✓" : index === activeStep ? "→" : ""}
                    </span>

                    <span className="step-info">
                      <strong>{step.title}</strong>
                      <small>{step.subtitle}</small>
                    </span>

                    <span className="step-number">
                      {step.number}
                    </span>
                  </button>
                ))}
              </div>

              <div className="progress-area">
                <div className="progress-label">
                  <span>التقدم</span>
                  <strong>{Math.round(((activeStep + 1) / steps.length) * 100)}%</strong>
                </div>

                <div className="progress-bar">
                  <span
                    style={{
                      width: `${((activeStep + 1) / steps.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
<section className="booking-next">
  <div className="booking-container">
    <p className="booking-label">
      {activeStep === 0
        ? "الخطوة الأولى"
        : activeStep === 1
        ? "الخطوة الثانية"
        : "الخطوة الثالثة"}
    </p>

    <h2>
      {activeStep === 0 && (
        <>
          خلنا نعرف نقاط قوتك
          <br />
          ونبني عليها.
        </>
      )}

      {activeStep === 1 && (
        <>
          خلنا ننظم وقتك
          <br />
          ونبني لك طريقة عملية.
        </>
      )}

      {activeStep === 2 && (
        <>
          خلنا نخطط لخطوتك القادمة
          <br />
          ونحدد المسار المناسب لك.
        </>
      )}
    </h2>

    <p>
      {activeStep === 0 &&
        "اكتشف نقاط قوتك ومهاراتك الأساسية، وابدأ من المكان الذي يناسبك."}

      {activeStep === 1 &&
        "رتب أولوياتك ونظم وقتك بطريقة تساعدك على الاستمرار والتقدم."}

      {activeStep === 2 &&
        "حوّل أهدافك إلى خطوات واضحة وعملية تساعدك على معرفة ما يجب أن تفعله بعد ذلك."}
    </p>

    <div className="choice-grid">
      <button
        onClick={() => setActiveStep(0)}
        className={`choice-card ${activeStep === 0 ? "active" : ""}`}
      >
        <span>01</span>
        <strong>أحتاج أعرف نقاط قوتي</strong>
        <small>ابدأ من هنا</small>
      </button>

      <button
        onClick={() => setActiveStep(1)}
        className={`choice-card ${activeStep === 1 ? "active" : ""}`}
      >
        <span>02</span>
        <strong>أحتاج أنظم وقتي</strong>
        <small>ابدأ من هنا</small>
      </button>

      <button
        onClick={() => setActiveStep(2)}
        className={`choice-card ${activeStep === 2 ? "active" : ""}`}
      >
        <span>03</span>
        <strong>أحتاج أخطط لخطوتي القادمة</strong>
        <small>ابدأ من هنا</small>
      </button>
    </div>
  </div>
</section>
    </main>
  );
}