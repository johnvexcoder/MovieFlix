// Streaming Worker Entrypoint for Docker
// This file serves as the entry point for the streaming-worker service
// It loads and runs the TypeScript worker using tsx

const { spawn } = require('child_process');
const path = require('path');

// Use tsx to run the TypeScript worker-main.ts
const workerPath = path.join(__dirname, 'src', 'streaming', 'worker-main.ts');

// Spawn tsx process to run the worker
const workerProcess = spawn('npx', ['tsx', workerPath], {
  stdio: 'inherit',
  env: process.env
});

workerProcess.on('error', (err) => {
  console.error('Failed to start streaming worker:', err);
  process.exit(1);
});

workerProcess.on('exit', (code) => {
  console.error(`Streaming worker exited with code ${code}`);
  process.exit(code);
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down streaming worker...');
  workerProcess.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down streaming worker...');
  workerProcess.kill('SIGINT');
});
