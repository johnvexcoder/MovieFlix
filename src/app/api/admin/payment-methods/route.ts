import { NextRequest } from "next/server";
import { db } from "@/db";
import { paymentMethods, paymentSubmissions } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return errorResponse("Unauthorized", 401);
    }
    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const methods = await db.select().from(paymentMethods).orderBy(asc(paymentMethods.sortOrder));
    return successResponse({
      methods: methods.map((m) => ({
        id: m.id,
        name: m.name,
        accountNumber: m.accountNumber,
        iconPath: m.iconPath,
        qrPath: m.qrPath,
        isActive: m.isActive,
        sortOrder: m.sortOrder,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error("Admin list payment methods error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return errorResponse("Unauthorized", 401);
    }
    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const body = await request.json();
    const { name, accountNumber, iconPath, qrPath, isActive } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return errorResponse("Method name is required", 400);
    }
    if (!accountNumber || typeof accountNumber !== "string" || !accountNumber.trim()) {
      return errorResponse("Account number is required", 400);
    }

    const now = new Date().toISOString();
    const id = uuidv4();
    await db.insert(paymentMethods).values({
      id,
      name: name.trim(),
      accountNumber: accountNumber.trim(),
      iconPath: typeof iconPath === "string" ? iconPath : null,
      qrPath: typeof qrPath === "string" ? qrPath : null,
      isActive: typeof isActive === "boolean" ? isActive : true,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    });

    return successResponse({ method: { id } }, 201);
  } catch (error) {
    console.error("Create payment method error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return errorResponse("Unauthorized", 401);
    }
    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const body = await request.json();
    const { id, name, accountNumber, iconPath, qrPath, isActive, sortOrder } = body;

    if (!id || typeof id !== "string") {
      return errorResponse("Method ID is required", 400);
    }

    const [existing] = await db.select().from(paymentMethods).where(eq(paymentMethods.id, id)).limit(1);
    if (!existing) {
      return errorResponse("Payment method not found", 404);
    }

    await db
      .update(paymentMethods)
      .set({
        name: typeof name === "string" && name.trim() ? name.trim() : existing.name,
        accountNumber:
          typeof accountNumber === "string" && accountNumber.trim()
            ? accountNumber.trim()
            : existing.accountNumber,
        iconPath: typeof iconPath === "string" ? iconPath : existing.iconPath,
        qrPath: typeof qrPath === "string" ? qrPath : existing.qrPath,
        isActive: typeof isActive === "boolean" ? isActive : existing.isActive,
        sortOrder: typeof sortOrder === "number" ? sortOrder : existing.sortOrder,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(paymentMethods.id, id));

    return successResponse({ message: "Payment method updated" });
  } catch (error) {
    console.error("Update payment method error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return errorResponse("Unauthorized", 401);
    }
    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return errorResponse("Method ID is required", 400);
    }

    const [existing] = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.id, id))
      .limit(1);
    if (!existing) {
      return errorResponse("Payment method not found", 404);
    }

    // payment_submissions.payment_method_id references this row (FK), so delete
    // those first inside a transaction to avoid a constraint failure.
    await db.transaction(async (tx) => {
      await tx.delete(paymentSubmissions).where(eq(paymentSubmissions.paymentMethodId, id));
      await tx.delete(paymentMethods).where(eq(paymentMethods.id, id));
    });

    return successResponse({ message: "Payment method deleted" });
  } catch (error) {
    console.error("Delete payment method error:", error);
    return errorResponse("Internal server error", 500);
  }
}