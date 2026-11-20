// Purpose: Verify that the CI RBAC checker recognizes valid and invalid decorators.
import assert from "node:assert/strict";
import test from "node:test";
import { inspectPermissionDecorators, readMatrixPermissions } from "./check-permissions-matrix.mjs";

const matrixPermissions = readMatrixPermissions(
  "| Permission | Role |\n| --- | --- |\n| `auth:profile:read_own` | OWN |\n| `finance:receipt:issue` | Y |",
);

test("accepts documented literal permissions across multiline decorators", () => {
  const source = `class ExampleController {
    @Permissions(
      "auth:profile:read_own",
      \`finance:receipt:issue\`,
    )
    read() {}
  }`;

  const result = inspectPermissionDecorators(source, "example.controller.ts", matrixPermissions);

  assert.equal(result.decoratorCount, 1);
  assert.deepEqual(result.issues, []);
});

test("reports a permission missing from the RBAC matrix", () => {
  const source = `class ExampleController {
    @Permissions("finance:payment:void_bank_deposit")
    voidPayment() {}
  }`;

  const result = inspectPermissionDecorators(source, "example.controller.ts", matrixPermissions);

  assert.equal(result.decoratorCount, 1);
  assert.match(result.issues[0], /missing from docs\/RBAC_MATRIX\.md/);
});

test("fails closed when a decorator uses a non-literal permission", () => {
  const source = `const permission = "auth:profile:read_own";
class ExampleController {
  @Permissions(permission)
  read() {}
}`;

  const result = inspectPermissionDecorators(source, "example.controller.ts", matrixPermissions);

  assert.equal(result.decoratorCount, 1);
  assert.match(result.issues[0], /must be string literals/);
});

test("reports malformed permission keys", () => {
  const source = `class ExampleController {
    @Permissions("not-a-permission")
    read() {}
  }`;

  const result = inspectPermissionDecorators(source, "example.controller.ts", matrixPermissions);

  assert.equal(result.decoratorCount, 1);
  assert.match(result.issues[0], /invalid permission key/);
});
