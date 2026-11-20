<!-- Purpose: Propose the institutional role, permission-check, and workflow-separation policy. -->

# ADR 0005: Use Job Roles, Permission Checks, and Separation of Duties

- **Status:** Proposed
- **Date:** 2026-11-20

## Context

The [RBAC matrix](../RBAC_MATRIX.md) and [role catalogue](../ROLES.md) define
14 job roles, 96 permission keys, record scopes, and separation-of-duties
requirements. The Prisma schema persists `Role`, `Permission`, `UserRole`, and
`RolePermission`; `RbacRepository` unions permissions across a user's roles,
and `PermissionsGuard` requires every declared permission and denies missing
metadata.

The implementation does not yet conform to the policy. `prisma/seed.ts`
currently defines five roles and 61 permission keys, including grants that the
matrix prohibits for `admin`. The API contains both `PermissionsGuard` and
`RolesGuard`, but no production controller uses `@Permissions`; the E2E
protected-route example uses `RolesGuard` and `@Roles("admin")`. The documented
payment, admission, administrator-grant, and result-publication workflows are
not implemented in the current business modules.

## Decision

1. Treat roles as job-based bundles of permission grants, not as endpoint
   authorization predicates. Users may hold multiple roles; effective
   permissions are their union, subject to all resource scopes and workflow
   controls.
2. Protect each authenticated endpoint with `@Permissions` keys from
   `docs/RBAC_MATRIX.md`. Deny by default when permission metadata is missing,
   the user is unauthenticated, a required permission is absent, or record
   scope cannot be established. Do not authorize production endpoints by role
   name.
3. Enforce `OWN`, `OWN-DEPT`, `OWN-FACULTY`, and assigned-resource scopes in
   the owning service and query. Do not trust a client-supplied owner or scope.
4. Enforce the matrix's separation-of-duties rules in the business workflow,
   independent of the user's permission union:
   - A payment recorder cannot void that payment. A different
     `finance_manager` approves and records the reason and immutable reversal.
   - The document reviewer cannot admit the applicant; admission decisions
     belong to `admissions_head`.
   - An administrator cannot approve their own admin-role grant or removal; a
     second administrator must approve it.
   - Lecturers enter marks, an HOD or exams officer moderates, and the
     registrar publishes results. One actor cannot perform multiple stages.
   - `auditor` is read-only.
5. Keep `docs/RBAC_MATRIX.md` as the authorization source of truth. Align role
   and permission seeds with it before relying on the matrix for runtime access.
   Never enable online payment flags in application code or seed data.

## Alternatives

- **Authorize endpoints by role name:** rejected because route policy would be
  coupled to job labels, duplicate policy decisions, and fail to express
  resource scopes.
- **Treat multiple roles as an override of workflow controls:** rejected
  because the permission union must not allow one actor to record and approve
  the same sensitive action.
- **Use the current role-based E2E example as the production pattern:** rejected
  because it contradicts the permission-key contract in the matrix.

## Consequences

- The seed and authorization tests must be reconciled with the 14 roles and 96
  permission keys in the matrix, including removal of `admin` grants that the
  matrix denies.
- Production endpoints need explicit `@Permissions` metadata, record-scope
  enforcement, and tests for deny-by-default behavior.
- Sensitive business workflows must persist actor identities, decision
  reasons, and audit/reversal history so separation-of-duties rules can be
  enforced and reviewed.
- The current `RolesGuard` and role-based E2E fixture remain implementation
  gaps; this proposed ADR does not change application code or make the policy
  effective by itself.
- `docs/ARCHITECTURE.md` and the implementation status of the matrix need
  follow-up updates as the code is aligned.
