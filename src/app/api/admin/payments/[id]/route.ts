import { NextRequest } from "next/server";
import { db } from "@/db";
import { paymentSubmissions, accounts, subscriptionPlans, promoCodes, profiles, profileSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { v4 as uuidv4 } from "uuid";
import { sendEmail } from "@/lib/email";
import { emailLayout, escapeHtml, greeting } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return errorResponse("Unauthorized", 401);
    }
    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const body = await request.json();
    const { status, extendHours } = body;

    if (!status || !["approved", "rejected"].includes(status)) {
      return errorResponse("Invalid status. Must be 'approved' or 'rejected'", 400);
    }
    const parsedExtendHours = Number(extendHours ?? 0);
    if (!Number.isFinite(parsedExtendHours) || parsedExtendHours < 0 || parsedExtendHours > 24 * 365 * 10) {
      return errorResponse("Extension must be between 0 and 87600 hours", 400);
    }

    const [existing] = await db
      .select()
      .from(paymentSubmissions)
      .where(eq(paymentSubmissions.id, id))
      .limit(1);

    if (!existing) {
      return errorResponse("Payment submission not found", 404);
    }

    if (existing.status !== "pending") {
      return errorResponse(`Payment submission is already ${existing.status}`, 400);
    }

    // Get the account to potentially extend
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, existing.accountId))
      .limit(1);

    if (!account) {
      return errorResponse("Associated account not found", 404);
    }
    const [purchasedPlan] = existing.planId ? await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, existing.planId)).limit(1) : [];
    const [appliedPromo] = existing.promoCodeId ? await db.select().from(promoCodes).where(eq(promoCodes.id, existing.promoCodeId)).limit(1) : [];

    // Update the payment submission
    const now = new Date().toISOString();
    db.transaction((tx) => {
      tx.update(paymentSubmissions).set({
        status,
        adminNote: status === "approved" ? `Approved by admin (${payload.profileId})` : `Rejected by admin (${payload.profileId})`,
        reviewedByAdminId: payload.profileId,
        updatedAt: now,
      }).where(eq(paymentSubmissions.id, id)).run();

    // If approved and extendHours provided, extend the account expiration
    const effectiveHours = purchasedPlan ? (purchasedPlan.durationHours || 0) + (appliedPromo?.bonusHours || 0) : parsedExtendHours;
    if (status === "approved" && (effectiveHours > 0 || purchasedPlan?.isLifetime)) {
      const currentExpiry = account.expiresAt ? new Date(account.expiresAt).getTime() : null;
      const nowMs = Date.now();
      let newExpiry: Date;

      if (currentExpiry && currentExpiry > nowMs) {
        // Extend from current expiration
        newExpiry = new Date(currentExpiry + effectiveHours * 60 * 60 * 1000);
      } else {
        // Extend from now (expired or no expiration)
        newExpiry = new Date(nowMs + effectiveHours * 60 * 60 * 1000);
      }

      tx.update(accounts).set({
          expiresAt: purchasedPlan?.isLifetime ? null : newExpiry.toISOString(),
          isLocked: false,
          registrationStatus: "active",
          updatedAt: now,
        }).where(eq(accounts.id, account.id)).run();
      }
      if (account.registrationStatus === "awaiting_payment_approval") {
        const existingProfiles = tx.select().from(profiles).where(eq(profiles.accountId, account.id)).all();
        if (existingProfiles.length === 0) {
          const profileId = uuidv4();
          tx.insert(profiles).values({ id: profileId, accountId: account.id, name: account.fullName || account.username, isMainProfile: true, createdAt: now, updatedAt: now }).run();
          tx.insert(profileSettings).values({ id: uuidv4(), profileId, createdAt: now, updatedAt: now }).run();
        }
      }
    });

    if (account.email) {
      void sendEmail({
        to: account.email,
        subject: status === "approved" ? "Your MovieFlix account is active" : "MovieFlix payment review update",
        html: emailLayout({
          title: status === "approved" ? "Payment approved" : "Payment requires attention",
          bodyHtml: `${greeting(escapeHtml(account.fullName || account.username))}<p>${status === "approved" ? "Your payment was approved and your MovieFlix access is now active." : "Your payment submission was not approved. Please review your payment details or contact support."}</p>`,
        }),
      });
    }

    return successResponse({
      message: `Payment submission ${status}`,
      status,
    });
  } catch (error) {
    console.error("Admin review payment submission error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return errorResponse("Unauthorized", 401);
    }
    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const [existing] = await db
      .select()
      .from(paymentSubmissions)
      .where(eq(paymentSubmissions.id, id))
      .limit(1);
    if (!existing) {
      return errorResponse("Payment submission not found", 404);
    }

    await db.delete(paymentSubmissions).where(eq(paymentSubmissions.id, id));
    return successResponse({ message: "Payment submission deleted" });
  } catch (error) {
    console.error("Admin delete payment submission error:", error);
    return errorResponse("Internal server error", 500);
  }
}
