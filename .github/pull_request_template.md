## What this changes

<!-- One or two sentences. What is different for someone using the site? -->

## Why

<!-- The problem this solves. Link an issue if there is one. -->

## How it was checked

<!-- Which pages, which browsers. Paste the test output if you ran it. -->

- [ ] `cd frontend/e2e && npx playwright test` passes
- [ ] `cd backend && npm test` passes
- [ ] Checked in a browser, not only in the tests

## Scope

- [ ] This changes only how the site behaves, not what the protocol requires

<!--
If the answer is no — if a conformant implementation would have to change too — the change belongs
in https://github.com/object-digital-passport/object-digital-passport instead, or alongside a
specification change there.
-->

## Strings

- [ ] No user-visible string was added without adding it to `frontend/localization/en/` and `ru/`
- [ ] Or: this change adds no user-visible strings
