import {
  sqliteTable,
  text,
  integer,
  real,
} from "drizzle-orm/sqlite-core";

// ===========================================
// ADMINS TABLE (separate from user accounts)
// ===========================================
export const admins = sqliteTable("admins", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull().default(""),
});

// ===========================================
// ACCOUNTS TABLE (created by admin, time-limited)
// ===========================================
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  fullName: text("full_name"),
  passwordHash: text("password_hash").notNull(),
  isTemp: integer("is_temp", { mode: "boolean" }).notNull().default(false),
  isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
  durationHours: integer("duration_hours"),
  expiresAt: text("expires_at"),
  createdByAdminId: text("created_by_admin_id").references(() => admins.id),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
  lastIp: text("last_ip"),
  lastLoginAt: text("last_login_at"),
});

// ===========================================
// PASSWORD RESET TOKENS TABLE
// ===========================================
export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().default(""),
});

// ===========================================
// ADMIN MESSAGES TABLE (targeted or broadcast)
// ===========================================
export const adminMessages = sqliteTable("admin_messages", {
  id: text("id").primaryKey(),
  message: text("message").notNull(),
  accountId: text("account_id").references(() => accounts.id),
  createdByAdminId: text("created_by_admin_id").references(() => admins.id),
  createdAt: text("created_at").notNull().default(""),
});

// Tracks which accounts have already seen a message, so a message pops exactly
// once and never reappears on a new login/session of the same account.
export const messageViews = sqliteTable("message_views", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id),
  messageId: text("message_id").notNull().references(() => adminMessages.id),
  viewedAt: text("viewed_at").notNull().default(""),
});

// ===========================================
// CONTACT SUBMISSIONS TABLE (Report / Feedback / Suggestion)
// ===========================================
export const contactSubmissions = sqliteTable("contact_submissions", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  subject: text("subject"),
  message: text("message").notNull(),
  accountId: text("account_id").references(() => accounts.id),
  profileId: text("profile_id").references(() => profiles.id),
  createdAt: text("created_at").notNull().default(""),
});

// ===========================================
// PAYMENT METHODS TABLE (admin-managed)
// ===========================================
export const paymentMethods = sqliteTable("payment_methods", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  accountNumber: text("account_number").notNull(),
  iconPath: text("icon_path"),
  qrPath: text("qr_path"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});

// ===========================================
// PAYMENT SUBMISSIONS TABLE (user-submitted payments)
// ===========================================
export const paymentSubmissions = sqliteTable("payment_submissions", {
  id: text("id").primaryKey(),
  paymentMethodId: text("payment_method_id").references(() => paymentMethods.id),
  accountId: text("account_id").notNull().references(() => accounts.id),
  senderName: text("sender_name").notNull(),
  senderAccountNumber: text("sender_account_number").notNull(),
  amount: real("amount").notNull(),
  referenceNumber: text("reference_number").notNull(),
  receiptPath: text("receipt_path"),
  status: text("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  reviewedByAdminId: text("reviewed_by_admin_id").references(() => admins.id),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});

// ===========================================
// PROFILES TABLE (belongs to an account)
// ===========================================
export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  pinHash: text("pin_hash"),
  isMainProfile: integer("is_main_profile", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});

// ===========================================
// MEDIA TABLE (Movies + Series)
// ===========================================
export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  year: integer("year"),
  overview: text("overview"),
  genres: text("genres"),
  rating: real("rating"),
  maturityRating: text("maturity_rating"),
  durationMinutes: integer("duration_minutes"),
  backdropUrl: text("backdrop_url"),
  posterUrl: text("poster_url"),
  trailerUrl: text("trailer_url"),
  tmdbId: integer("tmdb_id"),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  fileCodec: text("file_codec"),
  fileContainer: text("file_container"),
  fileDurationSeconds: integer("file_duration_seconds"),
  fileBitrate: integer("file_bitrate"),
  videoCodec: text("video_codec"),
  videoWidth: integer("video_width"),
  videoHeight: integer("video_height"),
  audioCodec: text("audio_codec"),
  thumbnailPath: text("thumbnail_path"),
  backdropPath: text("backdrop_path"),
  posterPath: text("poster_path"),
  needsTranscode: integer("needs_transcode", { mode: "boolean" }).notNull().default(false),
  scanId: text("scan_id"),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});

