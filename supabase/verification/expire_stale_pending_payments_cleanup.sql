-- تنظيف يدوي منفصل — لا يُنفَّذ تلقائيًا إطلاقًا. راجع cohort_capacity_check.sql أولًا لمعرفة
-- عدد وتفاصيل الاشتراكات المتأثرة قبل تشغيل هذا الملف.
--
-- بعد هجرة 20260916_pending_payment_24h_expiry.sql، الدوال الثلاث (cohort_available_seats،
-- public_cohorts_catalog، enroll_subscription_atomic) لم تعد تحتسب pending_payment الأقدم من
-- 24 ساعة ضد السعة — لكن الصف نفسه يبقى بحالة "pending_payment" في قاعدة البيانات حتى يُحدَّث
-- صراحة. هذا الملف يُحدِّثها إلى "expired" فعليًا، لتصبح حالتها المعروضة (لو رآها أي تقرير
-- إداري لاحقًا) دقيقة، لا مجرد "غير محتسَبة ضمنيًا".
--
-- لا يمسّ active أو أي حالة أخرى إطلاقًا — الشرط صريح ومحصور بـpending_payment الأقدم من 24
-- ساعة فقط.

update subscriptions
set status = 'expired'
where status = 'pending_payment'
  and created_at < now() - interval '24 hours';
