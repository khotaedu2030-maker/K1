-- سجل تدقيق خفيف لتغييرات الإدارة الحساسة (سعة المجموعة، حالة التسجيل، إسناد المعلم) — يسجّل
-- من فعل ماذا ومتى، بلا أي تعقيد إضافي. RLS مفعَّلة بلا أي policy عامة — الكتابة/القراءة فقط
-- عبر service_role من مسارات /api/admin/**. Idempotent عبر if not exists.

create table if not exists admin_actions(
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz default now()
);

alter table admin_actions enable row level security;
-- بلا أي policy إطلاقًا — service_role فقط.
