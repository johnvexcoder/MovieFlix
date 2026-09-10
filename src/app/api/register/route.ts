import crypto from "crypto";
import { eq, or, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db"; import { accounts, signupSessions } from "@/db/schema";
import { hashPassword } from "@/lib/auth"; import { successResponse, errorResponse } from "@/lib/api-response";
import { hashSignupToken } from "@/lib/registration"; import { setRateLimit } from "@/lib/redis";
export async function POST(request: Request) { try {
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"local";
  if (!(await setRateLimit(`register:${ip}`,3600000,8)).allowed) return errorResponse("Too many registration attempts",429);
  const b=await request.json(); const username=String(b.username||"").trim().toLowerCase(), fullName=String(b.fullName||"").trim(), dateOfBirth=String(b.dateOfBirth||""), contactNumber=String(b.contactNumber||"").trim(), email=String(b.email||"").trim().toLowerCase(), password=String(b.password||"");
  if(!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) return errorResponse("Username must be 3–32 letters, numbers, dots, dashes, or underscores",400);
  if(fullName.length<2||fullName.length>100) return errorResponse("Enter your full name",400);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)||Date.parse(`${dateOfBirth}T00:00:00`)>=Date.now()) return errorResponse("Enter a valid date of birth",400);
  if(!/^\+?[0-9 ()-]{7,20}$/.test(contactNumber)) return errorResponse("Enter a valid contact number",400);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorResponse("Enter a valid email address",400);
  if(password.length<10||!/[a-z]/i.test(password)||!/[0-9]/.test(password)) return errorResponse("Password must contain at least 10 characters, a letter, and a number",400);
  const [duplicate]=await db.select({id:accounts.id}).from(accounts).where(or(sql`lower(${accounts.username}) = ${username}`,eq(accounts.email,email))).limit(1);
  if(duplicate) return errorResponse("That username or email is already registered",409);
  const accountId=uuidv4(), token=crypto.randomBytes(32).toString("base64url"), now=new Date().toISOString(), passwordHash=await hashPassword(password);
  db.transaction(tx=>{tx.insert(accounts).values({id:accountId,username,fullName,dateOfBirth,contactNumber,email,passwordHash,isLocked:true,registrationStatus:"pending",createdAt:now,updatedAt:now}).run();tx.insert(signupSessions).values({id:uuidv4(),accountId,tokenHash:hashSignupToken(token),expiresAt:new Date(Date.now()+86400000).toISOString(),createdAt:now}).run();});
  return successResponse({signupToken:token},201);
} catch(error){console.error("Registration error",error);return errorResponse("Registration could not be completed",500);} }
