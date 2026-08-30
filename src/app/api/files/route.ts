import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { eq, and, or } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { db } from "@/db";
import { paymentSubmissions, paymentMethods } from "@/db/schema";

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
    // Accept either a user session (access_token) OR the admin session
    // (admin_token). The shared-auth proxy passes both through to this route.
    const accessToken = request.cookies.get("access_token")?.value;
    const adminToken = request.cookies.get("admin_token")?.value;
    const token = adminToken || accessToken;
    if (!token) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const payload = await verifyToken(token);
    if (!payload) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const fileParam = request.nextUrl.searchParams.get("file");
    if (!fileParam) {
      return new NextResponse("Missing file", { status: 400 });
    }

    // Ownership check. Admins may read any file under the uploads root (they
    // manage receipts, payment-method icons and QR codes), while a regular
    // account may only read files that belong to it: its own payment
    // submissions' receipt images, or currently-active payment method icons.
    if (!payload.isAdmin) {
      const [ownReceipt] = await db
        .select({ id: paymentSubmissions.id })
        .from(paymentSubmissions)
        .where(
          and(
            eq(paymentSubmissions.accountId, payload.accountId),
            eq(paymentSubmissions.receiptPath, fileParam)
          )
        )
        .limit(1);

      if (!ownReceipt) {
        const [activeMethod] = await db
          .select({ id: paymentMethods.id })
          .from(paymentMethods)
          .where(
            and(
              eq(paymentMethods.isActive, true),
              or(
                eq(paymentMethods.iconPath, fileParam),
                eq(paymentMethods.qrPath, fileParam)
              )
            )
          )
          .limit(1);

        if (!activeMethod) {
          return new NextResponse("Forbidden", { status: 403 });
        }
      }
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