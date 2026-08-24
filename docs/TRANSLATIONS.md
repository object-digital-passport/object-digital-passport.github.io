# Translation status

Every document in this repository has a Russian version, or a recorded reason why it does not.
The table below is that record. `tools/check-translations.mjs` reads it in CI, so a document
cannot quietly appear without someone deciding what happens to it in the other language.

**English is normative.** Where a translation disagrees with the English text, the translation is
the bug. Every Russian file carries that note at its top.

This mirrors [the same file in the specification
repository](https://github.com/object-digital-passport/specifications/blob/main/docs/TRANSLATIONS.md),
and exists for the same reason: a Russian guide there told readers for a month that the live pages
talked to the v0.5 registry, months after v0.6 went live. Nothing reported it.

**Interface strings are not covered here.** They live under `frontend/localization/<lang>/*.json`,
are complete in English and Russian, and are checked by being data rather than prose — a missing
key falls back to English. See [`CONTRIBUTING.md`](../CONTRIBUTING.md#translations).

## Status vocabulary

| Status | Meaning |
| --- | --- |
| `translated` | A Russian version exists and is kept in step with the English one. |
| `planned` | A Russian version was agreed and has not been written yet. |
| `none: <reason>` | Deliberately not translated. The reason is part of the record. |

## What CI enforces

**Hard — these fail the build:**

1. An English document that appears in no row. Add it here and pick a status.
2. A row naming a file that does not exist.
3. A Russian file (`*.ru.md`, or anything under `docs/ru/`) that no row accounts for.

**Soft — reported on every run, never fatal:**

4. Identifiers present in an English document and absent from its translation — contract
   addresses, `v0.N` version strings, field and function names.
5. A translation whose last commit is older than its original's.

## The table

| English document | Russian | Status |
| --- | --- | --- |
| `README.md` | `README.ru.md` | translated |
| `CONTRIBUTING.md` | `CONTRIBUTING.ru.md` | translated |
| `CHANGELOG.md` | `CHANGELOG.ru.md` | translated |
| `docs/ANDROID.md` | `docs/ru/ANDROID.md` | translated |
| `docs/ANDROID_COMPANION_APP.md` | `docs/ru/ANDROID_COMPANION_APP.md` | translated |
| `docs/TRANSLATIONS.md` | — | none: a file list this script reads; a second copy in Russian would be one more pair to keep in step, which is the problem this file exists to solve |
| `.github/*` | — | none: issue and pull-request templates, which GitHub renders in one language |
| `backend/test/vectors/README.md` | — | none: a note about test fixtures, read only by someone editing them |
| `frontend/e2e/README.md` | — | none: how to run the smoke tests, read only by someone running them |
| `docs/community/*` | — | none: an archived discussion draft, kept as written |

## Running it yourself

```bash
node tools/check-translations.mjs
```

Add `--all` to list every soft finding instead of the first few per file.
