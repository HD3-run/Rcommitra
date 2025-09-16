import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
async function loadEnv() {
  const envFile = process.env.NODE_ENV === 'production' ? 'prod.env' : 'dev.env';
  const envPath = path.join(__dirname, 'envfiles', envFile);

  if (fs.existsSync(envPath)) {
    const { config } = await import('dotenv');
    config({ path: envPath });
    console.log(`Loaded environment from ${envFile}`);
  } else {
    console.warn(`Environment file ${envFile} not found, using system environment`);
  }
}

await loadEnv();

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  console.log('Starting production server...');
  
  // Start the compiled backend
  const backend = spawn('node', ['dist/backend/index.js'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });

  backend.on('error', (error) => {
    console.error('Failed to start backend:', error);
    process.exit(1);
  });

  backend.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
    process.exit(code);
  });

  // Serve static frontend files
  const express = (await import('express')).default;
  const frontendApp = express();
  const frontendPort = process.env.FRONTEND_PORT || 3000;

  frontendApp.use(express.static(path.join(__dirname, 'dist', 'frontend')));
  
  frontendApp.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'frontend', 'index.html'));
  });

  frontendApp.listen(frontendPort, () => {
    console.log(`Frontend server running on port ${frontendPort}`);
  });

} else {
  console.log('Starting development servers...');
  
  // Start backend in development mode
  const backend = spawn('npm', ['run', 'dev:backend'], {
    stdio: 'inherit',
    shell: true
  });

  // Start frontend in development mode
  const frontend = spawn('npm', ['run', 'dev:frontend'], {
    stdio: 'inherit',
    shell: true
  });

  // Handle process cleanup
  process.on('SIGINT', () => {
    console.log('\nShutting down development servers...');
    backend.kill('SIGINT');
    frontend.kill('SIGINT');
    process.exit(0);
  });
}