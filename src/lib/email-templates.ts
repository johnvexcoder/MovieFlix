// Shared branded HTML email templates for MovieFlix.
//
// These templates are self-contained: the "M" logo is embedded inline as an
// <img> data-URI pointing at the MovieFlix "M" mark, so it reliably renders in
// email clients without depending on the client being able to reach the app's
// public URL. The footer uses the real support address.

export const SUPPORT_EMAIL = "movieflix.support@gmail.com";
export const BRAND_NAME = "MovieFlix";
export const BRAND_COLOR = "#e50914";

// The MovieFlix "M" mark. This mirrors src/components/movieflix-logo.tsx and
// public/logo.svg but is flattened (no feDropShadow filter) so it renders
// reliably as a data-URI image inside email clients.
const M_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" fill="none">
  <path d="M 32 216 L 32 24 C 32 20, 36 16, 42 16 L 70 16 C 76 16, 80 20, 80 24 L 80 216 C 80 220, 76 224, 70 224 L 42 224 C 36 224, 32 220, 32 216 Z" fill="#e50914"/>
  <path d="M 160 216 L 160 24 C 160 20, 164 16, 170 16 L 198 16 C 204 16, 208 20, 208 24 L 208 216 C 208 220, 204 224, 198 224 L 170 224 C 164 224, 160 220, 160 216 Z" fill="#e50914"/>
  <path d="M 40 18 L 78 18 L 132 168 L 94 168 Z" fill="#b20710"/>
  <path d="M 108 168 L 146 168 L 200 18 L 162 18 Z" fill="#800208"/>
</svg>`;

export const M_LOGO_DATA_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(M_LOGO_SVG)}`;

// Header block with the M logo (rendered large at the top of the email).
function headerBlock(logoHeight = 64): string {
  return `
    <div style="text-align:center; padding:24px 0 8px;">
      <img src="${M_LOGO_DATA_URI}" alt="${BRAND_NAME}" style="height:${logoHeight}px; width:${logoHeight}px;" />
    </div>`;
}

// Small footer logo + support line.
function footerBlock(): string {
  return `
    <hr style="margin:32px 0 20px; border:none; border-top:1px solid #e8e8e8;" />
    <p style="font-size:12px; color:#666666; margin:0 0 12px;">
      Need help? Email us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#e50914; text-decoration:none;">${SUPPORT_EMAIL}</a>
    </p>
    <div style="text-align:center;">
      <img src="${M_LOGO_DATA_URI}" alt="${BRAND_NAME}" style="height:24px; width:24px;" />
      <p style="font-size:11px; color:#999999; margin:6px 0 0;">© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</p>
    </div>`;
}

interface EmailLayoutOptions {
  title: string;
  bodyHtml: string;
  logoHeight?: number;
}

/**
 * Wraps arbitrary body content in the shared MovieFlix branded email layout.
 * The body is inserted between the header logo and the footer.
 */
export function emailLayout({ title, bodyHtml, logoHeight = 64 }: EmailLayoutOptions): string {
  return `
    <div style="max-width:600px; margin:0 auto; font-family:Arial,Helvetica,sans-serif; color:#1a1a1a; background:#ffffff;">
      ${headerBlock(logoHeight)}
      <h1 style="color:${BRAND_COLOR}; margin:20px 0 12px; font-size:22px;">${title}</h1>
      <div style="line-height:1.6;">${bodyHtml}</div>
      ${footerBlock()}
    </div>`;
}

/**
 * Shared greeting helper so every email addresses the user by name.
 */
export function greeting(firstName: string): string {
  const name = firstName && firstName.trim() ? firstName.trim() : "there";
  return `<p>Hi <strong>${name}</strong>!</p>`;
}

/**
 * The account-creation (welcome) email. Includes the user's chosen username
 * AND the set password the admin created, so the user can log in immediately
 * without waiting for credentials to be shared separately.
 */
