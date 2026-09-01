import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
    }

    const allAccounts = await db.select({
      id: accounts.id,
      username: accounts.username,
      lastIp: accounts.lastIp,
      lastLoginAt: accounts.lastLoginAt,
      createdAt: accounts.createdAt,
    }).from(accounts);

    const accountsWithIp = allAccounts.map((a) => ({
      id: a.id,
      username: a.username,
      lastIp: a.lastIp,
      lastLoginAt: a.lastLoginAt,
      createdAt: a.createdAt,
      location: null,
    }));

    return NextResponse.json({
      success: true,
      data: { accounts: accountsWithIp },
    });
  } catch (error) {
    console.error("Admin IP info error:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error",
    }, { status: 500 });
  }
}