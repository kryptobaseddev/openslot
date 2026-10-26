import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests of the calendar against the demo harness (demo/), at the four
 * widths the UX contract names. Touch widths emulate a touch screen.
 * Browsers: pnpm --filter @openslot/svelte exec playwright install chromium
 */
const widths = [
  { name: 'w320', width: 320, height: 640, touch: true },
  { name: 'w390', width: 390, height: 844, touch: true },
  { name: 'w768', width: 768, height: 1024, touch: true },
  { name: 'w1280', width: 1280, height: 800, touch: false }
];

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4318', trace: 'retain-on-failure' },
  projects: widths.map((w) => ({
    name: w.name,
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: w.width, height: w.height },
      hasTouch: w.touch,
      isMobile: w.touch && w.width < 700
    }
  })),
  webServer: {
    // The binary directly: a package-manager wrapper does not pass on the stop signal
    command: './node_modules/.bin/vite --config demo/vite.config.ts',
    url: 'http://localhost:4318',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
