// Next.js 16 Proxy (formerly Middleware): optimistic admin check.
// It only reads and verifies the signed session cookie. The admin page, /api/ingest and
// the saveDocument server action re-check the session themselves (never rely on this alone).
import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_SESSION_COOKIE, isAdminSession } from '@/lib/admin-session'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === '/admin/login') return NextResponse.next()

  if (await isAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/admin/login', request.url))
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/ingest', '/api/ingest/:path*'],
}
