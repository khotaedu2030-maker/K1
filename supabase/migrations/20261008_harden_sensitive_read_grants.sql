begin;

-- Anonymous clients do not need direct reads on sensitive tables.
revoke select
on table
  public.payments,
  public.admins,
  public.admin_actions,
  public.messages,
  public.teachers,
  public.parents,
  public.children,
  public.sessions
from anon;

-- These sensitive tables are consumed only through trusted server/service-role paths.
revoke select
on table
  public.admins,
  public.admin_actions,
  public.payments
from authenticated;

-- Direct authenticated admin-row lookup is no longer used;
-- admin identity checks use protected server/service-role code.
drop policy if exists "admins_self_select"
on public.admins;

-- Parent payment reads currently use trusted server/service-role paths.
drop policy if exists "payments_of_own_parent"
on public.payments;

commit;
