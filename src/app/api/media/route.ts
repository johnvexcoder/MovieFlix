import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { media, watchHistory } from "@/db/schema";
import { eq, and, desc, sql, like } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return errorResponse("Unauthorized", 401);
    }

    const payload = await verifyToken(accessToken);
    if (!payload) {
      return errorResponse("Invalid token", 401);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const type = searchParams.get("type");
    const genre = searchParams.get("genre");
    const year = searchParams.get("year");
    const search = searchParams.get("q");
    const sort = searchParams.get("sort") || "createdAt";
    const order = searchParams.get("order") || "desc";

    const offset = (page - 1) * limit;

    // Build query
    const conditions = [];

    if (type) {
      conditions.push(eq(media.type, type));
    }

    if (genre) {
      conditions.push(sql`json_each.value = ${genre}`);
    }

    if (year) {
      conditions.push(eq(media.year, parseInt(year)));
    }

    if (search) {
      conditions.push(sql`${media.title} LIKE ${`%${search}%`}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get media
    const results = await db
      .select()
      .from(media)
      .where(whereClause)
      .orderBy(order === "desc" ? desc(media.createdAt) : media.createdAt)
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(media)
      .where(whereClause);

    const total = countResult[0]?.count || 0;

    return successResponse({
      media: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get media error:", error);
    return errorResponse("Internal server error", 500);
  }
}
