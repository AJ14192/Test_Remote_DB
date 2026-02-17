import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.BASE_URL, // e.g., https://staging.example.com
    headless: true,
    trace: 'on-first-retry',
  },
  reporter: [['list'], ['html']],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});