# KHOTA V2 — الهيكل

## المبدأ
منصة لها منتج رئيسي واضح (خُطى متابعة) وذراعا نمو (English، قدرات) —
وليست "أكاديمية فيها عشرات الخدمات". ولي الأمر هو العميل الأساسي.

## خريطة الصفحات

```
/
├── /motabaa  ★ المنتج الأساسي
│   ├── /how-it-works
│   ├── /grades-1-3
│   ├── /grades-4-6
│   ├── /plans
│   └── /enroll
├── /english
│   ├── /kids
│   ├── /adults
│   ├── /level-test   (?track=general|schools|business)
│   ├── /programs
│   └── /private
├── /qudurat
│   ├── /quantitative
│   ├── /verbal
│   ├── /comprehensive
│   ├── /programs
│   └── /private
├── /start /about /teachers /teach-with-khota /help /contact /login
├── /parent  (children, schedule, reports, recommendations, subscriptions, payments)
├── /teacher (schedule, students, session-report)
└── /admin   (students, parents, teachers, groups, sessions, programs, subscriptions, payments, reports)
```

## خُطى متابعة
60 دقيقة: 50 للطالب + 10 للتقرير. الصفوف 1–3 حتى 3 طلاب، والصفوف 4–6 حتى 4.
Zero-password architecture.

## English
Cohort-first: level test → CEFR level → cohort → checkout. الفردي Premium request.

## قدرات
كمي/لفظي/شامل جماعي، والفردي Premium request.

## الهوية البصرية
- الألوان والخطوط (Cairo/Poppins) والشعار مطبّقة حسب دليل الهوية v1.01 — التفاصيل في README.
- نظام تصميم موحّد عبر كل الصفحات بلا استثناء (لا Tailwind، لا أنظمة تصميم متعددة).

## البيانات
Parent → Child → Subscription → Cohort → Session → Daily Pulse → Recommendation.
