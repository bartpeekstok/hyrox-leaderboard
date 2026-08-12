import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ONLY = process.env.NEXT_PUBLIC_PUBLIC_ONLY === "true";

export function proxy(request: NextRequest) {
  if (!PUBLIC_ONLY) return NextResponse.next();

  const path = request.nextUrl.pathname;
  if (
    path.startsWith("/admin") ||
    path.startsWith("/race") ||
    path.startsWith("/finishfoto")
  ) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/race/:path*", "/finishfoto/:path*"],
};
