# Local browser checks (Playwright)

The tests serve a temporary copy of the site locally. Wallet and registry responses in the 0.7 scenarios are simulated; they do not send transactions or read Polygon. The tests cover legacy page loading, 0.7 navigation, profile registration, three issuance forms and their backup, release confirmation, and verification display.

```bash
cd frontend/e2e
npm ci
npx playwright install firefox
npm test
```

By default the server listens on `127.0.0.1:4174` and tests use Firefox. Set `ODP_TEST_PORT` to use a different port, or set `ODP_TEST_BROWSER=chromium` after installing Chromium. Set `CI=1` to reject an existing server on that port.
