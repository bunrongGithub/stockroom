import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * ឯកសារនេះត្រូវដាក់នៅ Root Folder (ក្រៅគេបង្អស់)
 * ទីតាំង៖ ICASE-POS/middleware.ts
 */

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // ទាញយកព័ត៌មានពី Environment Variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // បញ្ឈប់ការដាច់កម្មវិធី ប្រសិនបើរកមិនឃើញ Key
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("❌ Error: រកមិនឃើញ Supabase URL ឬ Key ក្នុងឯកសារ .env.local ទេ។ សូមពិនិត្យមើលម្ដងទៀត!");
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // ផ្ទៀងផ្ទាត់ User Session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === '/login';

  // បើមិនទាន់ Login ហើយព្យាយាមចូលទៅកាន់ Dashboard
  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // បើ Login រួចហើយ មិនឱ្យចូលទំព័រ Login ទៀតទេ
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};