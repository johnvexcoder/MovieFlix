const { Worker, isMainThread } = require('worker_threads');
if (isMainThread) {
  process.env.NEXT_PHASE = "phase-production-build";
  process.env.npm_lifecycle_event = "build";
  const w = new Worker(__filename);
  w.on('message', msg => console.log(msg));
} else {
  const { parentPort } = require('worker_threads');
  parentPort.postMessage({ 
    NEXT_PHASE: process.env.NEXT_PHASE, 
    npm_lifecycle_event: process.env.npm_lifecycle_event 
  });
}
