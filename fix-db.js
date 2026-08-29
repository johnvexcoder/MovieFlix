const fs = require("fs");
const path = require("path");

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk("./src", (filePath) => {
  if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
    if (filePath.includes("src/db/index.ts")) return;
    
    let content = fs.readFileSync(filePath, "utf8");
    if (content.includes("import { db } from \"@/db\"")) {
      content = content.replace(/import\s+\{\s*db\s*\}\s+from\s+"@\/db"/g, 'import { getDb } from "@/db"');
      content = content.replace(/\bdb\./g, "getDb().");
      fs.writeFileSync(filePath, content);
      console.log("Updated", filePath);
    } else if (content.includes("import { db } from \"./index\"")) {
      content = content.replace(/import\s+\{\s*db\s*\}\s+from\s+"\.\/index"/g, 'import { getDb } from "./index"');
      content = content.replace(/\bdb\./g, "getDb().");
      fs.writeFileSync(filePath, content);
      console.log("Updated", filePath);
    }
  }
});
