import nodemailer from "nodemailer";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

interface SmtpSettings {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
}

export async function getSmtpSettings(): Promise<SmtpSettings> {
  const settings = await db.select().from(appSettings);
  const config: any = {};
  for (const s of settings) {
    if (s.key.startsWith("smtp_")) {
      config[s.key.replace("smtp_", "")] = s.value;
    }
  }
  return {
    host: config.host || process.env.SMTP_HOST,
    port: parseInt(config.port || process.env.SMTP_PORT || "587"),
    user: config.user || process.env.SMTP_USER,
    pass: config.pass || process.env.SMTP_PASS,
    from: config.from || process.env.SMTP_FROM || "noreply@movieflix.local",
  };
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const config = await getSmtpSettings();
  if (!config.host || !config.user || !config.pass) {
    console.warn("SMTP not fully configured. Skipping email to", to);
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  try {
    await transporter.sendMail({
      from: config.from,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
}
