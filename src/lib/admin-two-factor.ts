import crypto from "crypto";

export function securityHash(value: string) {
  return crypto.createHash("sha256").update(value.trim().toUpperCase()).digest("hex");
}

export function generateEmailCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(8).toString("hex").toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12)}`;
  });
}

export function adminCodeEmail(code: string) {
  return `<!doctype html><html><body style="margin:0;background:#050816;color:#f8fafc;font-family:Arial,sans-serif"><div style="max-width:520px;margin:auto;padding:32px"><img src="cid:movieflix-logo" width="56" height="56" alt="MovieFlix"><h1>Admin verification code</h1><p style="color:#a8b3c7">Use this one-time code to continue. It expires in 10 minutes.</p><div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#22d3ee;padding:20px;background:#0e162b;border-radius:14px;text-align:center">${code}</div><p style="color:#748096;font-size:13px">If you did not request this, change your administrator password immediately.</p></div></body></html>`;
}

export function adminPasswordResetEmail(code: string, resetLink: string) {
  return `<!doctype html><html><body style="margin:0;background:#050816;color:#f8fafc;font-family:Arial,sans-serif"><div style="max-width:520px;margin:auto;padding:32px"><img src="cid:movieflix-logo" width="56" height="56" alt="MovieFlix"><h1>Reset administrator password</h1><p style="color:#a8b3c7">Use the six-digit code or secure link below. Both expire in 15 minutes.</p><div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#22d3ee;padding:20px;background:#0e162b;border-radius:14px;text-align:center">${code}</div><p style="margin-top:24px"><a href="${resetLink}" style="display:inline-block;background:#22d3ee;color:#07101f;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:800">Reset admin password</a></p><p style="color:#748096;font-size:13px">If you did not request this, ignore this email and review administrator access.</p></div></body></html>`;
}
