begin;

-- ============================================================
-- 1. CURRENT TABLES — client roles become read-only at grant layer
-- ============================================================

revoke insert, update, delete
on all tables in schema public
from anon, authenticated;


-- ============================================================
-- 2. FUTURE TABLES CREATED BY postgres — fail closed for writes
-- Keep SELECT behavior unchanged.
-- ============================================================

alter default privileges for role postgres in schema public
  revoke insert, update, delete on tables
  from anon, authenticated;


-- ============================================================
-- 3. REMOVE OBSOLETE DIRECT-WRITE RLS POLICIES
-- ============================================================

drop policy if exists "parents_self_insert"
on public.parents;

drop policy if exists "parents_self_update"
on public.parents;

-- Production drift cleanup:
-- settings writes already use protected server API/service-role RPC.
drop policy if exists "Admins can manage platform settings"
on public.platform_settings;

commit;
