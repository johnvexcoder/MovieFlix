import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getSignupAccount } from "@/lib/registration";
import { db } from "@/db";
import { signupSessions } from "@/db/schema";
import { eq } from "drizzle-orm";

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
    const adminToken = request.cookies.get("admin_token")?.value;
    // Accept either a regular user session (account receipt uploads) or an
    // admin session (admin-panel uploads like payment-method icon/QR images).
    // Non-admin tokens are fine for the generic upload; the third-party caller
    // decides where to store the file.
    const formData = await request.formData();
    const auth = accessToken || adminToken;
    const signupToken = String(formData.get("signupToken") || "");
    const payload = auth ? await verifyToken(auth) : null;
    const signup = !payload && signupToken ? await getSignupAccount(signupToken) : null;
    if (!payload && !signup) return errorResponse("Not authenticated", 401);
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
    if (signup) {
      await db.update(signupSessions).set({ receiptPath: relPath }).where(eq(signupSessions.id, signup.session.id));
    }

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
