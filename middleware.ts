import { NextResponse, type NextRequest } from 'next/server';

// Login is turned off: the inbox opens directly for anyone with the link.
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/login'],
};
