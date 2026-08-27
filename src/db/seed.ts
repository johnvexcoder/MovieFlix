import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { db } from "./index";
import { admins, accounts, profiles, profileSettings, libraryConfig } from "./schema";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

const DEFAULT_LIBRARY_PATHS = [
  { path: "/media/movies", type: "movies" as const },
  { path: "/media/series", type: "series" as const },
];

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // Clear existing data
    console.log("🗑️  Clearing existing data...");
    await db.delete(profileSettings);
    await db.delete(profiles);
    await db.delete(accounts);
    await db.delete(admins);
    await db.delete(libraryConfig);

    // Create admin account
    console.log("👑 Creating admin account...");
    const adminId = uuidv4();
    const adminPasswordHash = await hashPassword(ADMIN_PASSWORD);

    await db.insert(admins).values({
      id: adminId,
      username: ADMIN_USERNAME,
      passwordHash: adminPasswordHash,
      createdAt: new Date().toISOString(),
    });

    console.log(`  ✅ Created admin: ${ADMIN_USERNAME} (password: ${ADMIN_PASSWORD})`);

    // Seed library config
    console.log("📁 Creating default library paths...");
    for (const lib of DEFAULT_LIBRARY_PATHS) {
      await db.insert(libraryConfig).values({
        id: uuidv4(),
        path: lib.path,
        type: lib.type,
        enabled: true,
      });
      console.log(`  ✅ Created library path: ${lib.path} (${lib.type})`);
    }

    console.log("\n✅ Database seeded successfully!");
    console.log("\n📋 Admin credentials:");
    console.log(`  Username: ${ADMIN_USERNAME}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log("\n📌 Users must be created by admin through the admin panel.");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();
