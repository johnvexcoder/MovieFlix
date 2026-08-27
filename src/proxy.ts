import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/auth";

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/api/auth/account-login",
  "/api/auth/profile-login",
  "/api/auth/refresh",
  "/api/health",
];

// Admin paths that require admin authentication
const ADMIN_PATHS = ["/admin-panel"];

// Admin API paths
const ADMIN_API_PATHS = ["/api/admin"];

function isPublicPath(pathname: string): boolean {
  if (
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".webp")
  ) {
    return true;
  }
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));
}

function isAdminApiPath(pathname: string): boolean {
  return ADMIN_API_PATHS.some((path) => pathname.startsWith(path));
}

const ADMIN_AUTH_PATHS = [
  "/api/admin/auth/login",
  "/api/admin/auth/refresh",
  "/admin-panel/login",
];

function isAdminAuthPath(pathname: string): boolean {
  return ADMIN_AUTH_PATHS.some((path) => pathname.startsWith(path));
}

function extractIpSubnet(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  return ip;
}

function getRedirectUrl(path: string, request: NextRequest): URL {
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || (request.nextUrl.protocol ? request.nextUrl.protocol.replace(":", "") : "http");
  if (forwardedHost) {
    return new URL(path, `${forwardedProto}://${forwardedHost}`);
  }
  return new URL(path, request.url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Handle admin routes separately
  if (isAdminPath(pathname) || isAdminApiPath(pathname)) {
    // Allow admin login endpoint
    if (isAdminAuthPath(pathname)) {
      return NextResponse.next();
    }

    const adminToken = request.cookies.get("admin_token")?.value;

    if (!adminToken) {
      if (isAdminApiPath(pathname)) {
        return NextResponse.json(
          { error: "Admin authentication required" },
          { status: 401 }
        );
      }
      return NextResponse.redirect(getRedirectUrl("/admin-panel/login", request));
    }

    // Verify admin token
    const payload = await verifyToken(adminToken);
    if (!payload || !payload.isAdmin) {
      const response = isAdminApiPath(pathname)
        ? NextResponse.json({ error: "Invalid admin token" }, { status: 401 })
        : NextResponse.redirect(getRedirectUrl("/admin-panel/login", request));

      response.cookies.delete("admin_token");
      return response;
    }

    return NextResponse.next();
  }

  // Handle user routes
  const accessToken = request.cookies.get("access_token")?.value;

  if (!accessToken) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(getRedirectUrl("/login", request));
  }

  // Verify user token
  const payload = await verifyToken(accessToken);

  if (!payload) {
    const response = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Invalid token" }, { status: 401 })
      : NextResponse.redirect(getRedirectUrl("/login", request));

    response.cookies.delete("access_token");
    return response;
  }

  // Validate fingerprint (optional same-network policy if strict mode is enabled)
  if (process.env.SESSION_STRICT_SUBNET === "true") {
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "0.0.0.0";
    const currentSubnet = extractIpSubnet(ip);
    const storedSubnet = payload.fingerprint;

    if (storedSubnet && storedSubnet !== currentSubnet) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Profile in use on another network" },
          { status: 403 }
        );
      }
      return NextResponse.redirect(getRedirectUrl("/login", request));
    }
  }

  // Security headers
  const response = NextResponse.next();
  const isHttps = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  );
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: http: blob:; font-src 'self' data: https:; connect-src 'self' http: https: ws: wss: data: blob:; media-src 'self' data: blob: http: https:;"
  );

  if (isHttps) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
