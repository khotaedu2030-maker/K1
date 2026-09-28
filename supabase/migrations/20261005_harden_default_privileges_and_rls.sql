begin;

-- ============================================================
-- 1. FUTURE FUNCTIONS — fail closed by default
-- ============================================================

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

-- ============================================================
-- 2. EXISTING TABLES — remove unnecessary whole-table privileges
-- Does NOT revoke SELECT / INSERT / UPDATE / DELETE.
-- Does NOT change RLS.
-- Existing triggers continue to fire normally.
-- ============================================================

revoke truncate, references, trigger
on all tables in schema public
from anon, authenticated;


-- ============================================================
-- 3. FUTURE TABLES — do not grant unnecessary privileges
-- ============================================================

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables
  from anon, authenticated;

-- ============================================================
-- 4. CHILDREN — authenticated parents only need direct SELECT
-- All mutations are server/service-role controlled.
-- ============================================================

drop policy if exists "children_of_own_parent"
on public.children;

create policy "children_of_own_parent"
on public.children
for select
using (
  parent_id in (
    select id
    from public.parents
    where user_id = auth.uid()
  )
);


-- ============================================================
-- 5. MAKEUP SESSIONS
-- Parent schedule already reads these through service_role.
-- Remove broad authenticated visibility.
-- Teacher/parent ownership policies remain untouched.
-- ============================================================

drop policy if exists
  "makeup_eligible_sessions_visible_to_authenticated"
on public.sessions;

commit;
