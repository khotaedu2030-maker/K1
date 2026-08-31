"use client";

import { useMemo, useState } from "react";

type Audience =
  | "طالب"
  | "ولي أمر"
  | "طالب جامعي"
  | "بالغ"
  | "مدرسة / جهة تعليمية";

type Need =
  | "أفهم نقاط القوة والاحتياج"
  | "أنظم الوقت والمهام"
  | "أطور التركيز والانتباه"
  | "أبني خطة وخطوات قادمة"
  | "أبحث عن برنامج للمؤسسة";

type FormData = {
  audience: Audience | "";
  need: Need | "";
  name: string;
  email: string;
  phone: string;
  notes: string;
  date: string;
  time: string;
};

const audiences: { id: Audience; title: string; description: string }[] = [
  {
    id: "طالب",
    title: "طالب",
    description: "أبحث عن دعم يساعدني على التعلم والتقدم.",
  },
  {
    id: "ولي أمر",
    title: "ولي أمر",
    description: "أبحث عن مسار مناسب لابني أو ابنتي.",
  },
  {
    id: "طالب جامعي",
    title: "طالب جامعي",
    description: "أحتاج دعمًا للنجاح والاستقلالية في الجامعة.",
  },
  {
    id: "بالغ",
    title: "بالغ",
    description: "أريد تطوير التنظيم والوقت والمهام اليومية.",
  },
  {
    id: "مدرسة / جهة تعليمية",
    title: "مدرسة أو جهة تعليمية",
    description: "أبحث عن برنامج أو خدمة للمؤسسة.",
  },
];

const needs: { id: Need; title: string; description: string }[] = [
  {
    id: "أفهم نقاط القوة والاحتياج",
    title: "أفهم نقاط القوة والاحتياج",
    description: "أريد أن أعرف من أين نبدأ.",
  },
  {
    id: "أنظم الوقت والمهام",
    title: "أنظم الوقت والمهام",
    description: "أحتاج طريقة عملية للتخطيط والمتابعة.",
  },
  {
    id: "أطور التركيز والانتباه",
    title: "أطور التركيز والانتباه",
    description: "أحتاج دعمًا في التركيز والبدء والاستمرار.",
  },
  {
    id: "أبني خطة وخطوات قادمة",
    title: "أبني خطة وخطوات قادمة",
    description: "لدي هدف وأحتاج مسارًا واضحًا.",
  },
  {
    id: "أبحث عن برنامج للمؤسسة",
    title: "برنامج للمدرسة أو الجهة",
    description: "أبحث عن حل مؤسسي مناسب.",
  },
];

const dates = [
  { id: "2026-09-01", label: "الثلاثاء 1 سبتمبر" },
  { id: "2026-09-02", label: "الأربعاء 2 سبتمبر" },
  { id: "2026-09-03", label: "الخميس 3 سبتمبر" },
];

const times = ["10:00 ص", "12:00 م", "4:00 م", "6:00 م"];

const initialForm: FormData = {
  audience: "",
  need: "",
  name: "",
  email: "",
  phone: "",
  notes: "",
  date: "",
  time: "",
};

