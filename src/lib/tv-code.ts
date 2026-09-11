/**
 * Shared TV QR code constants. Kept dependency-free so both server routes and
 * client components can import it without pulling server-only packages
 * (ioredis, etc.) into the browser bundle.
 */

// Ambiguous characters (0/O/1/I/L) are excluded so users can type the code on
// a phone if the TV's QR rendering fails.
export const TV_CODE_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const TV_CODE_LENGTH = 9;
export const TV_CODE_RE = new RegExp(`^[${TV_CODE_CHARSET}]{${TV_CODE_LENGTH}}$`);