-- Idempotent singleton seed for the KHOTA Admin OS settings table.
-- Do not reset any settings an administrator has already customized.
-- Seed values match the current runtime fallback rules; the quiet-hours start
-- is explicitly 20:00 to avoid a silent change when activating the table.
-- The table and audited RPC are created by phase9 production reconciliation.
insert into public.admin_platform_settings (
  id, registration_enabled, seat_hold_hours, attendance_lock_hours,
  default_capacity_1_3, default_capacity_4_6,
  default_capacity_7_9, default_capacity_10_12,
  pause_min_days, pause_max_days, makeup_monthly_limit,
  quiet_hours_start, quiet_hours_end
) values (
  true, true, 24, 24,
  3, 4, 5, 5,
  7, 28, 2,
  '20:00'::time, '08:00'::time
)
on conflict (id) do nothing;
