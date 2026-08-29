export type UserRole = "user";
export type MediaType = "movie" | "series";
export type ScanStatus = "running" | "completed" | "failed" | "cancelled";

export interface Admin {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface Account {
  id: string;
  username: string;
  passwordHash: string;
  isTemp: boolean;
  durationHours: number | null;
  expiresAt: string | null;
  createdByAdminId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  accountId: string;
  name: string;
  avatarUrl: string | null;
  pinHash: string | null;
  isMainProfile: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Media {
  id: string;
  type: MediaType;
  title: string;
  year: number | null;
  overview: string | null;
  genres: string | null;
  rating: number | null;
  maturityRating: string | null;
  durationMinutes: number | null;
  backdropUrl: string | null;
  posterUrl: string | null;
  trailerUrl: string | null;
  tmdbId: number | null;
  filePath: string;
  fileSize: number | null;
  fileCodec: string | null;
  fileContainer: string | null;
  fileDurationSeconds: number | null;
  fileBitrate: number | null;
  videoCodec: string | null;
  videoWidth: number | null;
  videoHeight: number | null;
  audioCodec: string | null;
  thumbnailPath: string | null;
  backdropPath: string | null;
  posterPath: string | null;
  needsTranscode: boolean;
  scanId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Season {
  id: string;
  mediaId: string;
  seasonNumber: number;
  title: string | null;
  overview: string | null;
  posterUrl: string | null;
  posterPath: string | null;
  tmdbId: number | null;
  year: number | null;
  createdAt: string;
}

export interface Episode {
  id: string;
  mediaId: string;
  seasonId: string;
  episodeNumber: number;
  title: string | null;
  overview: string | null;
  durationMinutes: number | null;
  stillUrl: string | null;
  stillPath: string | null;
  filePath: string;
  fileSize: number | null;
  fileCodec: string | null;
  fileContainer: string | null;
  fileDurationSeconds: number | null;
  videoCodec: string | null;
  videoWidth: number | null;
  videoHeight: number | null;
  audioCodec: string | null;
  tmdbId: number | null;
  thumbnailPath: string | null;
  needsTranscode: boolean;
  createdAt: string;
}

export interface WatchHistory {
  id: string;
  profileId: string;
  mediaId: string;
  episodeId: string | null;
  positionSeconds: number;
  durationSeconds: number;
  completed: boolean;
  percent: number;
  lastWatched: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileSettings {
  id: string;
  profileId: string;
  language: string | null;
  autoplayNext: boolean | null;
  defaultQuality: string | null;
  subtitleEnabled: boolean | null;
  subtitleLanguage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScanLog {
  id: string;
  status: ScanStatus;
  mediaFound: number | null;
  mediaAdded: number | null;
  mediaUpdated: number | null;
  mediaSkipped: number | null;
  errors: string | null;
  startedAt: string;
  completedAt: string | null;
  triggeredBy: string;
}

export interface LibraryConfig {
  id: string;
  path: string;
  type: "movies" | "series";
  enabled: boolean;
  lastScanAt: string | null;
  createdAt: string;
}

export interface Session {
  id: string;
  profileId: string;
  accountId: string;
  fingerprint: string;
  ipSubnet: string;
  userAgent: string | null;
  accessToken: string | null;
  refreshTokenHash: string | null;
  tokenVersion: number;
  expiresAt: string;
  createdAt: string;
}

export interface ParsedFilename {
  title: string;
  year: number | null;
  season: number | null;
  episode: number | null;
  episodeEnd: number | null;
  type: MediaType;
  quality: string | null;
  source: string | null;
}

export interface JWTPayload {
  profileId: string;
  accountId: string;
  isAdmin: boolean;
  fingerprint: string;
  tokenVersion: number;
  sessionId?: string;
}

export interface AccountWithProfiles extends Account {
  profiles: Profile[];
  profileCount: number;
}

export interface MediaWithProgress extends Media {
  progress?: {
    percent: number;
    positionSeconds: number;
    completed: boolean;
    lastWatched: string;
  };
}

export interface HomeData {
  featured: Media | null;
  newReleases?: Media[];
  continueWatching: MediaWithProgress[];
  recentlyAdded: Media[];
  trending: Media[];
  genres: Record<string, Media[]>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
