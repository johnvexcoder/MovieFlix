const { Worker, isMainThread } = require('worker_threads');
if (isMainThread) {
  for (let i = 0; i < 5; i++) {
    new Worker(__filename);
  }
} else {
  const Database = require('better-sqlite3');
  const db = new Database('/tmp/test-worker.sqlite');
  console.log("Worker opened DB");
}
