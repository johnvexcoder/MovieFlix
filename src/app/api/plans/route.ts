import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptionPlans } from "@/db/schema";
import { successResponse, errorResponse } from "@/lib/api-response";
export const dynamic = "force-dynamic";
export async function GET() { try {
  const plans = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true)).orderBy(asc(subscriptionPlans.sortOrder)).limit(4);
  return successResponse({ plans: plans.map(p => { const active = p.discountAmount > 0 && (!p.discountUntil || Date.parse(p.discountUntil) >= Date.now()); const finalPrice = Math.max(0, p.price - (active ? p.discountAmount : 0)); return { ...p, finalPrice, percentOff: p.price > 0 ? Math.round((p.price-finalPrice)/p.price*100) : 0 }; }) });
} catch (error) { console.error(error); return errorResponse("Unable to load plans", 500); } }
