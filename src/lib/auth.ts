import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import type { JWTPayload } from "@/types";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "default-refresh-secret-change-me";
const JWT_ACCESS_EXPIRY_SECONDS = 15 * 60; // 15 minutes
const JWT_REFRESH_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Keep for backward compatibility
export const hashPin = hashPassword;
export const comparePin = comparePassword;

export function generateAccessToken(payload: Omit<JWTPayload, "tokenVersion">): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRY_SECONDS,
  });
}

export function generateRefreshToken(profileId: string, tokenVersion: number): string {
  return jwt.sign({ profileId, tokenVersion }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRY_SECONDS,
  });
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return payload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string
): Promise<{ profileId: string; tokenVersion: number } | null> {
  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET) as {
      profileId: string;
      tokenVersion: number;
    };
    return payload;
  } catch {
    return null;
  }
}

export function generateSessionId(): string {
  return uuidv4();
}

export function extractIpSubnet(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  return ip;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "0.0.0.0";
}

export function createFingerprint(ip: string, userAgent: string): string {
  const subnet = extractIpSubnet(ip);
  return `${subnet}:${userAgent}`;
}
