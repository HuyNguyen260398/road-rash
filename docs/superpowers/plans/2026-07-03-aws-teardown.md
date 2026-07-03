# AWS Teardown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permanently remove both road-rash AWS environments and their dedicated Terraform backend to stop application costs.

**Architecture:** Treat `infra/envs/prod`, `infra/envs/staging`, and `infra/bootstrap` as three ordered Terraform roots. Make all S3 buckets recursively destroyable, destroy and verify the two application states independently, then destroy the backend last while preserving only externally managed shared resources.

**Tech Stack:** Terraform >= 1.10, AWS provider 5.x, AWS CLI, S3 remote state with native locking

---

### Task 1: Validate ownership and destructive scope

**Files:**
- Read: `docs/aws-deployment.md`
- Read: `infra/README.md`
- Read: `infra/envs/staging/main.tf`
- Read: `infra/envs/prod/main.tf`

- [x] **Step 1: Verify the AWS account**

Run: `aws sts get-caller-identity --query Account --output text`
Expected: exactly `010382427026`.

- [x] **Step 2: Inventory both environment states**

Run: `terraform -chdir=infra/envs/staging state list` and `terraform -chdir=infra/envs/prod state list`.
Expected: each state contains the road-rash API Gateway, Cognito, DynamoDB, IAM, Lambda, S3, SSM, Amplify, CloudWatch Logs, and Route53 record resources described in `docs/aws-deployment.md`.

- [x] **Step 3: Identify exclusions**

Preserve `data.aws_route53_zone.this` and `data.aws_iam_openid_connect_provider.github`; data sources are not Terraform-managed resources and both are documented as shared.

### Task 2: Enable complete S3 destruction

**Files:**
- Modify: `infra/modules/s3/main.tf`
- Modify: `infra/bootstrap/main.tf`

- [x] **Step 1: Configure recursive deletion**

Set `force_destroy = true` on `aws_s3_bucket.thumbnails` and `aws_s3_bucket.state`.

- [x] **Step 2: Format and validate**

Run: `terraform fmt -check -recursive infra`, then run `terraform validate` in `infra/bootstrap`, `infra/envs/staging`, and `infra/envs/prod`.
Expected: every command exits zero.

- [x] **Step 3: Apply only the S3 deletion metadata**

Run `terraform apply -target=module.s3.aws_s3_bucket.thumbnails -auto-approve` in each environment, then `terraform apply -target=aws_s3_bucket.state -auto-approve` in bootstrap.
Expected: only the bucket `force_destroy` state changes; no resource is created or replaced.

### Task 3: Destroy production

**Files:**
- Runtime artifact: `/tmp/road-rash-prod-destroy.tfplan`

- [x] **Step 1: Create and inspect the saved plan**

Run: `terraform -chdir=infra/envs/prod plan -destroy -out=/tmp/road-rash-prod-destroy.tfplan` and `terraform -chdir=infra/envs/prod show /tmp/road-rash-prod-destroy.tfplan`.
Expected: the summary contains only deletions and no additions.

- [x] **Step 2: Apply the exact reviewed plan**

Run: `terraform -chdir=infra/envs/prod apply -auto-approve /tmp/road-rash-prod-destroy.tfplan`.
Expected: Terraform reports `Destroy complete`.

- [x] **Step 3: Verify empty production state**

Run: `terraform -chdir=infra/envs/prod state list`.
Expected: no output.

### Task 4: Destroy staging

**Files:**
- Runtime artifact: `/tmp/road-rash-staging-destroy.tfplan`

- [x] **Step 1: Create and inspect the saved plan**

Run: `terraform -chdir=infra/envs/staging plan -destroy -out=/tmp/road-rash-staging-destroy.tfplan` and `terraform -chdir=infra/envs/staging show /tmp/road-rash-staging-destroy.tfplan`.
Expected: the summary contains only deletions and no additions.

- [x] **Step 2: Apply the exact reviewed plan**

Run: `terraform -chdir=infra/envs/staging apply -auto-approve /tmp/road-rash-staging-destroy.tfplan`.
Expected: Terraform reports `Destroy complete`.

- [x] **Step 3: Verify empty staging state**

Run: `terraform -chdir=infra/envs/staging state list`.
Expected: no output.

### Task 5: Destroy backend and audit residue

**Files:**
- Runtime evidence: `/tmp/road-rash-final-state-inventory.txt`

- [x] **Step 1: Preserve non-sensitive inventory evidence**

Write only resource addresses and Terraform outputs—not state values—to `/tmp/road-rash-final-state-inventory.txt` before deleting the backend.

- [x] **Step 2: Destroy bootstrap**

Run: `terraform -chdir=infra/bootstrap destroy -auto-approve`.
Expected: Terraform deletes the versioned state bucket and reports `Destroy complete`.

- [x] **Step 3: Verify bootstrap state**

Run: `terraform -chdir=infra/bootstrap state list`.
Expected: no output.

- [x] **Step 4: Audit AWS residue**

Query AWS resource APIs for names beginning with `road-rash-`, SSM paths `/staging/road-rash/` and `/prod/road-rash/`, Lambda log groups `/aws/lambda/road-rash-`, and Route53 records `roadrash.stg.nghuy.link` and `roadrash.nghuy.link`.
Expected: no application resources remain. Preserve the `nghuy.link` hosted zone and account-level `token.actions.githubusercontent.com` OIDC provider.
