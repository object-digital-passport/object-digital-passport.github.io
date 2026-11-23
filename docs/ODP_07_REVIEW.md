# ODP 0.7 — review notes

Snapshot: 6 November 2026. This is a local review candidate, not a deployment or release approval.

The 0.7 pages are `verify-07.html`, `profile-07.html`, `issue-07.html` and `release-07.html`. The home page links to them and retains links to the earlier pages. The pinned generation and ABIs are in `backend/config/odp-0.7/`; the registry and edition satellite readers check the approved runtime hashes. Verification does not require a wallet. Edition creation and NFC hardware checks are outside this site's requested scope.

## Requirement map for reviewers

| Requirement | Implementation and local evidence | Boundary |
| --- | --- | --- |
| iPhone identity and new logo | `frontend/odp-logo.png` is byte-identical to `apple-app/Resources/Assets.xcassets/ODPLogo.imageset/ODPLogoWhite.png`; `frontend/css/odp-home.css` defines the monochrome layout. Playwright checks mobile and desktop widths. | Layout checks are not a visual design approval. |
| Pinned 0.7-redesign-8 | `backend/config/odp-0.7/generation.json`, ABI files and `odp-v07-reader.js`; reader tests and isolated-chain runtime-hash checks. | No public Polygon connection was made. |
| Walletless lookup and existing editions | `verify-07.html`, `odp-v07-verify.js` and the reader; unit tests cover snapshot and satellite checks, and the isolated chain covers edition opening and activation. | Browser scenarios use simulated reader responses; an individual item's possession or authenticity is not established. |
| C/B/P/M and three unique object types | Profile, draft and issuance modules; isolated-chain tests register all four roles and run physical, digital and mixed draft-to-export paths. | Wallet interactions in Playwright are simulated. |
| `.odpass` export and checking | Export, ZIP and bundle modules; exporter re-reads and verifies its archive against the local chain. Bundle tests include edition address-list integrity. | Local integrity alone does not confirm public registration. |
| Withdrawal and print confirmation | Release module and page; local-chain tests exercise both operations and Playwright checks their confirmation paths. | No public transaction or physical print test was performed. |
| RU/EN and URL compatibility | Both languages are present in new pages; existing pages remain and link to the 0.7 flows. Browser tests cover home links and transfer of a valid legacy verification locator. | Existing links are retained; the tests do not prove every external link in circulation. |

## Evidence

- `node --test backend/test/odp-v07-*.test.cjs`: 57 tests passed locally. These exercise schema and canonical vectors, ABI binding, archive validation, issuance jobs and recovery, Safe proposal identity, and reader state checks.
- `sh backend/test/run-local-chain.sh`: passed on an isolated Hardhat chain with synthetic keys and chain ID 137. It uses the sibling `specifications/chain` build artifacts and dependencies, verifies pinned runtime hashes, and exercises four profile roles, three unique-object draft-to-export paths, an edition activation, revocation, print finalization, and a Safe 1.4.1 cancellation. It does not contact Polygon. Set `ODP_SPEC_CHAIN_DIR` if that checkout is elsewhere.
- `ODP_TEST_BROWSER=chromium ODP_TEST_PORT=4187 npx playwright test` in `frontend/e2e`: 22 tests passed locally, including review of all four profile roles, print confirmation, and digital-original review (text rendered as text and image preview), exact-byte download and confirmation before issuance. Wallets, Safe SDK and registry responses are simulated; these tests do not establish real wallet or RPC compatibility. Layout checks cover 390px and 1440px. A Firefox retry on this machine timed out in browser launch with sandbox and graphics initialization errors; five launches failed, remaining tests were interrupted or not run. Firefox compatibility is unverified here.
- `node frontend/test/odp-i18n.test.mjs`: 13 assertions passed, including the intended English fallback test.
- `node backend/test/odp-contract-0.7.test.mjs`: 27 assertions passed for the existing 0.7 read layer. `node tools/check-translations.mjs --all` also passed after registering this review note.
- At the time of this review, the schema and Safe App builds reproduced the checked-in bundles byte for byte. CI now verifies the schema and WalletConnect bundles.