export function welcomeEmail({ username, fullName, password, baseUrl }: { username: string; fullName?: string | null; password: string; baseUrl: string }): string {
  const name = fullName || username;
  return emailLayout({
    title: "Welcome to MovieFlix!",
    bodyHtml: `
      ${greeting(name)}
      <p>Thank you for joining ${BRAND_NAME}. Your streaming account has been successfully created.</p>
      <table role="presentation" cellpadding="8" cellspacing="0" style="width:100%; border:1px solid #e8e8e8; border-radius:8px; margin:16px 0; font-size:14px;">
        <tr>
          <td style="color:#666666; font-weight:bold;">Username</td>
          <td style="color:#1a1a1a; font-weight:bold;">${username}</td>
        </tr>
        <tr>
          <td style="color:#666666; font-weight:bold;">Password</td>
          <td style="color:#1a1a1a; font-weight:bold;">${password}</td>
        </tr>
      </table>
      <p>For security, you will be asked to set a new password of your own the first time you log in.</p>
      <p>You can now log in and start watching at your convenience.</p>
      <p>
        <a href="${baseUrl}/login" style="display:inline-block; background:${BRAND_COLOR}; color:#ffffff; text-decoration:none; padding:12px 28px; border-radius:8px; font-weight:bold; margin-top:8px;">
          Log In Now
        </a>
      </p>
    `,
  });
}

/**
 * The password-reset notification email (admin forced a reset).
 */
export function passwordResetEmail({ username, password }: { username: string; password?: string }): string {
  const creds = password
    ? `<p>Your new temporary password is: <strong>${password}</strong></p>`
    : "";
  return emailLayout({
    title: "Your MovieFlix password has been reset",
    bodyHtml: `
      ${greeting(username)}
      <p>Your ${BRAND_NAME} account password was changed by an administrator.</p>
      ${creds}
      <p>You will be required to set a new password the next time you log in.</p>
      <p>If you did not request this, please contact support immediately at ${SUPPORT_EMAIL}.</p>
    `,
  });
}

/**
 * The forgot-password (reset link) email.
 */
export function forgotPasswordEmail({ username, resetLink }: { username: string; resetLink: string }): string {
  return emailLayout({
    title: "Reset your MovieFlix password",
    bodyHtml: `
      ${greeting(username)}
      <p>We received a request to reset your ${BRAND_NAME} password. The link below is valid for 1 hour:</p>
      <p>
        <a href="${resetLink}" style="display:inline-block; background:${BRAND_COLOR}; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:bold;">
          Reset Password
        </a>
      </p>
      <p style="font-size:13px; color:#666666;">Or open this link directly: <a href="${resetLink}" style="color:#e50914;">${resetLink}</a></p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `,
  });
}

/**
 * Auto-reply confirmation when a user submits a report / suggestion / request via
 * the contact form. Confirms we received their submission.
 */
export function submissionConfirmationEmail({ username, type, subject }: { username: string; type: string; subject?: string | null }): string {
  const subjectLine = subject ? ` (${subject})` : "";
  return emailLayout({
    title: "We received your submission",
    bodyHtml: `
      ${greeting(username)}
      <p>Thank you for contacting ${BRAND_NAME}. We have received your <strong>${type}</strong>${subjectLine} and a member of our team will review it as soon as possible.</p>
      <p>You do not need to do anything else. If we need more information, we will reach out to you at this email address.</p>
      <p style="font-size:13px; color:#666666;">This is an automated confirmation. Please do not reply to this email.</p>
    `,
  });
}

/**
 * Escape untrusted text for safe embedding in HTML email bodies.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The admin mass-email template. Sent to all users (or a single user) with a
 * shared subject/message. The user's username is addressed in the greeting, so
 * a single blast reaches everyone by name.
 */
export function broadcastEmail({ username, subject, message }: { username: string; subject: string; message: string }): string {
  return emailLayout({
    title: escapeHtml(subject),
    bodyHtml: `
      ${greeting(escapeHtml(username))}
      <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
    `,
  });
}
