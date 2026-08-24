# ODP — reference website

*По-русски: [`README.ru.md`](README.ru.md).*

The example web interface for **[Object Digital Passport](https://github.com/object-digital-passport/specifications)**: register an identity, issue a passport for an object, and verify one. Live at **https://object-digital-passport.github.io/**.

Verification is free and needs no wallet: [**verify something**](https://object-digital-passport.github.io/verify.html).

## This is one implementation, not the standard

The protocol lives in its own repository, and it is the normative source:

- **[Specification](https://github.com/object-digital-passport/specifications/blob/main/SPEC.md)** — what a passport is and how verification works
- **[Contracts, schema, deployed addresses](https://github.com/object-digital-passport/specifications)**

Anything this site does that the specification does not require is a choice made here, and you are free to make a different one. Nothing about this site is privileged: a passport registered through it is readable by any implementation, forever, without asking anyone.

| Path | Role |
|------|------|
| [`frontend/`](frontend/) | HTML pages, CSS, UI scripts, interface strings under `localization/` |
| [`backend/`](backend/) | Browser-side registry client: ABI helpers, WalletConnect bundle, `registry-config.json`. There is no server — "backend" here means the code that talks to the chain from the page |
| [`docs/`](docs/) | How to use the site, and the Android companion integration |
| [`frontend/e2e/`](frontend/e2e/) | Playwright smoke tests |

## Run it locally

```bash
TMP=$(mktemp -d) && cp -r frontend/. "$TMP/" && cp -r backend "$TMP/backend" && cd "$TMP" && python3 -m http.server 8080
# → http://127.0.0.1:8080/verify.html
```

Static files only, no build step — which is why the WalletConnect bundle is committed rather than built on deploy.

## Rebuilding the WalletConnect bundle

```bash
cd backend && npm install && npm run build:wc
```

`backend/js/odp-wallet-wc.bundle.js` is generated output. Code scanning ignores it, because findings inside it are in third-party code and the next build overwrites any edit.

## Which registry it talks to

The deployed contract address is injected at deploy time from the `ODP_CONTRACT_ADDRESS` Actions secret, and falls back to the value written into the pages. Current addresses for every protocol version are in the [deployment table](https://github.com/object-digital-passport/specifications/blob/main/docs/GUIDE.md#current-release).

## History

[`CHANGELOG.md`](CHANGELOG.md). The site was `web/` inside the protocol repository until August 2026; its commits came across intact, so `git log` reaches back to the first release in March.

MIT.
