-- Per-administrator metadata review cursor for the administration sidebar.
-- This does NOT mark any parent/teacher message as read.
-- No authenticated/anon API grants and no client RLS policies; only the
-- server-side Supabase service-role can read/write after RBAC validation.
create table if not exists public.admin_navigation_seen (
  admin_id uuid primary key references public.admins(id) on delete cascade,
  messages_reviewed_at timestamptz not null default '1970-01-01 00:00:00+00',
  updated_at timestamptz not null default now()
);
alter table public.admin_navigation_seen enable row level security;
revoke all on table public.admin_navigation_seen from anon, authenticated;
comment on table public.admin_navigation_seen is
  'Administrative review cursor for message metadata; not a messaging read receipt.';
