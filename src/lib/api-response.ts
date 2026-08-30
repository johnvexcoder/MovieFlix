import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";

export function successResponse<T>(data: T, status: number = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

// Stable, machine-readable error codes. Clients can branch on these without
// parsing human strings; codes are additive and never change meaning once
// shipped (internal codes existing before this rollout have no `code` field).
export const ERROR_CODES = {
  AUTHENTICATION_EXPIRED: "AUTHENTICATION_EXPIRED",
  FORBIDDEN: "FORBIDDEN",
  RATE_LIMITED: "RATE_LIMITED",
  NETWORK_ERROR: "NETWORK_ERROR",
  SERVER_ERROR: "SERVER_ERROR",
  PROFILE_IN_USE: "PROFILE_IN_USE",
  ACCOUNT_SESSION_LIMIT: "ACCOUNT_SESSION_LIMIT",
  PIN_INVALID: "PIN_INVALID",
  PIN_REQUIRED: "PIN_REQUIRED",
  PIN_LOCKOUT: "PIN_LOCKOUT",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  MEDIA_UNPLAYABLE: "MEDIA_UNPLAYABLE",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export function errorResponse(
  error: string,
  status: number = 400,
  code?: ErrorCode
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(code ? { code } : {}),
    },
    { status }
  );
}

export function notFoundResponse(resource: string = "Resource"): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    {
      success: false,
      error: `${resource} not found`,
    },
    { status: 404 }
  );
}

export function unauthorizedResponse(
  message: string = "Authentication required"
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status: 401 }
  );
}

export function forbiddenResponse(
  message: string = "Access denied"
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status: 403 }
  );
}

export function rateLimitResponse(
  retryAfter: number,
  code: ErrorCode = ERROR_CODES.RATE_LIMITED,
  message: string = "Too many requests"
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
    },
    {
      status: 429,
      headers: {
        "Retry-After": retryAfter.toString(),
      },
    }
  );
}
