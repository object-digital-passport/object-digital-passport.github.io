const path = require("path");
const { defineConfig } = require("@playwright/test");

const webRoot = path.join(__dirname, "../..");
const port = Number(process.env.ODP_TEST_PORT || 4174);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid ODP test port");
const browserName = process.env.ODP_TEST_BROWSER || "firefox";
if (!["firefox", "chromium", "webkit"].includes(browserName)) throw new Error("Invalid ODP test browser");

module.exports = defineConfig({
  testDir: ".",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName,
    trace: "on-first-retry",
  },
  webServer: {
    command:
      `bash -c 'TMP=$(mktemp -d) && rsync -a --exclude=e2e frontend/ "$TMP/" && mkdir -p "$TMP/backend" && cp -r backend/js backend/config "$TMP/backend/" && cd "$TMP" && python3 -m http.server ${port} --bind 127.0.0.1'`,
    cwd: webRoot,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
