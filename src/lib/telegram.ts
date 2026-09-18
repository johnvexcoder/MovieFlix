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
  const result = await sendTelegramMessageDetailed(text);
  return result.ok;
}

export interface TelegramSendResult {
  ok: boolean;
  /** Short, user-friendly failure reason. */
  error?: string;
  /** Raw Telegram error_code and description, for server logs. */
  detail?: string;
}

/**
 * Sends a message and returns a structured result. The raw Telegram
 * error_code / description is always logged server-side for debugging.
 */
export async function sendTelegramMessageDetailed(text: string): Promise<TelegramSendResult> {
  const { botToken, adminChatId } = await getTelegramConfig();
  if (!botToken || !adminChatId) {
    const missing = [!botToken && "bot token", !adminChatId && "admin chat ID"].filter(Boolean).join(" and ");
    console.warn(`Telegram not fully configured. Missing: ${missing}.`);
    return { ok: false, error: `Telegram is not fully configured (missing ${missing}).`, detail: "missing config" };
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: adminChatId, text, disable_web_page_preview: true }),
    });
    const body = await response.text().catch(() => "");
    if (!response.ok) {
      let description = body;
      try {
        const parsed = JSON.parse(body);
        description = `error_code=${parsed?.error_code ?? response.status} description=${parsed?.description ?? body}`;
      } catch {
        description = `HTTP ${response.status} ${body.slice(0, 200)}`;
      }
      // Always log the actual Telegram reason for debugging.
      console.error(`Telegram send failed: ${description}`);
      return {
        ok: false,
        error: friendlyTelegramError(response.status, body),
        detail: description,
      };
    }
    return { ok: true };
  } catch (error) {
    console.error("Telegram send error:", error);
    return { ok: false, error: "Telegram is unreachable (network error).", detail: String(error) };
  }
}

function friendlyTelegramError(status: number, body: string): string {
  if (status === 401) return "Invalid bot token (Telegram rejected it as unauthorized).";
  if (status === 403) return "Telegram blocked this chat — the bot may need to be started or unblocked.";
  if (status === 400 && /chat not found/i.test(body)) return "Chat not found — check the Main Admin chat ID (start the bot first).";
  if (status === 400) return "Telegram rejected the request — check the bot token and chat ID.";
  return `Telegram returned an error (${status}).`;
}