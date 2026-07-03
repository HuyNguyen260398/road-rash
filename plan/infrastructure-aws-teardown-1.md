---
goal: Decommission all road-rash AWS application environments and Terraform backend resources
version: 1.0
date_created: 2026-07-03
last_updated: 2026-07-03
owner: Huy
status: 'Completed'
tags: [infrastructure, aws, terraform, teardown, cost]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan decommissions the live road-rash staging and production AWS stacks, then removes the dedicated Terraform state bucket. It preserves account-shared resources that Terraform reads only as data sources.

## 1. Requirements & Constraints

- **REQ-001**: Destroy every managed resource in the `infra/envs/staging` Terraform state.
- **REQ-002**: Destroy every managed resource in the `infra/envs/prod` Terraform state.
- **REQ-003**: Destroy the dedicated `road-rash-tfstate-010382427026` S3 backend only after both environment states are empty.
- **REQ-004**: Use reviewed, saved Terraform destroy plans for environment mutations.
- **REQ-005**: Remove application data, uploaded thumbnails, identities, secrets, logs, DNS records, hosting, APIs, functions, and project IAM roles; this teardown intentionally has no data-retention requirement.
- **SEC-001**: Verify the AWS caller account is `010382427026` before mutation.
- **SEC-002**: Do not print or copy sensitive Terraform values.
- **CON-001**: Preserve the existing Route53 hosted zone because it is queried through `data.aws_route53_zone` and is shared outside this application.
- **CON-002**: Preserve the account-level GitHub Actions OIDC provider because it is queried through `data.aws_iam_openid_connect_provider.github` and is managed outside this project.
- **CON-003**: S3 buckets must set `force_destroy = true` before destruction so objects and historical versions do not block teardown.
- **GUD-001**: Destroy application environments before the S3 backend that stores their state.
- **PAT-001**: Execute production and staging as independent Terraform roots with separate saved plans and verification.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Establish an auditable inventory and make stateful S3 resources destroyable.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Review `docs/aws-deployment.md`, `infra/README.md`, both environment states, and bootstrap state; record documentation drift and externally owned resources. | ✅ | 2026-07-03 |
| TASK-002 | Set `force_destroy = true` on `infra/modules/s3/main.tf::aws_s3_bucket.thumbnails` and `infra/bootstrap/main.tf::aws_s3_bucket.state`. | ✅ | 2026-07-03 |
| TASK-003 | Run `terraform fmt -check -recursive` and validate the three Terraform roots. | ✅ | 2026-07-03 |
| TASK-004 | Verify `aws sts get-caller-identity` returns account `010382427026`. | ✅ | 2026-07-03 |

### Implementation Phase 2

- GOAL-002: Destroy both application environments through reviewed Terraform plans.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Apply only the thumbnail-bucket `force_destroy` metadata in staging and production, then create saved destroy plans under `/tmp`. | ✅ | 2026-07-03 |
| TASK-006 | Review saved plans and require only deletes plus the expected S3 metadata prerequisite; reject resource creation or replacement. | ✅ | 2026-07-03 |
| TASK-007 | Apply the saved production destroy plan, then verify `terraform -chdir=infra/envs/prod state list` is empty. | ✅ | 2026-07-03 |
| TASK-008 | Apply the saved staging destroy plan, then verify `terraform -chdir=infra/envs/staging state list` is empty. | ✅ | 2026-07-03 |

### Implementation Phase 3

- GOAL-003: Remove backend storage and verify absence of project resources.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-009 | Apply the bootstrap bucket `force_destroy` metadata and preserve non-sensitive final state inventory evidence in the execution transcript. | ✅ | 2026-07-03 |
| TASK-010 | Apply the reviewed bootstrap destroy plan, which deletes all backend object versions and the bucket. | ✅ | 2026-07-03 |
| TASK-011 | Query AWS by project names/tags across Amplify, API Gateway, Lambda, DynamoDB, S3, Cognito, SSM, CloudWatch Logs, IAM, and Route53 records; document any residue. | ✅ | 2026-07-03 |
| TASK-012 | Mark this plan `Completed` only when both environment states, the bootstrap state, and the AWS residual audit are clean. | ✅ | 2026-07-03 |

## 3. Alternatives

- **ALT-001**: Disable Amplify and Lambda without deleting data. Rejected because DynamoDB, S3, logs, identity, secrets, and state would remain billable or operational.
- **ALT-002**: Delete resources manually with AWS CLI or the console. Rejected because Terraform state would become stale and teardown coverage would be harder to prove.
- **ALT-003**: Preserve the backend bucket for easy restoration. Rejected because the request is to remove all application-relevant AWS resources and minimize ongoing cost.

## 4. Dependencies

- **DEP-001**: Valid AWS credentials authorized to manage account `010382427026` in `ap-southeast-1` and global IAM/S3 services.
- **DEP-002**: Terraform `>= 1.10` and the initialized S3 backends in `infra/envs/staging` and `infra/envs/prod`.
- **DEP-003**: Local bootstrap state at `infra/bootstrap/terraform.tfstate` until backend deletion completes.

## 5. Files

- **FILE-001**: `docs/aws-deployment.md` — reviewed deployment inventory; its opening live-state claim is stale.
- **FILE-002**: `infra/modules/s3/main.tf` — enables recursive thumbnail bucket deletion.
- **FILE-003**: `infra/bootstrap/main.tf` — enables recursive backend bucket deletion.
- **FILE-004**: `plan/infrastructure-aws-teardown-1.md` — teardown execution record.

## 6. Testing

- **TEST-001**: `terraform fmt -check -recursive infra` exits zero.
- **TEST-002**: `terraform validate` exits zero in bootstrap, staging, and production roots.
- **TEST-003**: Each destroy plan contains zero additions and zero in-place changes other than the separately reviewed `force_destroy` prerequisite.
- **TEST-004**: Environment `terraform state list` output is empty after each destroy.
- **TEST-005**: Bootstrap `terraform state list` output is empty after backend destruction.
- **TEST-006**: AWS residual queries return no road-rash application resources; shared Route53 zone and account OIDC provider are excluded by constraints.

## 7. Risks & Assumptions

- **RISK-001**: DynamoDB items, S3 objects and versions, Cognito users, SSM secrets, and CloudWatch logs are permanently deleted.
- **RISK-002**: A GitHub deployment running concurrently could race with teardown; destroying the environment Terraform IAM roles prevents subsequent workflow applies.
- **RISK-003**: Amplify custom-domain disassociation and IAM propagation can delay destroy operations.
- **RISK-004**: Resources created manually outside Terraform require separate identification and deletion after state destruction.
- **ASSUMPTION-001**: Both live state roots belong to the requested road-rash application.
- **ASSUMPTION-002**: The `nghuy.link` Route53 hosted zone and GitHub OIDC provider support other workloads and must remain.

Execution result: production destroyed 65 managed resources, staging destroyed 65 managed resources, and bootstrap destroyed 5 managed resources. Direct AWS service inventories returned no live road-rash resources. The Resource Groups Tagging API temporarily retained the two deleted Cognito ARNs in its asynchronous index; direct `DescribeUserPool` calls returned `ResourceNotFoundException` for both IDs.

## 8. Related Specifications / Further Reading

- `docs/aws-deployment.md`
- `infra/README.md`
- `infra/envs/staging/main.tf`
- `infra/envs/prod/main.tf`
