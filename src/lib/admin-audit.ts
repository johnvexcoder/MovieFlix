import { v4 as uuidv4 } from "uuid";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLog } from "@/db/schema";

/**
 * Writes an entry to the admin audit log. Secrets (passwords, OTP codes, raw
 * recovery codes) are never stored — only the action and a short detail string.
 */
export async function logAdminAudit(input: {
  adminId?: string | null;
  actor?: string | null;
  action: string;
  detail?: string | null;
  ip?: string | null;
}) {
  try {
    await db.insert(adminAuditLog).values({
      id: uuidv4(),
      adminId: input.adminId || null,
      actor: input.actor || null,
      action: input.action,
      detail: input.detail || null,
      ip: input.ip || null,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Audit log write error:", error);
  }
}

/** Returns the most recent audit entries (newest first). */
export async function getAdminAuditLog(limit = 100) {
  return db
    .select({
      id: adminAuditLog.id,
      actor: adminAuditLog.actor,
      action: adminAuditLog.action,
      detail: adminAuditLog.detail,
      ip: adminAuditLog.ip,
      createdAt: adminAuditLog.createdAt,
    })
    .from(adminAuditLog)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit);
}