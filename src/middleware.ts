import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function allowedOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS?.trim();
  if (!raw) return [];
  return raw.split(",").map((o) => o.trim()).filter(Boolean);
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = allowedOrigins();
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const allowed = allowedOrigins();
  if (allowed.length === 0) return NextResponse.next();

  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    for (const [k, v] of Object.entries(corsHeaders(origin))) {
      res.headers.set(k, v);
    }
    return res;
  }

  const response = NextResponse.next();
  for (const [k, v] of Object.entries(corsHeaders(origin))) {
    response.headers.set(k, v);
  }
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