export default function BookingPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitted, setSubmitted] = useState(false);

  const progress = Math.round((step / 5) * 100);

  const selectedAudience = useMemo(
    () => audiences.find((item) => item.id === form.audience),
    [form.audience],
  );

  const selectedNeed = useMemo(
    () => needs.find((item) => item.id === form.need),
    [form.need],
  );

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const goNext = () => {
    if (step < 5) setStep((current) => current + 1);
  };

  const goBack = () => {
    if (step > 1) setStep((current) => current - 1);
  };

  const reset = () => {
    setForm(initialForm);
    setStep(1);
    setSubmitted(false);
  };

  const canContinue =
    (step === 1 && !!form.audience) ||
    (step === 2 && !!form.need) ||
    (step === 3 &&
      !!form.name.trim() &&
      !!form.email.trim() &&
      !!form.phone.trim()) ||
    (step === 4 && !!form.date && !!form.time) ||
    step === 5;

  const submitBooking = () => {
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <main className="booking-page" dir="rtl">
        <section className="booking-success">
          <div className="booking-container">
            <div className="success-card">
              <div className="success-mark">✓</div>

              <p className="booking-label">تم استلام طلبك</p>

              <h1>خطوتك الأولى بدأت.</h1>

              <p>
                شكرًا {form.name}. تم حفظ تفاصيل طلبك الأولي، وسيتم التواصل معك
                حسب البيانات التي أدخلتها.
              </p>

              <div className="summary-grid">
                <div>
                  <small>المستفيد</small>
                  <strong>{form.audience}</strong>
                </div>

                <div>
                  <small>الاحتياج</small>
                  <strong>{form.need}</strong>
                </div>

                <div>
                  <small>الموعد المقترح</small>
                  <strong>
                    {dates.find((date) => date.id === form.date)?.label} —{" "}
                    {form.time}
                  </strong>
                </div>
              </div>

              <div className="booking-actions">
                <button className="booking-primary" onClick={reset}>
                  حجز طلب جديد
                </button>

                <a className="booking-secondary" href="/">
                  العودة للرئيسية
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="booking-page" dir="rtl">
      <section className="booking-wizard-hero">
        <div className="booking-container">
          <div className="wizard-top">
            <div>
              <p className="booking-kicker">خطوة. بثقة. نحو التميز.</p>
              <h1>ابدأ رحلتك مع خُطى</h1>
              <p>
                تجربة حجز بسيطة تبدأ بفهم من نساعد، وما الذي تحتاجه، ثم نصل
                معًا إلى الخطوة المناسبة.
              </p>
            </div>

            <div className="wizard-progress-box">
              <span>رحلتك</span>
              <strong>{progress}%</strong>
              <div className="progress-bar">
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <div className="wizard-layout">
            <aside className="wizard-sidebar">
              {[
                ["01", "من أنت؟"],
                ["02", "ما الذي تحتاجه؟"],
                ["03", "بيانات التواصل"],
                ["04", "اختر الموعد"],
                ["05", "مراجعة وتأكيد"],
              ].map(([number, title], index) => (
                <div
                  key={number}
                  className={`wizard-step ${step === index + 1 ? "active" : ""} ${
                    step > index + 1 ? "done" : ""
                  }`}
                >
                  <span>{step > index + 1 ? "✓" : number}</span>
                  <strong>{title}</strong>
                </div>
              ))}
            </aside>

            <div className="wizard-card">
              {step === 1 && (
                <>
                  <p className="booking-label">01 — من أنت؟</p>
                  <h2>خلنا نبدأ من احتياجك.</h2>
                  <p className="wizard-description">
                    اختر الفئة التي تصف المستفيد حتى نوجّهك إلى المسار الأقرب.
                  </p>

                  <div className="wizard-options">
                    {audiences.map((item) => (
                      <button
                        key={item.id}
                        className={`wizard-option ${
                          form.audience === item.id ? "selected" : ""
                        }`}
                        onClick={() => update("audience", item.id)}
                      >
                        <span className="option-number">
                          {audiences.indexOf(item) + 1 < 10
                            ? `0${audiences.indexOf(item) + 1}`
                            : audiences.indexOf(item) + 1}
                        </span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.description}</small>
                        </span>
                        <b>{form.audience === item.id ? "✓" : "→"}</b>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <p className="booking-label">02 — ما الذي تحتاجه؟</p>
                  <h2>ما الخطوة التي تريد أن تبدأ منها؟</h2>
                  <p className="wizard-description">
                    اختر الاحتياج الأقرب لك. ويمكننا تعديل المسار لاحقًا بعد
                    التعرف عليك أكثر.
                  </p>

                  <div className="wizard-options">
                    {needs.map((item, index) => (
                      <button
                        key={item.id}
                        className={`wizard-option ${
                          form.need === item.id ? "selected" : ""
                        }`}
                        onClick={() => update("need", item.id)}
                      >
                        <span className="option-number">
                          {index < 9 ? `0${index + 1}` : index + 1}
                        </span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.description}</small>
                        </span>
                        <b>{form.need === item.id ? "✓" : "→"}</b>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <p className="booking-label">03 — بيانات التواصل</p>
                  <h2>أعطنا معلومات بسيطة عنك.</h2>
                  <p className="wizard-description">
                    نستخدم هذه البيانات للتواصل معك بخصوص طلبك.
                  </p>

                  <div className="form-grid">
                    <label>
                      <span>الاسم</span>
                      <input
                        value={form.name}
                        onChange={(event) =>
                          update("name", event.target.value)
                        }
                        placeholder="اكتب الاسم"
                      />
                    </label>

                    <label>
                      <span>البريد الإلكتروني</span>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(event) =>
                          update("email", event.target.value)
                        }
                        placeholder="name@example.com"
                        dir="ltr"
                      />
                    </label>

                    <label>
                      <span>رقم الجوال</span>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(event) =>
                          update("phone", event.target.value)
                        }
                        placeholder="05xxxxxxxx"
                        dir="ltr"
                      />
                    </label>

                    <label className="full-width">
                      <span>هل لديك ملاحظة أو هدف محدد؟</span>
                      <textarea
                        value={form.notes}
                        onChange={(event) =>
                          update("notes", event.target.value)
                        }
                        placeholder="اكتب أي تفاصيل تساعدنا على فهم احتياجك."
                        rows={5}
                      />
                    </label>
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <p className="booking-label">04 — اختر الموعد</p>
                  <h2>خلنا نحدد وقتًا مناسبًا للتواصل.</h2>
                  <p className="wizard-description">
                    هذه مواعيد تجريبية في النسخة الحالية. سنربطها بالتقويم
                    والحجز الحقيقي في المرحلة التالية.
                  </p>

                  <div className="date-grid">
                    {dates.map((date) => (
                      <button
                        key={date.id}
                        className={`date-card ${
                          form.date === date.id ? "selected" : ""
                        }`}
                        onClick={() => update("date", date.id)}
                      >
                        <span>موعد</span>
                        <strong>{date.label}</strong>
                        <b>{form.date === date.id ? "✓" : "اختر"}</b>
                      </button>
                    ))}
                  </div>

                  <div className="time-heading">اختر الوقت</div>

                  <div className="time-grid">
                    {times.map((time) => (
                      <button
                        key={time}
                        className={`time-card ${
                          form.time === time ? "selected" : ""
                        }`}
                        onClick={() => update("time", time)}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 5 && (
                <>
                  <p className="booking-label">05 — المراجعة والتأكيد</p>
                  <h2>مراجعة سريعة قبل إرسال الطلب.</h2>

                  <div className="review-list">
                    <div>
                      <small>المستفيد</small>
                      <strong>{selectedAudience?.title}</strong>
                    </div>

                    <div>
                      <small>الاحتياج</small>
                      <strong>{selectedNeed?.title}</strong>
                    </div>

                    <div>
                      <small>الاسم</small>
                      <strong>{form.name}</strong>
                    </div>

                    <div>
                      <small>الجوال</small>
                      <strong dir="ltr">{form.phone}</strong>
                    </div>

                    <div>
                      <small>الموعد</small>
                      <strong>
                        {dates.find((date) => date.id === form.date)?.label} —
                        {" "}
                        {form.time}
                      </strong>
                    </div>
                  </div>

                  <p className="review-note">
                    بإرسال الطلب أنت تؤكد أن البيانات المدخلة صحيحة وأن الغرض
                    من هذه الخطوة هو بدء التواصل والتعرف على الاحتياج.
                  </p>
                </>
              )}

              <div className="wizard-actions">
                <button
                  className="booking-secondary"
                  onClick={goBack}
                  disabled={step === 1}
                >
                  السابق
                </button>

                {step < 5 ? (
                  <button
                    className="booking-primary"
                    onClick={goNext}
                    disabled={!canContinue}
                  >
                    التالي ←
                  </button>
                ) : (
                  <button
                    className="booking-primary"
                    onClick={submitBooking}
                    disabled={!canContinue}
                  >
                    إرسال طلب الحجز ✓
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
