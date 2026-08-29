import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { accounts, profiles, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, hashPassword } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { sendEmail } from "@/lib/email";
import { revokeTokenVersion } from "@/lib/redis";

const revokeAccountSessions = async (accountId: string) => {
  const accountProfiles = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.accountId, accountId));

  for (const profile of accountProfiles) {
    await db.delete(sessions).where(eq(sessions.profileId, profile.id));
    await revokeTokenVersion(profile.id);
  }
};

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

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id))
      .limit(1);

    if (!account) {
      return errorResponse("Account not found", 404);
    }

    const body = await request.json();
    const { additionalHours, newPassword, isLocked } = body;

    if (isLocked !== undefined) {
      await db
        .update(accounts)
        .set({
          isLocked,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(accounts.id, id));

      // When locking, immediately revoke all of the account's active sessions so
      // existing users are cut off right away (not just on their next login).
      if (isLocked) {
        await revokeAccountSessions(id);
      }

      return successResponse({
        account: {
          id: account.id,
          username: account.username,
          isLocked,
        },
      });
    }

    if (newPassword !== undefined) {
      if (
        typeof newPassword !== "string" ||
        newPassword.length < 6
      ) {
        return errorResponse("Password must be at least 6 characters", 400);
      }

      const passwordHash = await hashPassword(newPassword);
      await db
        .update(accounts)
        .set({
          passwordHash,
          mustChangePassword: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(accounts.id, id));

      // Never send the plaintext password over email. Mark the account so the
      // user is forced to set a new password on their next login, and revoke
      // existing sessions so the old credential cannot be reused.
      await revokeAccountSessions(id);

      if (account.email) {
        await sendEmail({
          to: account.email,
          subject: "Your MovieFlix Password has been Reset",
          html: `
            <div style="max-width:600px; margin:0 auto; font-family:Arial,sans-serif;">
              <div style="text-align:center; padding:20px 0;">
                <img src="https://static.netflix.com/assets.netflix.com/sites/netflix/assets/branding/logo-red-4K-600x320.png"
                  alt="MovieFlix" style="max-height:40px;" />
              </div>
              <h1 style="color:#e50914; margin:20px 0 10px;">Hi ${account.username}!</h1>
              <p>Your MovieFlix account password was reset by an administrator for security reasons.</p>
              <p>You will be required to set a new password the next time you log in.</p>
              <p>If you did not request this, please contact support immediately.</p>
              <hr style="margin:30px 0; border-color:#eee;" />
              <p style="font-size:12px; color:#666;;">Need help? Email us at support@movieflix.stream</p>
              <img src="https://static.netflix.com/assets.netflix.com/sites/netflix/assets/branding/logo-red-4K-600x320.png"
                alt="MovieFlix" style="display:block; margin:20px auto 0; max-height:40px;" />
            </div>
          `,
        });
      }

      return successResponse({
        account: {
          id: account.id,
          username: account.username,
          passwordReset: true,
        },
      });
    }

    if (!additionalHours || additionalHours <= 0) {
      return errorResponse("Additional hours must be a positive number", 400);
    }

    // Calculate new expiry
    let newExpiresAt: string | null = null;
    if (account.expiresAt) {
      // Extend from current expiry
      const current = new Date(account.expiresAt);
      current.setHours(current.getHours() + additionalHours);
      newExpiresAt = current.toISOString();
    } else {
      // Account never expires, set expiry from now
      const current = new Date();
      current.setHours(current.getHours() + additionalHours);
      newExpiresAt = current.toISOString();
    }

    await db
      .update(accounts)
      .set({
        expiresAt: newExpiresAt,
        durationHours: (account.durationHours || 0) + additionalHours,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(accounts.id, id));

    return successResponse({
      account: {
        id: account.id,
        username: account.username,
        expiresAt: newExpiresAt,
        isActive: new Date(newExpiresAt) > new Date(),
      },
    });
  } catch (error) {
    console.error("Update account error:", error);
    return errorResponse("Internal server error", 500);
  }
}