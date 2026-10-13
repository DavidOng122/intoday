import { defineConfig } from '@playwright/test';

const supabaseUrl = process.env.E2E_SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.E2E_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const supabaseHost = new URL(supabaseUrl).hostname;

if (!['127.0.0.1', 'localhost', '::1'].includes(supabaseHost)) {
  throw new Error('Browser E2E tests may only target a loopback Supabase instance.');
}
if (!anonKey || !serviceRoleKey) {
  throw new Error('Set local E2E_SUPABASE_ANON_KEY and E2E_SUPABASE_SERVICE_ROLE_KEY before running browser tests.');
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  globalSetup: './e2e/global-setup.js',
  globalTeardown: './e2e/global-teardown.js',
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    browserName: 'chromium',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_ANON_KEY: anonKey,
    },
  },
});
