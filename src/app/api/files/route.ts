import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function uploadsRoot(): string {
  const envPath = process.env.DATABASE_PATH || process.env.DATABASE_URL || "./data/database.sqlite";
  const dbPath = envPath.startsWith("file:") ? envPath.replace(/^file:/, "") : envPath;
  const baseDir = path.dirname(path.resolve(dbPath));
  return path.join(baseDir, "uploads");
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const payload = await verifyToken(accessToken);
    if (!payload) {
      return new NextResponse("Invalid token", { status: 401 });
    }

    const fileParam = request.nextUrl.searchParams.get("file");
    if (!fileParam) {
      return new NextResponse("Missing file", { status: 400 });
    }

    const root = uploadsRoot();
    const resolvedRoot = fs.existsSync(root) ? fs.realpathSync(root) : root;
    const requested = path.resolve(root, fileParam);
    const resolvedFile = fs.existsSync(requested) ? fs.realpathSync(requested) : requested;

    // Strict containment: must live inside the uploads root.
    if (!resolvedFile.startsWith(resolvedRoot + path.sep)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const ext = path.extname(resolvedFile).toLowerCase();
    if (!MIME[ext]) {
      return new NextResponse("Unsupported file type", { status: 400 });
    }

    if (!fs.existsSync(resolvedFile) || !fs.statSync(resolvedFile).isFile()) {
      return new NextResponse("File not found", { status: 404 });
    }

    const buf = fs.readFileSync(resolvedFile);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext],
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Files endpoint error:", error);
    return new NextResponse("File error", { status: 500 });
  }
}