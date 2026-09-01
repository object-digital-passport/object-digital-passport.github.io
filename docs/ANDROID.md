# Android companion — ODP integration

*По-русски: [`ru/ANDROID.md`](ru/ANDROID.md).*

The NFC verifier app lives in a separate repository, `android-verifier` — renamed from
`odp-android-companion` on 2026-08-22. **It is private, and the app was started and never
finished**, so the name is given here without a link and the pages below are unreachable. No
public implementation of the `nfc` anchor exists on any platform; the reference implementation
is now the ODP app for iOS.

This repository keeps the web UI and the handoff bridge. Protocol rules are in the
[specification repository](https://github.com/object-digital-passport/specifications).

What follows describes the handoff as it was designed. It is kept because the trust-step
separation below is still the right shape for whatever reads a seal next.

## Role in ODP

| Layer | Where |
|-------|--------|
| Registry, hashes, SPEC | [Specification repository](https://github.com/object-digital-passport/specifications) — [SPEC.md](https://github.com/object-digital-passport/specifications/blob/main/SPEC.md) |
| Verify / Passport web UI | [frontend/verify.html](../frontend/verify.html), [frontend/passport.html](../frontend/passport.html) |
| Web → Android handoff | [frontend/js/odp-android-companion.js](../frontend/js/odp-android-companion.js) |
| NFC runtime on device | `android-verifier` (private, unfinished) |

The companion does **not** replace on-chain verification in the browser. It adds NFC carrier read/write, EV2/TagTamper evidence, and honest separate result rows.

## Handoff

Export from Verify or Manage passport produces versioned JSON (`odp-android-companion-handoff`) with trusted fields:

- `passportId`, `verifyUrl`, `ndppCommitmentHash`, `nfcPublicKey`, `dataHash`
- optional `chipBinding.profileId`, `proof`, `route`

Delivery:

- **Deep link:** `odpcompanion://import?handoff=<url-encoded-json>`
- **Share / copy** — same JSON as plain text

Implementation: [`frontend/js/odp-android-companion.js`](../frontend/js/odp-android-companion.js) (`buildAndroidCompanionHandoff`, `openAndroidCompanionImport`).

## Carrier shape (reference)

NDEF record 1: GitHub-hosted Verify URL. Record 2: raw `odp:off` bytes.  
`ndppCommitmentHash = SHA-256(raw offline payload bytes)` — not the URL or full NDEF message.

First-link target remains Verify Pages until `odp://` resolver context exists (SPEC).

## Trust steps (keep separate)

1. Carrier opened  
2. Offline payload vs `ndppCommitmentHash`  
3. Chip session (EV2 / TagTamper)  
4. Chip vs on-chain `nfcPublicKey` (mirror profile or EV2 key per deployment)  
5. Canonical `.odpass` / `dataHash`  

Normative NFC wording: **SPEC** (issuer order, `highAssuranceSeal` for TagTamper).  
Practical chip + TagWriter workflow: [ANDROID_NTAG424DNA_TAGTAMPER.md](https://github.com/object-digital-passport/specifications/blob/main/docs/ANDROID_NTAG424DNA_TAGTAMPER.md).  
MVP scope checklist: [ANDROID_VERIFIER_MVP.md](https://github.com/object-digital-passport/specifications/blob/main/docs/ANDROID_VERIFIER_MVP.md).

## Install

There is nothing to install. The app was never released, and its repository is private.
