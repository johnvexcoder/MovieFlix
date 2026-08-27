import { NextResponse } from "next/server";
import { successResponse } from "@/lib/api-response";

export async function POST() {
  const response = successResponse({ message: "Logged out" });

  // Clear admin cookies
  response.cookies.set("admin_token", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });

  response.cookies.set("admin_session", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });

  return response;
}
