import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { media, myList } from "@/db/schema";
import { verifyToken } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { v4 as uuidv4 } from "uuid";

async function authenticatedProfile(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get("access_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.profileId || null;
}

export async function GET(request: NextRequest) {
  try {
    const profileId = await authenticatedProfile(request);
    if (!profileId) return errorResponse("Unauthorized", 401);
    const requestedMediaId = request.nextUrl.searchParams.get("mediaId");
    if (requestedMediaId) {
      const [entry] = await db.select({ id: myList.id }).from(myList)
        .where(and(eq(myList.profileId, profileId), eq(myList.mediaId, requestedMediaId))).limit(1);
      return successResponse({ inList: Boolean(entry) });
    }
    const items = await db.select({ media }).from(myList)
      .innerJoin(media, eq(myList.mediaId, media.id))
      .where(eq(myList.profileId, profileId)).orderBy(desc(myList.createdAt));
    return successResponse({ items: items.map((row) => row.media) });
  } catch (error) {
    console.error("Get My List error:", error);
    return errorResponse("Unable to load My List", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const profileId = await authenticatedProfile(request);
    if (!profileId) return errorResponse("Unauthorized", 401);
    const { mediaId } = await request.json();
    if (typeof mediaId !== "string" || !mediaId) return errorResponse("Media ID is required", 400);
    const [existingMedia] = await db.select({ id: media.id }).from(media).where(eq(media.id, mediaId)).limit(1);
    if (!existingMedia) return errorResponse("Media not found", 404);
    db.insert(myList).values({ id: uuidv4(), profileId, mediaId, createdAt: new Date().toISOString() })
      .onConflictDoNothing().run();
    return successResponse({ inList: true }, 201);
  } catch (error) {
    console.error("Add to My List error:", error);
    return errorResponse("Unable to add this title", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const profileId = await authenticatedProfile(request);
    if (!profileId) return errorResponse("Unauthorized", 401);
    const mediaId = request.nextUrl.searchParams.get("mediaId");
    if (!mediaId) return errorResponse("Media ID is required", 400);
    db.delete(myList).where(and(eq(myList.profileId, profileId), eq(myList.mediaId, mediaId))).run();
    return successResponse({ inList: false });
  } catch (error) {
    console.error("Remove from My List error:", error);
    return errorResponse("Unable to remove this title", 500);
  }
}
