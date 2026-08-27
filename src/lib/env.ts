import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_PORT: z.coerce.number().default(9000),
  ADMIN_PORT: z.coerce.number().default(9001),
  INTERNAL_PORT: z.coerce.number().default(9002),

  DATABASE_PATH: z.string().default("./data/database.sqlite"),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),

  TMDB_API_KEY: z.string().optional(),
  TMDB_BASE_URL: z.string().default("https://api.themoviedb.org/3"),
  TMDB_IMAGE_BASE_URL: z.string().default("https://image.tmdb.org/t/p/"),

  MEDIA_MOVIES_PATH: z.string().default("/media/movies"),
  MEDIA_SERIES_PATH: z.string().default("/media/series"),

  FFMPEG_PATH: z.string().default("ffmpeg"),
  TRANSCODE_TEMP_DIR: z.string().default("./data/transcode-temp"),
  TRANSCODE_MAX_CONCURRENT: z.coerce.number().default(2),

  SCAN_INTERVAL_MINUTES: z.coerce.number().default(10),
  SCAN_ON_STARTUP: z.coerce.boolean().default(true),

  TRIAL_CHECK_INTERVAL_MINUTES: z.coerce.number().default(5),
  TRIAL_MAX_DURATION_HOURS: z.coerce.number().default(168),
  TRIAL_DEFAULT_DURATION_HOURS: z.coerce.number().default(72),
  TRIAL_AUTO_DELETE_EXPIRED: z.coerce.boolean().default(true),
  TRIAL_WARN_BEFORE_EXPIRY_HOURS: z.coerce.number().default(24),

  MAX_CONCURRENT_SESSIONS: z.coerce.number().default(3),
  SESSION_TIMEOUT_MINUTES: z.coerce.number().default(30),

  RATE_LIMIT_PUBLIC: z.coerce.number().default(100),
  RATE_LIMIT_AUTH: z.coerce.number().default(5),
  RATE_LIMIT_ADMIN: z.coerce.number().default(30),

  ADMIN_ALLOWED_IPS: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

export function getEnv(): Env {
  if (!env) {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      console.error("❌ Invalid environment variables:");
      console.error(result.error.flatten().fieldErrors);
      throw new Error("Invalid environment variables");
    }

    env = result.data;
  }

  return env;
}
