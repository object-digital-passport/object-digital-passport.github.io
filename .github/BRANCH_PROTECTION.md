# Branch protection

[`rulesets/main-default-branch.json`](rulesets/main-default-branch.json) is committed JSON that
GitHub imports directly: changes to `main` go through a pull request, the three CI jobs must pass,
review threads must be resolved, and the branch cannot be deleted or force-pushed. Repository
admins can bypass, so a solo owner is never locked out.

It targets `~DEFAULT_BRANCH` rather than the literal name `main`, so renaming the default branch
does not silently un-protect it.

> Applying it is a deliberate act — nothing here configures GitHub on its own.

## Apply it

**Settings → Rules → Rulesets → New ruleset → Import a ruleset**, then upload the JSON. Or:

```bash
gh api --method POST /repos/object-digital-passport/object-digital-passport.github.io/rulesets \
  --input .github/rulesets/main-default-branch.json
```

To change it afterwards, edit the JSON here, then `PUT` it to
`/repos/{owner}/{repo}/rulesets/{id}` — `gh api /repos/{owner}/{repo}/rulesets` lists the ids.
Editing in the web UI instead leaves this file lying, which is the failure mode committing it was
meant to prevent.

## Required status checks

Named exactly as the jobs in [`ci.yml`](workflows/ci.yml) name themselves:

`Playwright smoke` · `Read-layer unit tests` · `Markdown links`

The protocol repository carries [the same
pattern](https://github.com/object-digital-passport/object-digital-passport/blob/main/.github/BRANCH_PROTECTION.md),
with a stricter second ruleset for when there is more than one maintainer.
