import { eq, inArray } from "drizzle-orm";
import { setupDatabase, db } from "../../src/db";
import { hashPassword, hashPin } from "../../src/lib/auth";
import {
  accounts,
  profiles,
  media,
  seasons,
  episodes,
  watchHistory,
  myList,
  profileSettings,
} from "../../src/db/schema";

export const SEED = {
  username: "tvtest",
  password: "TvTestPass-1234",
  pin: "4321",
  accountId: "seed-account-0001",
  mainProfileId: "seed-profile-main",
  pinnedProfileId: "seed-profile-pin",
  movieId: "seed-movie-0001",
  seriesId: "seed-series-0001",
  seasonId: "seed-season-0001",
  episode1Id: "seed-ep-0001",
  episode2Id: "seed-ep-0002",
};

/**
 * Idempotently creates a known, active, un-expired fixture account (TV tests
 * cannot use /api/register because that path is approval/payment-gated). Wipes
 * any prior fixture rows (dependency order matters for SQLite FKs), then
 * inserts the account, two profiles (one PIN-protected), a movie, a 1-season
 * series with two episodes, one continue-watching entry, and one My List row.
 */
export async function seedFixture() {
  setupDatabase();

  const profileIds = [SEED.mainProfileId, SEED.pinnedProfileId];
  const accountProfiles = await db.select({ id: profiles.id }).from(profiles)
    .where(eq(profiles.accountId, SEED.accountId));
  const allProfileIds = accountProfiles.map((p) => p.id);
  await db.delete(watchHistory).where(inArray(watchHistory.profileId, allProfileIds.length ? allProfileIds : profileIds));
  await db.delete(myList).where(inArray(myList.profileId, allProfileIds.length ? allProfileIds : profileIds));
  await db.delete(profileSettings).where(inArray(profileSettings.profileId, allProfileIds.length ? allProfileIds : profileIds));
  await db.delete(episodes).where(eq(episodes.mediaId, SEED.seriesId));
  await db.delete(seasons).where(eq(seasons.mediaId, SEED.seriesId));
  await db.delete(media).where(inArray(media.id, [SEED.movieId, SEED.seriesId]));
  // Delete ALL profiles for the test account (not just the two known IDs)
  // so that any profiles created by earlier test runs are cleaned up first.
  await db.delete(profiles).where(eq(profiles.accountId, SEED.accountId));
  await db.delete(accounts).where(eq(accounts.id, SEED.accountId));

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db.insert(accounts).values({
    id: SEED.accountId,
    username: SEED.username,
    email: "tvtest@test.local",
    fullName: "TV Test Account",
    passwordHash: await hashPassword(SEED.password),
    registrationStatus: "active",
    isTemp: false,
    isLocked: false,
    mustChangePassword: false,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(profiles).values([
    {
      id: SEED.mainProfileId,
      accountId: SEED.accountId,
      name: "Papa",
      pinHash: null,
      isMainProfile: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: SEED.pinnedProfileId,
      accountId: SEED.accountId,
      name: "Kids",
      pinHash: await hashPin(SEED.pin),
      isMainProfile: false,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.insert(media).values([
    {
      id: SEED.movieId,
      type: "movie",
      title: "Test Movie",
      year: 2024,
      overview: "A fixture movie used by the TV regression tests.",
      genres: JSON.stringify(["Action", "Comedy"]),
      rating: 8.5,
      maturityRating: "PG-13",
      durationMinutes: 121,
      backdropUrl: "/api/files?path=fixtures/backdrops/test-movie.jpg",
      posterUrl: "/api/files?path=fixtures/posters/test-movie.jpg",
      filePath: "/media/movies/fixture-test-movie.mp4",
      fileSize: 524288000,
      fileCodec: "h264",
      fileContainer: "mp4",
      fileDurationSeconds: 7260,
      fileBitrate: 4600000,
      videoCodec: "h264",
      videoWidth: 1920,
      videoHeight: 1080,
      audioCodec: "aac",
      needsTranscode: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: SEED.seriesId,
      type: "series",
      title: "Test Series",
      year: 2023,
      overview: "A fixture series used by the TV regression tests.",
      genres: JSON.stringify(["Drama", "Mystery"]),
      rating: 9.1,
      maturityRating: "TV-MA",
      durationMinutes: 45,
      backdropUrl: "/api/files?path=fixtures/backdrops/test-series.jpg",
      posterUrl: "/api/files?path=fixtures/posters/test-series.jpg",
      filePath: "/media/series/fixture-test-series/",
      needsTranscode: false,
      createdAt: new Date(Date.now() - 3600_000).toISOString(),
      updatedAt: now,
    },
  ]);

  await db.insert(seasons).values({
    id: SEED.seasonId,
    mediaId: SEED.seriesId,
    seasonNumber: 1,
    title: "Season 1",
    overview: "The first season.",
    createdAt: now,
  });

  await db.insert(episodes).values([
    {
      id: SEED.episode1Id,
      mediaId: SEED.seriesId,
      seasonId: SEED.seasonId,
      episodeNumber: 1,
      title: "Pilot",
      overview: "It begins.",
      durationMinutes: 45,
      filePath: "/media/series/fixture-test-series/s01e01.mp4",
      fileSize: 262144000,
      fileCodec: "h264",
      fileContainer: "mp4",
      fileDurationSeconds: 2700,
      videoCodec: "h264",
      videoWidth: 1920,
      videoHeight: 1080,
      audioCodec: "aac",
      needsTranscode: false,
      createdAt: now,
    },
    {
      id: SEED.episode2Id,
      mediaId: SEED.seriesId,
      seasonId: SEED.seasonId,
      episodeNumber: 2,
      title: "Episode 2",
      overview: "It continues.",
      durationMinutes: 44,
      filePath: "/media/series/fixture-test-series/s01e02.mp4",
      fileSize: 256000000,
      fileCodec: "h264",
      fileContainer: "mp4",
      fileDurationSeconds: 2640,
      videoCodec: "h264",
      videoWidth: 1920,
      videoHeight: 1080,
      audioCodec: "aac",
      needsTranscode: false,
      createdAt: now,
    },
  ]);

  await db.insert(watchHistory).values({
    id: "seed-watch-0001",
    profileId: SEED.mainProfileId,
    mediaId: SEED.seriesId,
    episodeId: SEED.episode1Id,
    positionSeconds: 600,
    durationSeconds: 2700,
    completed: false,
    percent: 22.2,
    lastWatched: now,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(myList).values({
    id: "seed-my-list-0001",
    profileId: SEED.mainProfileId,
    mediaId: SEED.movieId,
    createdAt: now,
  });

  return { ...SEED };
}

export async function seedEverything() {
  await seedFixture();
  console.log("Fixture seeded:", JSON.stringify(SEED));
}

seedEverything().catch((err) => {
  console.error(err);
  process.exit(1);
});