import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./pages-tests",
  timeout: 45000,
  expect: { timeout: 10000 },
  workers: 2,
  use: { baseURL: "http://127.0.0.1:4173/life-simulator/", headless: true },
  projects: [
    {
      name: "android-chrome",
      use: {
        ...devices["Pixel 7"],
        browserName: "chromium",
        launchOptions: process.env.CHROMIUM_EXECUTABLE
          ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
          : {},
      },
    },
    {
      name: "iphone-safari",
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
  ],
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/life-simulator/",
    reuseExistingServer: false,
  },
  reporter: "list",
});
