// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'

const PUBLIC_PATHS = [
  '/login', '/register',
  '/api/auth/login', '/api/auth/register', '/api/auth/logout',
  '/api/matches/finalize', '/api/matches/sync', '/api/matches/fix-times',
  '/api/seed', '/api/matches/cleanup',
  '/_next/static', '/_next/image', '/favicon',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check public paths first (fast path)
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Protected routes — require session
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  } catch {
    // Se der erro ao verificar sessão, redireciona para login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}