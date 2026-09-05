# Secrets runbook (maintainers)

`bun-plugin-react-native-testing-library` publishes with **npm Trusted Publishing (OIDC)** — not Automation tokens.
npm itself warns against granular tokens for CI/CD; use Trusted Publishing instead.

Optional Vault entries are only for **local** dry-runs (GitHub PAT). CI never calls Vault.

Inventory:

- [`.vault.yaml`](../.vault.yaml) — Vault address / mount / project / config
- [`secrets.manifest.yaml`](../secrets.manifest.yaml) — optional local secrets + OIDC checklist

## Quick commands

```bash
# Full report + Trusted Publishing setup links (never prints secret values)
bun run secrets:doctor

# If the package is not on npm yet (one-time)
bun run npm:seed -- --dry-run
bun run npm:seed -- --yes          # local interactive login
# or in CI (release job already runs this): bun run npm:seed -- --ci

# Validate optional Vault keys + confirm no required Actions secrets are missing
bun run secrets:check
```

## One-time: seed the package, then Trusted Publishing

npm cannot attach a Trusted Publisher until `bun-plugin-react-native-testing-library` exists on the registry
([npm/cli#8544](https://github.com/npm/cli/issues/8544) — OIDC cannot create a brand-new package).

### Option A — local seed (preferred)

1. Log in as yourself (interactive — **not** a granular Automation token):

   ```bash
   npm login --auth-type=web
   bun run npm:seed -- --yes
   ```

   npm **does not email** a publish OTP. Enable authenticator 2FA on your npm account
   ([account settings](https://www.npmjs.com/settings/~/account) or `npm profile enable-2fa auth-and-writes`),
   then complete the **browser** challenge (or pass a 6-digit authenticator code with `--otp=123456`).

   This publishes **`bun-plugin-react-native-testing-library@0.1.0`** without provenance. Later CI releases keep provenance via OIDC.

### Option B — CI bootstrap with a short-lived token

1. Create a short-lived npm granular access token (Read+Write, Bypass 2FA) and add it as the `NPM_TOKEN` Actions secret.
2. Push to `main` (or re-run the release job). The release step `bun run npm:seed -- --ci` publishes `0.1.0` and tags `v0.1.0`.
3. **Delete** `NPM_TOKEN` from the repo after the seed succeeds.

### Then: Trusted Publisher

1. Open **Trusted Publisher** (package Access settings — not “Granular Access Token”):
   https://www.npmjs.com/package/bun-plugin-react-native-testing-library/access
2. Add **GitHub Actions** publisher:
   - Organization/user: `crvouga`
   - Repository: `bun-plugin-react-native-testing-library`
   - Workflow filename: `ci.yml`
   - Environment: leave empty unless the release job uses one
3. Confirm the release job already has `permissions.id-token: write` in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
4. If missing, push the baseline tag: `git tag v0.1.0 && git push origin v0.1.0`

Docs: https://docs.npmjs.com/trusted-publishers

After that, green pushes to `main` with releasable commits publish via OIDC. **Do not** keep an npm Automation token or `NPM_TOKEN` on the repo.

## What exists where

| Credential | Where | Required |
| --- | --- | --- |
| npm Trusted Publisher (OIDC) | npm package settings | **Yes** (CI publish after seed) |
| `GITHUB_TOKEN` | Built into GitHub Actions | Automatic |
| `NPM_TOKEN` | Optional Actions secret | **Only** for first CI seed; delete after |
| `GH_PAT` | Optional Vault `personal/prd/github` | No (local dry-run only) |

## Optional: local release dry-run

CI does not need local npm credentials. For `bun run release:dry-run` you only need a GitHub token:

```bash
export VAULT_ADDR=https://vault.chrisvouga.dev
# optional — or use `gh auth token` / an existing GITHUB_TOKEN
export GITHUB_TOKEN="$(vault kv get -mount=secret -field=GH_PAT personal/prd/github)"

bun run verify-package
bun run release:dry-run
```

Populate optional PAT in Vault:

```bash
export VAULT_ADDR=https://vault.chrisvouga.dev
printf '%s' "$GH_PAT" | vault kv put -mount=secret personal/prd/github GH_PAT=-
```

Create a PAT (local only): https://github.com/settings/tokens

## Prerequisites (optional Vault tooling)

1. **Vault CLI** — [install](https://developer.hashicorp.com/vault/docs/install), then `export VAULT_ADDR=https://vault.chrisvouga.dev` and `vault login`
2. **GitHub CLI** — [install](https://cli.github.com/), then `gh auth login`

## Validate

```bash
bun run secrets:doctor
```

Healthy Trusted Publishing setup:

- Doctor prints the OIDC checklist with links (manual — npm has no CLI to verify publisher config)
- No required Vault or GitHub Actions secrets missing
- Optional `GH_PAT` may warn/skip if unused
- Release job preflight accepts OIDC without `NPM_TOKEN`

## CI note

The release job runs `bun run release:preflight`, then `bun run npm:seed -- --ci` (idempotent), then `semantic-release`.
Preflight requires either OIDC (`id-token`) or (legacy / seed) `NPM_TOKEN`. This package standardizes on OIDC after the first version exists. Preflight does not talk to Vault — use `secrets:doctor` locally for the setup checklist.
