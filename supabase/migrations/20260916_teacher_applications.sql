-- طلبات الانضمام كمعلم من /teach-with-khota — Teacher application ≠ teacher access. لا يُنشأ
-- حساب معلم تلقائيًا؛ هذا سجل طلب يراجعه الفريق يدويًا (عبر /admin/teacher-applications).
--
-- RLS مفعَّلة بلا أي policy عامة — الإدراج والقراءة فقط عبر service_role من
-- src/app/api/teacher-applications/route.ts و src/app/admin/teacher-applications/**.
-- Idempotent عبر if not exists.

create table if not exists teacher_applications(
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  specialization text not null,
  years_experience smallint,
  cv_url text,
  status text not null default 'new' check (status in ('new','reviewing','shortlisted','rejected','accepted')),
  created_at timestamptz default now()
);

alter table teacher_applications enable row level security;
-- بلا أي policy إطلاقًا — لا anon ولا authenticated يقرأ/يكتب هذا الجدول مباشرة، service_role فقط.
