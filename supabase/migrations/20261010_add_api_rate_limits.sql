begin;

create table public.api_rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 1 check (count > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (key, window_start)
);

alter table public.api_rate_limits enable row level security;

revoke all on table public.api_rate_limits from public, anon, authenticated;
grant select, insert, update on table public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_expires_at timestamptz;
  v_count integer;
begin
  if p_key is null
    or length(p_key) < 1
    or length(p_key) > 160
    or p_key !~ '^[a-z0-9:_-]+$'
    or p_limit is null
    or p_limit < 1
    or p_limit > 100000
    or p_window_seconds is null
    or p_window_seconds < 1
    or p_window_seconds > 86400
  then
    return query select false, 0, 1;
    return;
  end if;

  v_window_start := to_timestamp(
    (floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds)::double precision
  );
  v_expires_at := v_window_start + p_window_seconds * interval '1 second';

  insert into public.api_rate_limits as current_bucket (
    key, window_start, count, expires_at, created_at, updated_at
  ) values (
    p_key, v_window_start, 1, v_expires_at, v_now, v_now
  )
  on conflict (key, window_start) do update
    set count = case
          when current_bucket.count < 2147483647 then current_bucket.count + 1
          else current_bucket.count
        end,
        expires_at = excluded.expires_at,
        updated_at = clock_timestamp()
  returning current_bucket.count into v_count;

  return query
  select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    greatest(1, ceil(extract(epoch from (v_expires_at - clock_timestamp())))::integer);
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer)
from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer)
to service_role;

commit;
