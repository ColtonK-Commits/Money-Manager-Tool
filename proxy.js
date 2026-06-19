import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

export async function proxy(request) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  const { pathname } = request.nextUrl;

  // Allow login and register pages through without a session
  if (pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // If no session, redirect to login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};