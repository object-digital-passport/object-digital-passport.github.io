# Changelog

All notable changes to the ODP reference website are documented in this file. Russian translation: [`CHANGELOG.ru.md`](CHANGELOG.ru.md).

The format is based on [Keep a Changelog 2.0.0](https://keepachangelog.com/en/2.0.0/) — the six
change types only, with the optional per-release summary that 2.0.0 introduced.

**This site is not versioned like the protocol.** Each `v0.x` of ODP is a separate on-chain
registry; this repository is one implementation that talks to whichever registry it is pointed
at. Entries here are dated, and note which protocol line the site targets. The protocol's own
history is in the [specification repository](https://github.com/object-digital-passport/specifications/blob/main/CHANGELOG.md).

## [Unreleased]

### Changed

- Split out of the protocol repository, with all 158 commits of site history preserved. Published at <https://object-digital-passport.github.io/> instead of two path segments deep, which makes the address independent of what any repository is called.
- `ODP_LIVE_BASE`, the single constant every generated verify link derives from, points at the new origin.
- The monorepo landing page is gone — the frontend has its own index, and the specification is published from its own repository now.

### Security

- `axios` pinned to ≥1.18.0 through `overrides`, resolving 28 advisories. The fix had landed in the protocol repository before this one was split off, and did not travel — the split was taken from a branch that predated it, so the alerts arrived here the day the repository was created. Nothing vulnerable ships either way: `axios` is absent from the built WalletConnect bundle.

### Added

- **CI, for the first time.** The Playwright smoke test has been in this tree since v0.4.1 and no workflow had ever run it. A markdown link check and the read-layer unit tests run beside it.
- Known-answer vectors under `backend/test/vectors/`, copied from the specification, so this implementation can prove it agrees with the deployed contract without reading the contract's source.
- Redirect stubs at `/demo/*` so every address the monorepo served keeps resolving, query string intact — that is what carries `?id=ODP-…` on a scanned link.
- CodeQL configuration that excludes the generated WalletConnect bundle. Thirteen alerts against third-party build output were recurring against a file the next build overwrites.

## Earlier history

Before this repository existed, the site was `web/` inside the protocol repository. Its commits
came across intact, so `git log` reaches back to **22 March 2026** and the first release. What
changed in each protocol line — and what the site had to do to follow — is recorded in that
repository's [changelog](https://github.com/object-digital-passport/specifications/blob/main/CHANGELOG.md)
and [release notes](https://github.com/object-digital-passport/specifications/tree/main/docs/releases).

[Unreleased]: https://github.com/object-digital-passport/object-digital-passport.github.io/commits/main
