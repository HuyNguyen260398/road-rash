# Reconciling favoriteCount

`Trip.favoriteCount` is a **denormalized** counter maintained by the favorites
Lambda as a separate write from the `Favorite` row. A crash between the two
writes — or a favorite created during a Lambda redeploy — can leave the counter
drifted from the true number of `Favorite` rows (RISK-005). This script
recomputes every counter from the `Favorite` table (the source of truth) and
corrects the drifted trips.

## What it does

- Scans the `Trip` and `Favorite` tables directly (AWS SDK, **not** the API).
- Recomputes each trip's real favorite count and reports any drift.
- **Dry-run by default** — writes nothing unless you pass `--apply`.

## Prerequisites

AWS credentials with read access to both tables and `UpdateItem` on `Trip`
(e.g. `aws sts get-caller-identity` succeeds for the staging account).

## Run

```bash
# Dry run — just report drift (default tables: road-rash-staging-*):
pnpm dlx tsx scripts/reconcile-favorites.ts

# Apply the corrections:
pnpm dlx tsx scripts/reconcile-favorites.ts --apply
```

Override the targets with env vars when needed:

```bash
AWS_REGION=ap-southeast-1 \
TRIP_TABLE=road-rash-staging-Trip \
FAVORITE_TABLE=road-rash-staging-Favorite \
pnpm dlx tsx scripts/reconcile-favorites.ts --apply
```

It is safe to re-run: once counters are in sync it reports "nothing to do".
