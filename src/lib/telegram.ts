import { getSetting } from "@/lib/app-settings";

interface TelegramConfig {
  botToken: string;
  adminChatId: string;
}

/**
 * Resolves Telegram configuration from admin settings (stored in the DB) with
 * an environment-variable fallback. Secrets are never exposed to the browser.
 */
export async function getTelegramConfig(): Promise<TelegramConfig> {
  const botToken = (await getSetting<string>("telegram_bot_token", "")).trim() || process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
  const adminChatId = (await getSetting<string>("telegram_admin_chat_id", "")).trim() || process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() || "";
  return { botToken, adminChatId };
}

/**
 * Sends a plain-text message to the configured Main Admin chat via the
 * Telegram Bot API. Returns true on success.
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  const { botToken, adminChatId } = await getTelegramConfig();
  if (!botToken || !adminChatId) {
    console.warn("Telegram not fully configured. Skipping message.");
    return false;
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: adminChatId, text, disable_web_page_preview: true }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("Telegram send error:", response.status, body.slice(0, 300));
      return false;
    }
    return true;
  } catch (error) {
    console.error("Telegram send error:", error);
    return false;
  }
}