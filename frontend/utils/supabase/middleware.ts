// app/utils/supabase/middleware.ts
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// ── Safe base64url JWT decoder ────────────────────────────
function decodeJWTPayload(token: string): Record<string, any> {
  try {
    const base64 = token.split('.')[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return {}
  }
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    console.error("Missing Supabase credentials")
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("error", "missing_env_vars")
    return NextResponse.redirect(url)
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ── getUser() for secure auth verification ────────────
  // This contacts Supabase Auth server to verify the token
  const { data: { user } } = await supabase.auth.getUser()

  // ── getSession() ONLY for role extraction from JWT ────
  // We still need the access_token to decode user_role
  // This is safe because we already verified the user above
  const { data: { session } } = await supabase.auth.getSession()
  const userRole = session?.access_token
    ? decodeJWTPayload(session.access_token).user_role ?? 'doctor'
    : 'doctor'

  // ── Route flags ───────────────────────────────────────
  const path = request.nextUrl.pathname
  const isAuthPage = path.startsWith('/login') || path.startsWith('/signup')
  const isAdminPage = path.startsWith('/admin')
  const isProtectedPage =
    isAdminPage ||
    path.startsWith('/dashboard') ||
    path.startsWith('/analysis')

  // 1. Not logged in → redirect to login
  if (!user && isProtectedPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. Logged in + auth page → redirect to correct home
  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = userRole === 'admin' ? '/admin' : '/dashboard'
    return NextResponse.redirect(url)
  }

  // 3. Doctor trying to access /admin → redirect to dashboard
  if (user && isAdminPage && userRole !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}