# Contributing to the reference website

*По-русски: [`CONTRIBUTING.ru.md`](CONTRIBUTING.ru.md).*

This repository is **one implementation** of [Object Digital
Passport](https://github.com/object-digital-passport/specifications), not the standard. That
distinction decides where your contribution belongs, so it is the first question to settle.

## Which repository does this belong in?

| If it is about… | Open it in |
|---|---|
| What a passport **is**, what verification **must** check, the schema, the contracts | **[the protocol repository](https://github.com/object-digital-passport/specifications/issues)** |
| What this site **looks like** or **does** — pages, wording, layout, browser bugs, translations | **here** |

A useful test: if a different implementation would have to change too, it is a protocol question.
If this site could fix it alone and still be conformant, it belongs here.

Community conduct is governed by the protocol repository's [Code of
Conduct](https://github.com/object-digital-passport/specifications/blob/main/docs/CODE_OF_CONDUCT.md),
which applies to both repositories.

## Language

**Issues and pull requests are written in English**, so that everyone in the community can follow
the same thread. The interface itself is bilingual — see below.

## Security

Do **not** post exploitable details in a public issue. Follow the protocol repository's [security
policy](https://github.com/object-digital-passport/specifications/blob/main/docs/SECURITY.md);
it covers this repository too.

## Run it locally

No build step, no server — the pages are static and talk to the chain from the browser.

```bash
TMP=$(mktemp -d) && cp -r frontend/. "$TMP/" && cp -r backend "$TMP/backend" && cd "$TMP" && python3 -m http.server 8080
# → http://127.0.0.1:8080/verify.html
```

## What is where

| Path | Contains |
|---|---|
| `frontend/` | The pages, CSS and UI scripts |
| `frontend/localization/{en,ru}/` | Every string the interface shows |
| `backend/` | Code that talks to the registry from the page — ABI helpers, WalletConnect bundle, `registry-config.json` |
| `frontend/e2e/` | Playwright smoke tests |

## Translations

Interface strings live in `frontend/localization/<lang>/*.json`. English and Russian exist.

On the home and legacy pages, edit the matching JSON file. On the ODP 0.7 pages, English
and Russian strings are in the matching `frontend/js/odp-v07-*.js` page script.

To add a language, register its lowercase language tag, flag, abbreviation and native name
in `ODP_LOCALES` in `frontend/js/odp-i18n-boot.js`. You can also supply `switchLabel` for
the 0.7 language picker and `readmeUrl` for the link to the translated specification README.

Add translations under `frontend/localization/<code>/`:

- Home and legacy pages use `common.json` and their existing page JSON files.
- ODP 0.7 uses `verify-07.json`, `profile-07.json`, `issue-07.json` and `release-07.json`.
  Use a flat object with the keys from the page script's English dictionary.
- Missing or empty strings and missing files fall back to English. Test the translation in a browser.

**Documentation is translated too, and CI enforces it.** Every document in this repository has a
Russian version or a written reason why it does not — the record is
[`docs/TRANSLATIONS.md`](docs/TRANSLATIONS.md), checked by the `Translation parity` job. Adding a
document means adding a row; changing one means checking its translation.

Translations are **informational**. The normative text is
[`SPEC.md`](https://github.com/object-digital-passport/specifications/blob/main/SPEC.md),
in English; where a translation and the specification disagree, the specification is right and the
translation is a bug.

## Pull requests

1. Branch from `main` with a descriptive name — `fix/verify-mobile-layout`, `i18n/add-german`.
2. Keep commits focused, and match the style already in the file you are editing.
3. Run the tests below before opening the pull request.
4. Open the pull request into `main`. CI runs the same four jobs and all must pass.

```bash
cd frontend/e2e && npm install && npx playwright test    # smoke tests
node backend/test/odp-contract-0.7.test.mjs              # read-layer unit tests, from the repo root
```

`backend` has no `npm test` — its `test` script is npm's default stub and exits 1. The read-layer
tests are a plain Node script, run exactly as CI runs it above.

`main` is protected: it takes pull requests only, and the four CI jobs are required. See
[`.github/BRANCH_PROTECTION.md`](.github/BRANCH_PROTECTION.md).

## One file is generated

`backend/js/odp-wallet-wc.bundle.js` is build output, committed because deployment has no build
step. Do not edit it by hand — the next `npm run build:wc` in `backend/` overwrites the change.

## Beyond code

Wording, visual design, accessibility and translation review are as welcome as patches. If you
verified a real object with this site and something confused you, that is a bug report worth
opening.
