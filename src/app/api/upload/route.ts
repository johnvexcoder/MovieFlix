import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function uploadsRoot(): string {
  const envPath = process.env.DATABASE_PATH || process.env.DATABASE_URL || "./data/database.sqlite";
  const dbPath = envPath.startsWith("file:") ? envPath.replace(/^file:/, "") : envPath;
  const baseDir = path.dirname(path.resolve(dbPath));
  return path.join(baseDir, "uploads");
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return errorResponse("Not authenticated", 401);
    }
    const payload = await verifyToken(accessToken);
    if (!payload) {
      return errorResponse("Invalid token", 401);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return errorResponse("No file uploaded", 400);
    }

    const ext = path.extname(file.name || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return errorResponse("Only images are allowed (png, jpg, jpeg, webp, gif)", 400);
    }
    if ((file as File).size > MAX_FILE_SIZE) {
      return errorResponse("File is too large (max 5 MB)", 400);
    }

    const root = uploadsRoot();
    await fs.mkdir(path.join(root, "payments"), { recursive: true });

    const name = `${crypto.randomBytes(16).toString("hex")}${ext}`;
    const relPath = `payments/${name}`;
    const absPath = path.join(root, relPath);

    const buffer = Buffer.from(await (file as File).arrayBuffer());
    await fs.writeFile(absPath, buffer);

    // Store only the relative path; the /api/files route resolves it against the
    // uploads root with realpath containment.
    return successResponse({
      url: `/api/files?file=${encodeURIComponent(relPath)}`,
      name: file.name,
    }, 201);
  } catch (error) {
    console.error("Upload error:", error);
    return errorResponse("Internal server error", 500);
  }
}