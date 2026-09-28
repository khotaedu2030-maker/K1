begin;

drop policy if exists "Anyone can create booking"
on public.bookings;

revoke select, insert, update, delete
on public.bookings
from anon, authenticated;

grant select, insert, update, delete
on public.bookings
to service_role;

commit;
