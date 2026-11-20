// Purpose: Fail CI when a literal @Permissions key is absent from the RBAC matrix.
// Run from the repository root with: node .github/scripts/check-permissions-matrix.mjs
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const permissionKeyPattern = /^[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*$/;
const ignoredDirectories = new Set([
  ".git",
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);
const sourceExtensions = new Set([".cts", ".mts", ".ts", ".tsx"]);

/** Reads the permission keys defined in the matrix's first table column. */
export function readMatrixPermissions(matrix) {
  const permissions = new Set();
  for (const match of matrix.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)) {
    if (permissionKeyPattern.test(match[1])) {
      permissions.add(match[1]);
    }
  }
  return permissions;
}

/**
 * Finds missing or unverifiable permission arguments in TypeScript decorators.
 * @param {string} source TypeScript source to inspect.
 * @param {string} sourceName Source name used for line reporting.
 * @param {Set<string>} matrixPermissions Permission keys documented in the matrix.
 * @returns {{ decoratorCount: number, issues: string[] }} Decorator count and errors.
 */
export function inspectPermissionDecorators(source, sourceName, matrixPermissions) {
  const sourceFile = ts.createSourceFile(
    sourceName,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourceName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const issues = [];
  let decoratorCount = 0;

  function visit(node) {
    const decorators = ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
    for (const decorator of decorators) {
      const expression = decorator.expression;
      const isPermissionCall =
        ts.isCallExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        expression.expression.text === "Permissions";
      const isBarePermissionDecorator =
        ts.isIdentifier(expression) && expression.text === "Permissions";

      if (isBarePermissionDecorator) {
        const line =
          sourceFile.getLineAndCharacterOfPosition(decorator.getStart(sourceFile)).line + 1;
        issues.push(`${sourceName}:${line}: @Permissions must use literal permission arguments.`);
        continue;
      }
      if (!isPermissionCall) {
        continue;
      }

      decoratorCount += 1;
      if (expression.arguments.length === 0) {
        const line =
          sourceFile.getLineAndCharacterOfPosition(decorator.getStart(sourceFile)).line + 1;
        issues.push(`${sourceName}:${line}: @Permissions must include at least one permission.`);
        continue;
      }

      for (const argument of expression.arguments) {
        const line =
          sourceFile.getLineAndCharacterOfPosition(argument.getStart(sourceFile)).line + 1;
        if (!ts.isStringLiteral(argument) && !ts.isNoSubstitutionTemplateLiteral(argument)) {
          issues.push(
            `${sourceName}:${line}: @Permissions arguments must be string literals so CI can verify them.`,
          );
          continue;
        }

        const permission = argument.text;
        if (!permissionKeyPattern.test(permission)) {
          issues.push(`${sourceName}:${line}: invalid permission key "${permission}".`);
        } else if (!matrixPermissions.has(permission)) {
          issues.push(
            `${sourceName}:${line}: permission "${permission}" is missing from docs/RBAC_MATRIX.md.`,
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { decoratorCount, issues };
}

async function findTypeScriptFiles(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...(await findTypeScriptFiles(entryPath)));
      }
    } else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

async function main() {
  const matrixPath = path.join(repositoryRoot, "docs", "RBAC_MATRIX.md");
  const matrix = await readFile(matrixPath, "utf8");
  const matrixPermissions = readMatrixPermissions(matrix);
  if (matrixPermissions.size === 0) {
    throw new Error("No permission rows found in docs/RBAC_MATRIX.md.");
  }

  const sourceFiles = [];
  for (const sourceRoot of ["apps", "packages"]) {
    const sourcePath = path.join(repositoryRoot, sourceRoot);
    if (existsSync(sourcePath)) {
      sourceFiles.push(...(await findTypeScriptFiles(sourcePath)));
    }
  }

  const issues = [];
  let decoratorCount = 0;
  for (const sourceFile of sourceFiles) {
    const source = await readFile(sourceFile, "utf8");
    const relativePath = path.relative(repositoryRoot, sourceFile).split(path.sep).join("/");
    const result = inspectPermissionDecorators(source, relativePath, matrixPermissions);
    decoratorCount += result.decoratorCount;
    issues.push(...result.issues);
  }

  if (issues.length > 0) {
    process.stderr.write(`${issues.join("\n")}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `RBAC matrix check passed: ${decoratorCount} @Permissions decorators checked across ${sourceFiles.length} TypeScript files.\n`,
  );
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await main();
}
