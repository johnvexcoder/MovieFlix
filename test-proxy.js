const Database = require("better-sqlite3");
const { drizzle } = require("drizzle-orm/better-sqlite3");

let _db = null;
function getDb() {
  if (!_db) {
    const sqlite = new Database("/tmp/test-proxy.sqlite");
    sqlite.exec("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY)");
    _db = drizzle(sqlite);
  }
  return _db;
}

const db = new Proxy({}, {
  get(target, prop, receiver) {
    if (prop === "then") return undefined; // Prevent Drizzle infinite promise resolution loops
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

async function run() {
  try {
    const res = await db.select().from(require("./src/db/schema").admins);
    console.log("Success:", res);
  } catch (e) {
    console.log("Error:", e.message);
  }
}
run();
