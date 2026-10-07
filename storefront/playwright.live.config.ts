import { defineConfig } from "@playwright/test";

const liveUrl = "http://127.0.0.1:3001";

export default defineConfig({
  testDir: "./e2e-live",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "./test-results-live",
  use: {
    baseURL: liveUrl,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "npm run start:live",
    url: liveUrl,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      STOREFRONT_DIRECTUS_GATEWAY: "true",
      STOREFRONT_MOCK_MODE: "false",
      STOREFRONT_ALLOW_MOCK_FALLBACK: "false",
      PORT: "3001",
    },
  },
  projects: [
    { name: "desktop-chromium", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
    { name: "mobile-chromium", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "mobile-webkit", use: { browserName: "webkit", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