// ===========================================
// SEASONS TABLE (for series)
// ===========================================
export const seasons = sqliteTable("seasons", {
  id: text("id").primaryKey(),
  mediaId: text("media_id").notNull().references(() => media.id),
  seasonNumber: integer("season_number").notNull(),
  title: text("title"),
  overview: text("overview"),
  posterUrl: text("poster_url"),
  posterPath: text("poster_path"),
  tmdbId: integer("tmdb_id"),
  year: integer("year"),
  createdAt: text("created_at").notNull().default(""),
});

// ===========================================
// EPISODES TABLE (for series)
// ===========================================
export const episodes = sqliteTable("episodes", {
  id: text("id").primaryKey(),
  mediaId: text("media_id").notNull().references(() => media.id),
  seasonId: text("season_id").notNull().references(() => seasons.id),
  episodeNumber: integer("episode_number").notNull(),
  title: text("title"),
  overview: text("overview"),
  durationMinutes: integer("duration_minutes"),
  stillUrl: text("still_url"),
  stillPath: text("still_path"),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  fileCodec: text("file_codec"),
  fileContainer: text("file_container"),
  fileDurationSeconds: integer("file_duration_seconds"),
  videoCodec: text("video_codec"),
  videoWidth: integer("video_width"),
  videoHeight: integer("video_height"),
  audioCodec: text("audio_codec"),
  tmdbId: integer("tmdb_id"),
  thumbnailPath: text("thumbnail_path"),
  needsTranscode: integer("needs_transcode", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(""),
});

// ===========================================
// WATCH HISTORY TABLE
// ===========================================
export const watchHistory = sqliteTable("watch_history", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull().references(() => profiles.id),
  mediaId: text("media_id").notNull().references(() => media.id),
  episodeId: text("episode_id").references(() => episodes.id),
  positionSeconds: integer("position_seconds").notNull().default(0),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  percent: real("percent").notNull().default(0),
  lastWatched: text("last_watched").notNull().default(""),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});

// ===========================================
// PROFILE SETTINGS TABLE
// ===========================================
export const profileSettings = sqliteTable("profile_settings", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull().references(() => profiles.id).unique(),
  language: text("language").default("en"),
  autoplayNext: integer("autoplay_next", { mode: "boolean" }).default(true),
  defaultQuality: text("default_quality").default("auto"),
  subtitleEnabled: integer("subtitle_enabled", { mode: "boolean" }).default(false),
  subtitleLanguage: text("subtitle_language"),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});

// ===========================================
// SCAN LOG TABLE
// ===========================================
export const scanLog = sqliteTable("scan_log", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  mediaFound: integer("media_found").default(0),
  mediaAdded: integer("media_added").default(0),
  mediaUpdated: integer("media_updated").default(0),
  mediaSkipped: integer("media_skipped").default(0),
  errors: text("errors"),
  startedAt: text("started_at").notNull().default(""),
  completedAt: text("completed_at"),
  triggeredBy: text("triggered_by").notNull().default("auto"),
});

// ===========================================
// LIBRARY CONFIG TABLE
// ===========================================
export const libraryConfig = sqliteTable("library_config", {
  id: text("id").primaryKey(),
  path: text("path").notNull(),
  type: text("type").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastScanAt: text("last_scan_at"),
  createdAt: text("created_at").notNull().default(""),
});

// ===========================================
// APP SETTINGS TABLE
// ===========================================
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
});

// ===========================================
// SESSIONS TABLE
// ===========================================
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull().references(() => profiles.id),
  accountId: text("account_id").notNull().references(() => accounts.id),
  fingerprint: text("fingerprint").notNull(),
  ipSubnet: text("ip_subnet").notNull(),
  userAgent: text("user_agent"),
  accessToken: text("access_token"),
  refreshTokenHash: text("refresh_token_hash"),
  tokenVersion: integer("token_version").notNull().default(1),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(""),
});
