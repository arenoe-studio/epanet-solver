import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const MAINTENANCE_EXCLUDE_PREFIXES = ["/maintenance", "/_next"];
const MAINTENANCE_EXCLUDE_EXACT = ["/favicon.ico", "/api/token/webhook"];

export function middleware(request: NextRequest) {
  if (process.env.MAINTENANCE_MODE !== "true") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (MAINTENANCE_EXCLUDE_EXACT.includes(pathname)) {
    return NextResponse.next();
  }

  if (MAINTENANCE_EXCLUDE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/maintenance", request.url));
}

export const config = {
  matcher: "/:path*",
};

