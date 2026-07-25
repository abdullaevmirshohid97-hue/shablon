import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // admin.idaa.uz ildizini super-admin paneliga yo'naltiramiz.
  // (Uchala subdomen bitta Next jarayoniga kelgani uchun host bo'yicha ajratamiz;
  //  /admin ichida platform_admin roli baribir server tomonda tekshiriladi.)
  const hostHeader = request.headers.get('host') ?? '';
  const hostname = hostHeader.split(':')[0] ?? '';
  if (hostname.startsWith('admin.') && request.nextUrl.pathname === '/') {
    // Absolute Location'ni Host header'dan quramiz — Caddy ichki hostini (localhost)
    // emas, public domenni (admin.idaa.uz) ishlatishi uchun.
    const proto = request.headers.get('x-forwarded-proto') ?? 'https';
    return NextResponse.redirect(`${proto}://${hostHeader}/admin`);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refreshes the auth token if needed so server components get a valid session.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
