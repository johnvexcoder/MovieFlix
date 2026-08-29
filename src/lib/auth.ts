import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import type { JWTPayload } from "@/types";

const JWT_ACCESS_EXPIRY_SECONDS = 15 * 60; // 15 minutes
const JWT_REFRESH_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Known-default / placeholder secrets are rejected at runtime (fail closed) so
// the platform never silently signs tokens with an insecure value.
const WEAK_SECRETS = new Set([
  "default-secret-change-me",
  "default-refresh-secret-change-me",
  "change-me",
  "secret",
  "changeme",
  "your-secret-key",
  "your-jwt-secret",
  "your-jwt-refresh-secret",
  "dev-secret",
  "dev-secret-change-me",
  "dev-refresh-secret",
  "dev-refresh-secret-change-me",
  "test-secret",
]);

function requiredSecret(name: string, fallback: string): string {
  const value = process.env[name] || fallback;
  if (WEAK_SECRETS.has(value) || value.length < 32) {
    // Log an explicit warning and refuse to start, rather than silently
    // authenticating users with a predictable secret.
    // eslint-disable-next-line no-console
    console.error(
      `[auth] Refusing to start: "${name}" is missing, a known default, or shorter than 32 characters. ` +
        `Set a strong, unique value in your environment (e.g. .env.local) before starting the server.`
    );
    throw new Error(
      `Refusing to start: ${name} must be a strong (>=32 char), unique secret. Set it in your environment.`
    );
  }
  return value;
}

// Secrets are resolved lazily (not at module top-level) so tests/scripts that
// import this module without secrets can still run; the first real signing or
// verification enforces fail-closed behavior.
let _JWT_SECRET: string | null = null;
let _JWT_REFRESH_SECRET: string | null = null;

function secrets() {
  if (!_JWT_SECRET) _JWT_SECRET = requiredSecret("JWT_SECRET", "default-secret-change-me");
  if (!_JWT_REFRESH_SECRET)
    _JWT_REFRESH_SECRET = requiredSecret("JWT_REFRESH_SECRET", "default-refresh-secret-change-me");
  return { jwt: _JWT_SECRET, refresh: _JWT_REFRESH_SECRET };
}

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
  return jwt.sign(payload, secrets().jwt, {
    expiresIn: JWT_ACCESS_EXPIRY_SECONDS,
  });
}

export function generateRefreshToken(profileId: string, tokenVersion: number): string {
  return jwt.sign({ profileId, tokenVersion }, secrets().refresh, {
    expiresIn: JWT_REFRESH_EXPIRY_SECONDS,
  });
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const payload = jwt.verify(token, secrets().jwt) as JWTPayload;
    return payload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string
): Promise<{ profileId: string; tokenVersion: number } | null> {
  try {
    const payload = jwt.verify(token, secrets().refresh) as {
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
