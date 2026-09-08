import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { accounts, paymentMethods, paymentSubmissions, profiles, profileSettings, promoCodes, signupSessions } from "@/db/schema";
import { successResponse, errorResponse } from "@/lib/api-response";
import { calculateQuote } from "@/lib/registration";
import { sendEmail } from "@/lib/email";
import { emailLayout, escapeHtml, greeting } from "@/lib/email-templates";

export async function POST(request: Request) { try {
  const b=await request.json(); const quote=await calculateQuote(String(b.signupToken||""),String(b.planId||""),b.promoCode);
  if("error" in quote) return errorResponse(quote.error || "Invalid registration",quote.status);
  if(b.action==="quote") return successResponse({plan:quote.plan,originalPrice:quote.originalPrice,amount:quote.amount,totalDiscount:quote.totalDiscount,percentOff:quote.percentOff,promoApplied:Boolean(quote.promo),forcedPlanId:quote.promo?.forcedPlanId||null});
  const now=new Date().toISOString(), account=quote.signup.account;
  const reservePromo = (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => {
    if (!quote.promo) return;
    const result = tx.update(promoCodes).set({uses:sql`${promoCodes.uses} + 1`,updatedAt:now})
      .where(and(eq(promoCodes.id,quote.promo.id),eq(promoCodes.isActive,true),or(isNull(promoCodes.maxUses),lt(promoCodes.uses,promoCodes.maxUses)))).run();
    if (result.changes !== 1) throw new Error("Promotion is no longer available");
  };
  const claimCheckout = (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => {
    const result = tx.update(signupSessions).set({completedAt:now})
      .where(and(eq(signupSessions.id,quote.signup.session.id),isNull(signupSessions.completedAt))).run();
    if (result.changes !== 1) throw new Error("Registration was already submitted");
  };
  if(quote.amount===0){
    const profileId=uuidv4();
    db.transaction(tx=>{
      claimCheckout(tx);
      reservePromo(tx);
      const expiresAt=quote.plan.isLifetime?null:new Date(Date.now()+((quote.plan.durationHours||0)+(quote.promo?.bonusHours||0))*3600000).toISOString();
      tx.update(accounts).set({isLocked:false,registrationStatus:"active",durationHours:quote.plan.durationHours,expiresAt,updatedAt:now}).where(eq(accounts.id,account.id)).run();
      tx.insert(profiles).values({id:profileId,accountId:account.id,name:account.fullName||account.username,isMainProfile:true,createdAt:now,updatedAt:now}).run();
      tx.insert(profileSettings).values({id:uuidv4(),profileId,createdAt:now,updatedAt:now}).run();
    });
    void sendEmail({to:account.email!,subject:"Your MovieFlix account is ready",html:emailLayout({title:"Registration confirmed",bodyHtml:`${greeting(escapeHtml(account.fullName||account.username))}<p>Your plan is active. You can now sign in to MovieFlix.</p>`})});
    return successResponse({status:"active",message:"Registration complete. Your account is ready."});
  }
  const paymentMethodId=String(b.paymentMethodId||""),senderName=String(b.senderName||"").trim(),senderAccountNumber=String(b.senderAccountNumber||"").trim(),referenceNumber=String(b.referenceNumber||"").trim(),receiptPath=String(b.receiptPath||"");
  const [method]=await db.select().from(paymentMethods).where(eq(paymentMethods.id,paymentMethodId)).limit(1);
  if(!method?.isActive||!senderName||!senderAccountNumber||!referenceNumber||!receiptPath||quote.signup.session.receiptPath!==receiptPath) return errorResponse("Complete all payment fields and upload the receipt",400);
  db.transaction(tx=>{
    claimCheckout(tx);
    tx.insert(paymentSubmissions).values({id:uuidv4(),accountId:account.id,paymentMethodId,senderName,senderAccountNumber,amount:quote.amount,referenceNumber,receiptPath,planId:quote.plan.id,promoCodeId:quote.promo?.id||null,status:"pending",createdAt:now,updatedAt:now}).run();
    tx.update(accounts).set({registrationStatus:"awaiting_payment_approval",durationHours:quote.plan.durationHours,updatedAt:now}).where(eq(accounts.id,account.id)).run();
    reservePromo(tx);
  });
  void sendEmail({to:account.email!,subject:"MovieFlix registration received",html:emailLayout({title:"Waiting for payment approval",bodyHtml:`${greeting(escapeHtml(account.fullName||account.username))}<p>Your registration and payment proof were received. We will email you after administrator approval.</p>`})});
  return successResponse({status:"pending",message:"Payment submitted for administrator approval."},201);
} catch(error){console.error("Registration checkout error",error);return errorResponse("Checkout could not be completed",500);} }
