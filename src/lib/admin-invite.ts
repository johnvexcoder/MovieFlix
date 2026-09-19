import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { adminInvites, admins } from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { sendEmail } from "@/lib/email";
import { getAppPublicUrl } from "@/lib/app-settings";

const INVITE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Hash a raw invitation token (raw token is never stored). */
export function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generates a secure one-time invitation token for an admin and stores only its
 * hash. Any prior unused invite for the same admin is invalidated first.
 */
export async function createInvite(adminId: string): Promise<{ token: string; expiresAt: string }> {
  // Invalidate any outstanding (unused, not expired) invites for this admin.
  await db
    .update(adminInvites)
    .set({ invalidatedAt: new Date().toISOString() })
    .where(and(eq(adminInvites.adminId, adminId), isNull(adminInvites.usedAt), isNull(adminInvites.invalidatedAt)));

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  await db.insert(adminInvites).values({
    id: uuidv4(),
    adminId,
    tokenHash: hashInviteToken(token),
    createdAt: new Date().toISOString(),
    expiresAt,
  });
  return { token, expiresAt };
}

/** Looks up a valid (unused, unexpired, not invalidated) invite by raw token. */
export async function findValidInviteByToken(token: string) {
  const tokenHash = hashInviteToken(token);
  const [invite] = await db
    .select()
    .from(adminInvites)
    .where(eq(adminInvites.tokenHash, tokenHash))
    .limit(1);
  if (!invite) return null;
  if (invite.invalidatedAt) return { invite, state: "invalid" as const };
  if (invite.usedAt) return { invite, state: "used" as const };
  if (new Date(invite.expiresAt).getTime() <= Date.now()) return { invite, state: "expired" as const };
  return { invite, state: "valid" as const };
}

/** Marks an invite consumed (single-use). */
export async function consumeInvite(id: string) {
  await db.update(adminInvites).set({ usedAt: new Date().toISOString() }).where(eq(adminInvites.id, id));
}

export async function sendAdminInviteEmail(admin: { username: string; email: string | null }, token: string) {
  if (!admin.email) return false;
  const base = await getAppPublicUrl();
  const setupUrl = `${base}/admin-panel/setup-account?token=${encodeURIComponent(token)}`;
  const html = `<!doctype html><html><body style="margin:0;background:#050816;color:#f8fafc;font-family:Arial,sans-serif"><div style="max-width:520px;margin:auto;padding:32px"><h1>MovieFlix Admin Access Invitation</h1><p style="color:#a8b3c7">Hello ${admin.username},</p><p style="color:#a8b3c7">You have been invited to access the MovieFlix Admin Panel. Use the button below to complete your administrator account setup.</p><p style="margin:24px 0"><a href="${setupUrl}" style="display:inline-block;background:#22d3ee;color:#07101f;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:800">Set Up Admin Account</a></p><p style="color:#748096;font-size:13px">This link is valid for one use only and will expire in 24 hours. No password has been created for you — you will create your own during setup. If you were not expecting this invitation, you can ignore this email.</p><p style="color:#748096;font-size:13px">MovieFlix Admin Command</p></div></body></html>`;
  return sendEmail({ to: admin.email, subject: "MovieFlix Admin Access Invitation", html });
}

export async function sendAdminActivatedEmail(admin: { username: string; email: string | null }) {
  if (!admin.email) return false;
  const base = await getAppPublicUrl();
  const loginUrl = `${base}/admin-panel/login`;
  const html = `<!doctype html><html><body style="margin:0;background:#050816;color:#f8fafc;font-family:Arial,sans-serif"><div style="max-width:520px;margin:auto;padding:32px"><h1>Your MovieFlix Admin Account Is Ready</h1><p style="color:#a8b3c7">Hello ${admin.username},</p><p style="color:#a8b3c7">Your MovieFlix administrator account has been successfully activated. You can now sign in using your username/email and the password you created.</p><p style="margin:24px 0"><a href="${loginUrl}" style="display:inline-block;background:#22d3ee;color:#07101f;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:800">Sign In to MovieFlix Admin</a></p><p style="color:#a8b3c7">For additional account security, we recommend enabling two-step verification from System Settings → Security &amp; Recovery. Two-step verification is optional, but strongly recommended.</p><p style="color:#748096;font-size:13px">MovieFlix Admin Command</p></div></body></html>`;
  return sendEmail({ to: admin.email, subject: "Your MovieFlix Admin Account Is Ready", html });
}

/** Whether an admin can manage other admins (main admin only). */
export function isMainAdmin(role: string | null | undefined): boolean {
  return role === "main_admin";
}

/** Latest (non-invalidated) invite for an admin. */
export async function getPendingInvite(adminId: string) {
  const rows = await db
    .select()
    .from(adminInvites)
    .where(and(eq(adminInvites.adminId, adminId), isNull(adminInvites.invalidatedAt)))
    .orderBy(desc(adminInvites.createdAt))
    .limit(1);
  return rows[0] || null;
}

export async function invalidateAllInvites(adminId: string) {
  await db
    .update(adminInvites)
    .set({ invalidatedAt: new Date().toISOString() })
    .where(and(eq(adminInvites.adminId, adminId), isNull(adminInvites.invalidatedAt)));
}

export async function getAdminById(id: string) {
  const rows = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
  return rows[0] || null;
}