## Review limits and follow-up

### Local ethers 5 regression check (8 November 2026)

The site loads ethers 5.7.2, while the isolated-chain harness normally uses ethers 6. After installing backend test dependencies, exercise the site's issuance and archive paths with ethers 5 on the same synthetic chain:

```sh
ODP_ETHERS_V5_MODULE="$PWD/backend/node_modules/ethers" sh backend/test/run-local-chain.sh
```

The run covers preparation, issuance, lookup, export and archive verification for the 12 combinations of C/B/P/M profiles and physical/digital/mixed objects. CI also decodes an actual ethers 5 event in the reader unit tests. These checks do not exercise a browser wallet, a real Polygon transaction or the visual layout.

The isolated-chain harness also registers B, P and M profiles through synthetic Safe 1.4.1 wallets (2 of 3), submits physical, digital and mixed-object proposals through a simulated Safe SDK, executes them with synthetic owner signatures and verifies the exported archives. For each combination it restores the pending backup in a new store, confirms the minted passport without another proposal and exports it using the execution transaction hash; the Safe proposal hash is rejected as a receipt. It does not test the live Safe App or Safe transaction service.

The harness advances its synthetic chain into the next UTC month for an additional B/mixed proposal, cancels the expired Safe proposal with the same nonce, verifies its execution, re-prepares the job and completes issuance and archive verification. This is not a real-world Safe cancellation or Polygon transaction.

On macOS, `node backend/test/odp-v07-swift-interop.cjs` compiles the sibling `swift-core` ZIP implementation and checks both directions with synthetic bundle files: Swift ZIP writing followed by the site's local bundle inspection, and site ZIP writing followed by Swift ZIP reading. Set `ODP_SWIFT_CORE` if the sibling checkout is elsewhere. This is a container-format check, not a full iPhone app export or on-chain verification.

`node backend/test/odp-v07-app-fixtures.cjs` checks the sibling iPhone app's synthetic receipt fixtures: three intact archives pass local inspection against their fixture generation, while missing or changed payloads and that fixture generation presented as the site's approved deployment are rejected. Set `ODP_APP_ROOT` if the sibling checkout is elsewhere. These fixtures refer to a synthetic registry and do not demonstrate live registration.

The website accepts archives up to 105 MiB to fit two 50 MiB originals plus metadata. The current iPhone creator import applies a 100 MiB archive limit (`CreatorArchiveBounds`); the website warns during review when originals exceed 99 MiB. This is a conservative warning, not a guarantee that every smaller archive can be imported by the app.

On 8 November 2026 the incremental edition address-list verifier was compared with an independently computed Merkle root for 1,048,576 synthetic addresses in Node on macOS. The run completed successfully; this does not establish performance or memory use on an iPhone. Automated unit tests also cover odd counts, 128-entry boundaries and a duplicate across blocks.

- No public deployment, real wallet connection, real Safe proposal, Polygon transaction, physical NFC or printer test was performed. The Safe integration and WalletConnect paths need a separate authorized live acceptance before release.
- Safe proposal hashes and actual execution transaction hashes are distinct. The app preserves the former in the local job; an execution hash is needed for receipt verification. The Safe UI must select the same nonce for a cancellation, and a mismatch remains unresolved.
- An RPC may not expose historical activation logs or support the required historical reads. The verifier reports an unconfirmed activation block in that case; an activation is not ownership or physical authenticity.
- The archive's local integrity result is separate from finalized on-chain verification. A result based on a mock, local chain or cached state is not a public-network acceptance result.
- Recheck review and tests against the final diff. The sibling specification checkout and the site worktree can change independently; do not treat this snapshot as evidence of later changes.
