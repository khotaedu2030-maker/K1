-- رسائل نموذج التواصل العام (/contact). Supabase هو مصدر الحقيقة لحفظ الرسالة — أي إشعار
-- بريد اختياري لاحقًا (Resend) لا يُفشِل الحفظ أبدًا إن فشل هو نفسه.
-- RLS مفعَّلة بلا أي policy عامة — الإدراج/القراءة فقط عبر service_role من
-- src/app/api/contact/route.ts. Idempotent عبر if not exists.

create table if not exists contact_requests(
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  message text not null,
  status text not null default 'new' check (status in ('new','reviewing','closed')),
  created_at timestamptz default now()
);

alter table contact_requests enable row level security;
-- بلا أي policy إطلاقًا — service_role فقط.
