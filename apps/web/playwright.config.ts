import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  timeout: 40_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/report.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    video: 'on',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: [
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--enable-unsafe-swiftshader',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1050 },
      },
    },
  ],
  webServer: {
    command: process.env.CAMPUS_TEST_PRODUCTION ? 'pnpm start' : 'pnpm dev',
    url: 'http://127.0.0.1:3000/game',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
