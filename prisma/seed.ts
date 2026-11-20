// Purpose: Seed the RBAC matrix and the initial administrator account.
// Security: Passwords are accepted only from the environment and stored as Argon2 hashes.

import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";

const prisma = new PrismaClient();

const roleNames = ["student", "lecturer", "bursar", "registrar", "admin"] as const;
type RoleName = (typeof roleNames)[number];

const permissionGrants = {
  "auth:profile:read_own": ["student", "lecturer", "bursar", "registrar", "admin"],
  "auth:credentials:update_own": ["student", "lecturer", "bursar", "registrar", "admin"],
  "auth:session:manage_own": ["student", "lecturer", "bursar", "registrar", "admin"],
  "auth:user:manage": ["admin"],
  "admin:user:manage": ["admin"],
  "auth:role_permission:manage": ["admin"],
  "sis:admission:submit_own": ["student"],
  "sis:admission:read_own": ["student"],
  "sis:admission:review": ["registrar", "admin"],
  "sis:student:read_own": ["student"],
  "sis:student:read_assigned": ["lecturer", "registrar", "admin"],
  "sis:student:read_billing": ["bursar", "admin"],
  "sis:student:create": ["registrar", "admin"],
  "sis:student:update": ["registrar", "admin"],
  "sis:student:update_own_contact": ["student"],
  "sis:student:archive": ["registrar", "admin"],
  "academic:catalog:read": ["student", "lecturer", "registrar", "admin"],
  "academic:catalog:manage": ["registrar", "admin"],
  "academic:enrollment:create_own": ["student"],
  "academic:enrollment:read_own": ["student"],
  "academic:enrollment:manage": ["registrar", "admin"],
  "academic:class:read_assigned": ["lecturer", "registrar", "admin"],
  "academic:timetable:read_own": ["student", "lecturer", "admin"],
  "academic:timetable:manage": ["registrar", "admin"],
  "academic:attendance:record_assigned": ["lecturer", "admin"],
  "academic:attendance:read_own": ["student"],
  "academic:grades:submit_assigned": ["lecturer", "admin"],
  "academic:grades:read_own": ["student"],
  "academic:grades:publish": ["registrar", "admin"],
  "finance:invoice:read_own": ["student"],
  "finance:invoice:read_all": ["bursar", "admin"],
  "finance:invoice:manage": ["bursar", "admin"],
  "finance:payment:record_bank_deposit": ["bursar", "admin"],
  "finance:payment:read_own_statement": ["student"],
  "finance:payment:read_all": ["bursar", "admin"],
  "finance:payment:void_bank_deposit": ["bursar", "admin"],
  "finance:receipt:read_own": ["student"],
  "finance:receipt:read_all": ["bursar", "admin"],
  "finance:report:read": ["bursar", "admin"],
  "finance:online_payment:use_own": ["student"],
  "finance:online_payment:manage_flags": ["admin"],
  "lms:material:read_enrolled": ["student", "lecturer", "admin"],
  "lms:material:manage_assigned": ["lecturer", "admin"],
  "lms:assignment:manage_assigned": ["lecturer", "admin"],
  "lms:submission:create_own": ["student"],
  "lms:submission:read_own": ["student"],
  "lms:submission:read_assigned": ["lecturer", "admin"],
  "lms:submission:grade_assigned": ["lecturer", "admin"],
  "lms:grade:read_own": ["student"],
  "exams:exam:manage": ["registrar", "admin"],
  "exams:exam:read_assigned": ["lecturer", "admin"],
  "exams:schedule:read_own": ["student", "lecturer", "admin"],
  "exams:attempt:submit_own": ["student"],
  "exams:eligibility:read_own": ["student"],
  "exams:results:read_own": ["student"],
  "exams:results:grade_assigned": ["lecturer", "admin"],
  "exams:results:publish": ["registrar", "admin"],
  "reports:transcript:read_own": ["student"],
  "reports:academic:read": ["lecturer", "registrar", "admin"],
  "reports:finance:read": ["bursar", "admin"],
  "reports:institutional:read": ["registrar", "admin"],
  "reports:workload:read_own": ["lecturer"],
} as const satisfies Record<string, readonly RoleName[]>;

async function seed(): Promise<void> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminPassword === undefined || adminPassword.trim().length === 0) {
    throw new Error("Set a non-empty ADMIN_PASSWORD environment variable before seeding.");
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@university.local").trim().toLowerCase();
  if (adminEmail.length === 0) {
    throw new Error("ADMIN_EMAIL must not be empty.");
  }

  const passwordHash = await hash(adminPassword);

  try {
    await prisma.$transaction(
      async (transaction) => {
        const roleEntries = await Promise.all(
          roleNames.map(async (name) => {
            const role = await transaction.role.upsert({
              where: { name },
              create: { name },
              update: {},
            });
            return [name, role.id] as const;
          }),
        );
        const roleIds = new Map(roleEntries);

        const permissionEntries = Object.entries(permissionGrants);
        await Promise.all(
          permissionEntries.map(async ([key, roles]) => {
            const permission = await transaction.permission.upsert({
              where: { key },
              create: { key },
              update: {},
            });

            await Promise.all(
              roles.map(async (roleName) => {
                const roleId = roleIds.get(roleName);
                if (roleId === undefined) {
                  throw new Error(`Unknown role "${roleName}" in permission "${key}".`);
                }

                await transaction.rolePermission.upsert({
                  where: {
                    roleId_permissionId: {
                      roleId,
                      permissionId: permission.id,
                    },
                  },
                  create: {
                    roleId,
                    permissionId: permission.id,
                  },
                  update: {},
                });
              }),
            );
          }),
        );

        const admin = await transaction.user.upsert({
          where: { email: adminEmail },
          create: {
            email: adminEmail,
            passwordHash,
          },
          // Keep an existing administrator's password and status unchanged on reruns.
          update: {},
        });

        const adminRoleId = roleIds.get("admin");
        if (adminRoleId === undefined) {
          throw new Error("The admin role was not created.");
        }

        await transaction.userRole.upsert({
          where: {
            userId_roleId: {
              userId: admin.id,
              roleId: adminRoleId,
            },
          },
          create: {
            userId: admin.id,
            roleId: adminRoleId,
          },
          update: {},
        });
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

void seed().catch((error: unknown) => {
  console.error("Prisma seed failed.", error);
  process.exitCode = 1;
});
