# road-rash infrastructure (Terraform)

All AWS resources for road-rash are provisioned with Terraform. Terraform is the
**single source of truth** — do not edit resources in the AWS console.

- Remote state lives in an S3 bucket with **native locking** (`use_lockfile = true`,
  Terraform ≥ 1.10) — no DynamoDB lock table.
- Amplify is **hosting/CI only**. There is no Amplify Gen 2 backend and no AppSync.

## Layout

```
infra/
├── bootstrap/          # one-time: creates the S3 state bucket (LOCAL state)
├── modules/            # reusable resource modules, one per concern
│   ├── cognito/  dynamodb/  s3/  lambda/  apigateway/  hosting/  iam/
└── envs/               # deployable roots — one per environment
    ├── staging/        # → state key env/staging/terraform.tfstate
    └── prod/           # → state key env/prod/terraform.tfstate
```

The **deployable roots are `envs/staging` and `envs/prod`** — each composes the
modules and owns its own `backend "s3"` block with an environment-specific state
`key`. The canonical command is:

```
terraform -chdir=infra/envs/<env> init|plan|apply
```

## Bootstrap-before-backend ordering (RISK-001)

The S3 backend cannot store the state for the very bucket that holds it, so the
bucket is created first with **local** state, then every env root uses it as a
remote backend.

### Step 1 — create the state bucket (once per AWS account)

```bash
terraform -chdir=infra/bootstrap init
terraform -chdir=infra/bootstrap apply          # review the plan first
terraform -chdir=infra/bootstrap output state_bucket_name
```

This bucket is versioned, SSE-encrypted, public-access-blocked, and TLS-only.
Its own state stays local (committed nowhere — see `.gitignore`).

### Step 2 — point each env root at the bucket

Backend blocks **cannot use variables**, and the bucket name is account-specific,
so the account-specific bits (`bucket`, `region`) are supplied at init time via a
`backend.hcl` file while the static bits (`key`, `use_lockfile`, `encrypt`) live
in each env's `backend.tf`.

```bash
cd infra/envs/staging
cp backend.hcl.example backend.hcl      # fill in the bucket name from Step 1
terraform -chdir=infra/envs/staging init -backend-config=backend.hcl
```

If you had been running an env root with **local** state first, migrate it into
S3 with:

```bash
terraform -chdir=infra/envs/staging init -migrate-state -backend-config=backend.hcl
```

## Per-env apply workflow

```bash
cd infra/envs/<env>
terraform init -backend-config=backend.hcl
terraform plan  -var-file=example.tfvars      # or your own terraform.tfvars
terraform apply -var-file=example.tfvars
```

A `.terraform.tfstate.lock.info`-style lock is held in S3 during plan/apply via
`use_lockfile`.

## Validate locally without AWS credentials

`terraform validate` only needs providers/modules installed, not a backend, so
you can check any root offline:

```bash
terraform -chdir=infra/envs/staging init -backend=false
terraform -chdir=infra/envs/staging validate
terraform -chdir=infra fmt -check -recursive
```

## Outputs → Amplify env vars

Each env root exposes outputs (Cognito IDs, API base URL, region, thumbnails
bucket). These feed Amplify Hosting **environment variables** (the `hosting`
module wires `NEXT_PUBLIC_*` names for anything the browser needs). The Next.js
app reads them via `process.env.NEXT_PUBLIC_*` at build/runtime — there is no
`amplify_outputs.json`. Secrets (Gemini key, Google OAuth secret) never become
Amplify env vars; they live in SSM Parameter Store and are read at Lambda runtime.

## Conventions (PAT-001)

- One module per concern under `modules/`; env roots only compose modules + set
  env-specific inputs and backend `key`.
- Provider version pinned `~> 5.0`; `required_version >= 1.10`.
- Keep `.terraform.lock.hcl` committed; never commit `*.tfstate`, `*.tfvars`
  (except `*.example`), or `backend.hcl`.
