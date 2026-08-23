---
name: Translation or wording
about: A string is wrong, awkward, untranslated, or a new language is proposed
title: ''
labels: i18n
---

**Language:**
**File and key, if known:** <!-- e.g. frontend/localization/ru/verify.json → result.unknown -->

## What it says now

## What it should say

## Why

<!-- Ambiguous, mistranslated, too technical, wrong register, does not fit the layout… -->

---

<!--
Fixing an existing string is a pure data change — edit the JSON, nothing else. Keys you leave out
fall back to English rather than rendering blank, so a partial translation is a usable first pull
request.

Proposing a whole NEW language? Say which, but note it is not yet a data change:
frontend/js/odp-i18n.js hard-codes 'ru' as the only non-English locale. That has to be generalised
first. See CONTRIBUTING.md, "Translations".
-->
