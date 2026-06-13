# Seeding example trips

Loads 11 extra example trips (total 12) into the **staging** API. Trips are
authored under your account, so they also appear in "My trips".

## Prerequisites
- You have created at least one trip in staging (used as the My Maps template).
- You are signed in to the staging site in your browser.

## Get your ID token
1. Open the staging site signed in, open DevTools → Console.
2. Run:
   ```js
   (await (await import('https://esm.sh/aws-amplify/auth')).fetchAuthSession()).tokens.idToken.toString()
   ```
   …or copy the `Authorization: Bearer <token>` value from any authenticated
   request in the Network tab (drop the `Bearer ` prefix).

## Run
```bash
API_BASE_URL="https://<staging-api-base>" ID_TOKEN="<token>" pnpm dlx tsx scripts/seed-trips.ts
```

`API_BASE_URL` is the same value as `NEXT_PUBLIC_API_BASE_URL` in the staging
app. Re-running creates duplicates (there is no upsert).
