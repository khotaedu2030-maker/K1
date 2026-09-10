"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveGradeBand, getGradeLabelArabic, GRADE_BANDS, type GradeBand } from "@/lib/grade-config";
import { formatDaysList, formatDayCount, formatSessionCount, formatSeatCount, formatCohortDisplayName } from "@/lib/plan-display";

// الكتالوج فيه منتجان الآن: motabaa (1-6) وfocus_room (7-12). هذا الربط كتالوجي/تجاري بحت —
// لا علاقة له ببنية الصف نفسها، ولذلك يبقى هنا محليًا لا داخل grade-config.ts (الذي يقتصر على
// بنية الصف فقط كما هو مقرَّر).
function productForBand(band: GradeBand): "motabaa" | "focus_room" {
  return band === "1-3" || band === "4-6" ? "motabaa" : "focus_room";
}

export type PlanRow = {
  id: string;
  product: string;
  name: string;
  day_patterns: string[];
  price_sar: number | null;
  days_per_week: number | null;
  sessions_per_month: number | null;
};

export type CohortRow = {
  id: string;
  product: string;
  plan_id: string;
  grade_band: GradeBand | null;
  title: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  seats_available: number;
};

export default function PlansSelector({ plans, cohorts }: { plans: PlanRow[]; cohorts: CohortRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // استرجاع الاختيار من رابط الصفحة (query params) إن وُجد — يحافظ على اختيار المستخدم عند
  // الرجوع من صفحة التسجيل، بلا أي client storage إضافي (لا localStorage ولا sessionStorage).
  const [grade, setGrade] = useState(() => {
    const g = Number(searchParams.get("grade"));
    return g >= 1 && g <= 12 ? g : 1;
  });
  const [planId, setPlanId] = useState<string | null>(() => searchParams.get("plan"));
  const [cohortId, setCohortId] = useState<string | null>(() => searchParams.get("cohort"));

  const gradeBand: GradeBand = resolveGradeBand(grade);
  const product = productForBand(gradeBand);

  const availablePlans = useMemo(() => plans.filter((p) => p.product === product), [plans, product]);
  const effectivePlanId = planId ?? availablePlans[0]?.id ?? null;

  const matchingCohorts = useMemo(
    () =>
      cohorts.filter(
        (c) => c.product === product && c.plan_id === effectivePlanId && c.grade_band === gradeBand
      ),
    [cohorts, product, effectivePlanId, gradeBand]
  );

  const selectedPlan = availablePlans.find((p) => p.id === effectivePlanId);
  const selectedCohort = matchingCohorts.find((c) => c.id === cohortId) ?? null;

  function selectGrade(g: number) {
    setGrade(g);
    setPlanId(null);
    setCohortId(null);
  }

  // مزامنة الاختيار الحالي مع رابط الصفحة — إن رجع المستخدم من صفحة التسجيل بزر الرجوع،
  // useState أعلاه يستعيد نفس الاختيار من الرابط نفسه بدل بدء الرحلة من جديد.
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("grade", String(grade));
    if (effectivePlanId) params.set("plan", effectivePlanId);
    if (cohortId) params.set("cohort", cohortId);
    router.replace(`/motabaa/plans?${params.toString()}`, { scroll: false });
  }, [grade, effectivePlanId, cohortId, router]);

  const step1Done = true; // الصف يُختار دائمًا (قيمة افتراضية 1) — يبقى "مكتملًا" دومًا
  const step2Done = Boolean(effectivePlanId);
  const step3Done = Boolean(cohortId);
  const currentStepNum = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : 4;
  const steps: [string, string][] = [
    ["01", "الصف"],
    ["02", "الخطة"],
    ["03", "المجموعة"],
    ["04", "التسجيل"],
  ];

  return (
    <div className="container">
      <div className="step-motif" style={{ marginBottom: 18 }}><span /><span /><span /><span /></div>
      <span className="eyebrow">خُطى</span>
      <h1 className="title">اختر اشتراك طفلك.</h1>
      <p className="lead" style={{ marginTop: 14 }}>أربع خطوات بسيطة، وتصل لصفحة التسجيل مباشرة.</p>

      <div className="stepper">
        {steps.map(([num, label], i) => {
          const stepNum = i + 1;
          const state = stepNum < currentStepNum ? "done" : stepNum === currentStepNum ? "active" : "upcoming";
          return (
            <div className={`stepper-item ${state}`} key={num}>
              <span className="stepper-num">{state === "done" ? "✓" : num}</span>
              <span className="stepper-label">{label}</span>
            </div>
          );
        })}
      </div>

      {/* بنية عمودين حقيقية على Desktop: عمود التقدّم عبر الخطوات + لوحة ملخّص ثابتة (Sticky)
          تُبنى تدريجيًا مع كل اختيار — بديل بنيوي فعلي لشريط .summary الأفقي القديم أسفل الصفحة. */}
      <div className="plans-layout">
        <div className="plans-main">
          {/* ---------- الخطوة 1: الصف ---------- */}
          <div className="plans-step-block">
            <div className="plans-step-head">
              <span className="plans-step-num">١</span>
              <h2>الصف الدراسي</h2>
            </div>
            {GRADE_BANDS.map((band) => (
              <div key={band.band} style={{ marginBottom: 22 }}>
                <span className="grade-group-label">{band.labelAr}</span>
                <div className="grade-tile-grid" style={{ marginTop: 8 }}>
                  {Array.from({ length: band.max - band.min + 1 }, (_, i) => band.min + i).map((g) => (
                    <button
                      key={g}
                      className={`grade-tile${grade === g ? " on" : ""}`}
                      onClick={() => selectGrade(g)}
                    >
                      <b>{getGradeLabelArabic(g)}</b>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ---------- الخطوة 2: الخطة ---------- */}
          <div className="plans-step-block">
            <div className="plans-step-head" id="plan-step">
              <span className="plans-step-num">٢</span>
              <h2>اختر الخطة</h2>
            </div>
            {availablePlans.length === 0 ? (
              <p style={{ color: "var(--gray)" }}>لا توجد خطط متاحة لهذا الصف حاليًا.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
                {availablePlans.map((p, i) => {
                  const recommended = i === Math.floor((availablePlans.length - 1) / 2) && availablePlans.length > 1;
                  const freq = p.days_per_week ?? 0;
                  return (
                    <button
                      key={p.id}
                      className={`plan-tile${effectivePlanId === p.id ? " on" : ""}${recommended ? " recommended" : ""}`}
                      onClick={() => {
                        setPlanId(p.id);
                        setCohortId(null);
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: 19 }}>{p.name}</h3>
                      {freq > 0 && (
                        <div className="plan-freq-dots">
                          {Array.from({ length: 7 }, (_, d) => (
                            <span key={d} className={d < freq ? "filled" : ""} />
                          ))}
                        </div>
                      )}
                      <p style={{ margin: "8px 0 0", color: "var(--gray)", fontSize: 14 }}>
                        {freq > 0 ? `${formatDayCount(freq)} أسبوعيًا` : ""}
                        {p.sessions_per_month ? ` • ${formatSessionCount(p.sessions_per_month)} شهريًا` : ""}
                      </p>
                      <div className="plan-tile-price">
                        {p.price_sar ? (
                          <>{p.price_sar} <small>ر.س / شهريًا</small></>
                        ) : (
                          <small>السعر يُعلن قريبًا</small>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ---------- الخطوة 3: المجموعة ---------- */}
          <div className="plans-step-block" style={{ marginBottom: 0 }}>
            <div className="plans-step-head">
              <span className="plans-step-num">٣</span>
              <h2>اختر المجموعة</h2>
            </div>
            {matchingCohorts.length === 0 ? (
              <div className="dashcard" style={{ textAlign: "center", padding: "28px 20px" }}>
                <p style={{ margin: 0, fontWeight: 700 }}>لا توجد مجموعة متاحة لهذه الخطة حاليًا.</p>
                <a
                  href="#plan-step"
                  className="btn outline small"
                  style={{ marginTop: 14, display: "inline-flex" }}
                  onClick={() => {
                    setPlanId(null);
                    setCohortId(null);
                  }}
                >
                  اختر خطة أخرى
                </a>
              </div>
            ) : (
              <div>
                {matchingCohorts.map((c) => (
                  <button
                    key={c.id}
                    className={`group-tile${cohortId === c.id ? " on" : ""}`}
                    disabled={c.seats_available <= 0}
                    onClick={() => setCohortId(c.id)}
                  >
                    <div>
                      <b style={{ display: "block" }}>{formatCohortDisplayName(c.title)}</b>
                      <span style={{ color: "var(--gray)", fontSize: 13 }}>
                        {c.start_time.slice(0, 5)} – {c.end_time.slice(0, 5)}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ color: "var(--n)", fontWeight: 700, fontSize: 13 }}>
                        {formatDaysList(c.days_of_week)}
                      </span>
                      <b style={{ color: c.seats_available > 0 ? "var(--t)" : "var(--p)", fontSize: 13, whiteSpace: "nowrap" }}>
                        {c.seats_available > 0 ? formatSeatCount(c.seats_available) : "مكتملة"}
                      </b>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---------- لوحة الملخص الثابتة (بديل .summary الأفقي القديم) ---------- */}
        <div className="plans-sticky">
          <h3>اختيارك</h3>
          <div className="plans-sticky-row">
            <span>الصف الدراسي</span><span>{getGradeLabelArabic(grade)}</span>
          </div>
          <div className={`plans-sticky-row${!selectedPlan ? " pending" : ""}`}>
            <span>الخطة</span><span>{selectedPlan?.name ?? "—"}</span>
          </div>
          <div className={`plans-sticky-row${!selectedCohort ? " pending" : ""}`}>
            <span>المجموعة</span><span>{selectedCohort ? formatCohortDisplayName(selectedCohort.title) : "تظهر بعد اختيار الخطة"}</span>
          </div>
          {selectedCohort && (
            <>
              <div className="plans-sticky-row">
                <span>الأيام</span>
                <span>{formatDaysList(selectedCohort.days_of_week, "، ")}</span>
              </div>
              <div className="plans-sticky-row">
                <span>الموعد</span>
                <span>{selectedCohort.start_time.slice(0, 5)}</span>
              </div>
            </>
          )}
          {selectedPlan?.price_sar && (
            <div className="plans-sticky-row" style={{ fontWeight: 800, fontSize: 19, borderBottom: 0 }}>
              <span>الاشتراك</span><span>{selectedPlan.price_sar} ر.س شهريًا</span>
            </div>
          )}

          {selectedCohort ? (
            <Link
              className="btn"
              style={{ width: "100%", justifyContent: "center", marginTop: 18 }}
              href={`/motabaa/enroll?grade=${grade}&cohort=${selectedCohort.id}`}
            >
              متابعة التسجيل ←
            </Link>
          ) : (
            <p style={{ color: "#7e8c98", fontSize: 13, marginTop: 18, textAlign: "center" }}>
              أكمل الخطوات لمتابعة التسجيل
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
