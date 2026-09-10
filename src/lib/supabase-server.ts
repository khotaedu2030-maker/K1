// عميل Supabase على الخادم (Server Components / Route Handlers) — يحمل جلسة المستخدم المسجّل دخوله
// عبر الكوكيز، ويخضع لسياسات RLS كما لو كان المستخدم نفسه يستعلم من المتصفح.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // يُستدعى أحيانًا من Server Component لا يملك صلاحية الكتابة على الكوكيز — يمكن تجاهله بأمان
          }
        },
      },
    }
  );
}
