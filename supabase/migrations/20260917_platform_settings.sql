-- إعدادات تشغيلية قابلة للتعديل من لوحة الإدارة بدل تعديل الكود مباشرة — عمودان فقط: قيم
-- محدَّدة ومطبَّعة (لا JSON حر يحرّره الأدمن كما هو). صف واحد فقط (id ثابت). RLS مفعَّلة بلا
-- أي policy عامة — service_role فقط عبر /api/admin/settings.

create table if not exists platform_settings(
  id boolean primary key default true check (id = true), -- يضمن صفًا واحدًا فقط ببنية بسيطة
  default_session_duration_minutes smallint not null default 45,
  makeup_monthly_limit smallint not null default 2,
  pause_min_days smallint not null default 7,
  pause_max_days smallint not null default 30,
  booking_window_days smallint not null default 14,
  quiet_hours_start time not null default '21:00',
  quiet_hours_end time not null default '08:00',
  support_email text,
  support_phone text,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

insert into platform_settings (id) values (true) on conflict (id) do nothing;

alter table platform_settings enable row level security;
-- بلا أي policy إطلاقًا — service_role فقط.

-- تحديث ذرّي وحيد مسموح به — يتحقق من نطاقات معقولة قبل الحفظ (خط دفاع ثانٍ خلف تحقق الـAPI).
create or replace function public.admin_update_platform_settings(
  p_admin_user_id uuid,
  p_default_session_duration_minutes smallint,
  p_makeup_monthly_limit smallint,
  p_pause_min_days smallint,
  p_pause_max_days smallint,
  p_booking_window_days smallint,
  p_quiet_hours_start time,
  p_quiet_hours_end time,
  p_support_email text,
  p_support_phone text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_default_session_duration_minutes not between 15 and 180 then
    raise exception 'invalid_session_duration';
  end if;
  if p_makeup_monthly_limit not between 0 and 10 then
    raise exception 'invalid_makeup_limit';
  end if;
  if p_pause_min_days < 1 or p_pause_max_days < p_pause_min_days or p_pause_max_days > 180 then
    raise exception 'invalid_pause_range';
  end if;
  if p_booking_window_days not between 1 and 90 then
    raise exception 'invalid_booking_window';
  end if;

  update platform_settings set
    default_session_duration_minutes = p_default_session_duration_minutes,
    makeup_monthly_limit = p_makeup_monthly_limit,
    pause_min_days = p_pause_min_days,
    pause_max_days = p_pause_max_days,
    booking_window_days = p_booking_window_days,
    quiet_hours_start = p_quiet_hours_start,
    quiet_hours_end = p_quiet_hours_end,
    support_email = p_support_email,
    support_phone = p_support_phone,
    updated_at = now(),
    updated_by = p_admin_user_id
  where id = true;
end;
$$;
revoke all on function public.admin_update_platform_settings(uuid, smallint, smallint, smallint, smallint, smallint, time, time, text, text) from public, anon, authenticated;
grant execute on function public.admin_update_platform_settings(uuid, smallint, smallint, smallint, smallint, smallint, time, time, text, text) to service_role;
