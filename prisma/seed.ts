// Purpose: Seed RBAC, the initial administrator, and development-only academic sample data.
// Security: Credentials are Argon2-hashed; sample account secrets are random and never logged.

import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";

const prisma = new PrismaClient();

const roleNames = [
  "student",
  "lecturer",
  "bursar",
  "registrar",
  "admissions_officer",
  "admissions_head",
  "admin",
] as const;
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
  "sis:admission:review": ["registrar"],
  "sis:student:read_own": ["student"],
  "sis:student:read_assigned": ["lecturer", "registrar"],
  "sis:student:read_billing": ["bursar"],
  "sis:student:create": ["registrar"],
  "sis:student:update": ["registrar"],
  "sis:student:update_own_contact": ["student"],
  "sis:student:archive": ["registrar"],
  "academic:catalog:read": ["student", "lecturer", "registrar"],
  "academic:catalog:manage": ["registrar"],
  "academic:enrollment:create_own": ["student"],
  "academic:enrollment:read_own": ["student"],
  "academic:enrollment:manage": ["registrar"],
  "academic:class:read_assigned": ["lecturer", "registrar"],
  "academic:timetable:read_own": ["student", "lecturer"],
  "academic:timetable:manage": ["registrar"],
  "academic:attendance:record_assigned": ["lecturer"],
  "academic:attendance:read_own": ["student"],
  "academic:grades:submit_assigned": ["lecturer"],
  "academic:grades:read_own": ["student"],
  "academic:grades:publish": ["registrar"],
  "finance:invoice:read_own": ["student"],
  "finance:invoice:read_all": ["bursar"],
  "finance:invoice:manage": ["bursar"],
  "finance:payment:record_bank_deposit": ["bursar"],
  "finance:payment:read_own_statement": ["student"],
  "finance:payment:read_all": ["bursar"],
  "finance:payment:void_bank_deposit": [],
  "finance:receipt:read_own": ["student"],
  "finance:receipt:read_all": ["bursar"],
  "finance:report:read": ["bursar"],
  "finance:online_payment:use_own": ["student"],
  "lms:material:read_enrolled": ["student", "lecturer"],
  "lms:material:manage_assigned": ["lecturer"],
  "lms:assignment:manage_assigned": ["lecturer"],
  "lms:submission:create_own": ["student"],
  "lms:submission:read_own": ["student"],
  "lms:submission:read_assigned": ["lecturer"],
  "lms:submission:grade_assigned": ["lecturer"],
  "lms:grade:read_own": ["student"],
  "exams:exam:manage": ["registrar"],
  "exams:exam:read_assigned": ["lecturer"],
  "exams:schedule:read_own": ["student", "lecturer"],
  "exams:attempt:submit_own": ["student"],
  "exams:eligibility:read_own": ["student"],
  "exams:results:read_own": ["student"],
  "exams:results:grade_assigned": ["lecturer"],
  "exams:results:publish": ["registrar"],
  "reports:transcript:read_own": ["student"],
  "reports:academic:read": ["lecturer", "registrar"],
  "reports:finance:read": ["bursar"],
  "reports:institutional:read": ["registrar"],
  "reports:workload:read_own": ["lecturer"],
  "admissions:application:manage": ["admissions_officer", "admissions_head"],
  "admissions:document:review": ["admissions_officer", "admissions_head"],
  "admissions:admit": ["admissions_head"],
  "admissions:reject": ["admissions_head"],
  "admissions:study-mode:change": ["admissions_head"],
  "admissions:fee:confirm": ["bursar"],
  "academic:structure:manage": ["registrar"],
  "academic:curriculum:manage": ["registrar"],
  "academic:offering:manage": ["registrar"],
  "academic:offering:assign-lecturer": ["registrar"],
  "academic:session:manage": ["registrar", "lecturer"],
  "academic:unit:select": ["student"],
  "academic:session:attend": ["student"],
  "academic:classlist:read": ["lecturer"],
  "attendance:review": ["lecturer"],
  "attendance:override": ["lecturer"],
  "announcements:manage": ["registrar"],
  "calendar:event:manage": ["registrar"],
  "announcements:post-own": ["lecturer"],
} as const satisfies Record<string, readonly RoleName[]>;

const adminForbiddenPermissionPrefixes = [
  "academic:",
  "admissions:",
  "exams:",
  "finance:",
  "lms:",
  "reports:",
  "sis:admission:",
  "sis:application:",
  "sis:application_fee:",
  "sis:document:",
  "sis:student:",
] as const;

type SampleCourseUnitSpec = {
  code: string;
  name: string;
  level: "LEVEL_100" | "LEVEL_200" | "LEVEL_300" | "LEVEL_400";
  ownerDepartmentCode: string;
  intakeSlot: 1 | 2 | 3;
  isGeneral: boolean;
  eligibleFacultyCodes: readonly string[];
};

type SampleCurriculumPlacement = {
  programmeCode: string;
  courseUnitCode: string;
  studyYear: 1 | 2 | 3 | 4;
  intakeSlot: 1 | 2 | 3;
  type: "CORE" | "ELECTIVE";
};

type SampleStudentRecord = {
  id: string;
  email: string;
  name: string;
  phone: string;
  dateOfBirth: Date;
  programmeCode: string;
  schedule: "DAY" | "EVENING" | "WEEKEND" | "DISTANCE";
  studyMode: "ONLINE" | "PHYSICAL";
  studentNumber: string;
  admittedAt: Date;
};

const sampleUuidNamespace = Buffer.from("6ba7b8119dad11d180b400c04fd430c8", "hex");

/** Create stable UUID v5 identifiers for sample rows without natural unique keys. */
function sampleUuid(key: string): string {
  const digest = createHash("sha1")
    .update(Buffer.concat([sampleUuidNamespace, Buffer.from(key)]))
    .digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function utcDate(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

function requiredMapValue<Key, Value>(
  values: ReadonlyMap<Key, Value>,
  key: Key,
  description: string,
): Value {
  const value = values.get(key);
  if (value === undefined) {
    throw new Error(`Missing sample seed value for ${description}.`);
  }
  return value;
}

async function seedDevelopmentSampleData(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  // Sample accounts receive an undisclosed random secret instead of a repository default password.
  const samplePasswordHash = await hash(randomBytes(32).toString("base64url"));

  await prisma.$transaction(
    async (transaction) => {
      const roleEntries = await transaction.role.findMany({
        where: { name: { in: [...roleNames] } },
        select: { id: true, name: true },
      });
      const roleIds = new Map(roleEntries.map(({ name, id }) => [name, id]));

      const roleIdFor = (name: RoleName): string =>
        requiredMapValue(roleIds, name, `role "${name}"`);

      const seedUser = async (
        email: string,
        name: string,
        roleName: RoleName,
        createdAt?: Date,
      ): Promise<{ id: string }> => {
        const user = await transaction.user.upsert({
          where: { email },
          create: {
            email,
            name,
            passwordHash: samplePasswordHash,
            emailVerified: false,
            ...(createdAt === undefined ? {} : { createdAt, updatedAt: createdAt }),
          },
          update: {},
        });
        const roleId = roleIdFor(roleName);

        await transaction.userRole.upsert({
          where: {
            userId_roleId: {
              userId: user.id,
              roleId,
            },
          },
          create: {
            userId: user.id,
            roleId,
          },
          update: {},
        });

        return user;
      };

      const facultySpecs = [
        { code: "SCI", name: "Science & Technology" },
        { code: "HLT", name: "Health Sciences" },
        { code: "LAW", name: "Law" },
        { code: "BUS", name: "Business" },
      ] as const;
      const facultyIds = new Map<string, string>();

      for (const facultySpec of facultySpecs) {
        const faculty = await transaction.faculty.upsert({
          where: { code: facultySpec.code },
          create: facultySpec,
          update: {},
        });
        facultyIds.set(facultySpec.code, faculty.id);
      }

      const departmentSpecs = [
        {
          code: "SCI-CS",
          name: "Department of Computer Science",
          facultyCode: "SCI",
        },
        {
          code: "HLT-NUR",
          name: "Department of Nursing",
          facultyCode: "HLT",
        },
        { code: "LAW-LAW", name: "Department of Law", facultyCode: "LAW" },
        {
          code: "BUS-BUS",
          name: "Department of Business Administration",
          facultyCode: "BUS",
        },
      ] as const;
      const departmentIds = new Map<string, string>();

      for (const departmentSpec of departmentSpecs) {
        const department = await transaction.department.upsert({
          where: { code: departmentSpec.code },
          create: {
            code: departmentSpec.code,
            name: departmentSpec.name,
            facultyId: requiredMapValue(
              facultyIds,
              departmentSpec.facultyCode,
              `faculty "${departmentSpec.facultyCode}"`,
            ),
          },
          update: {},
        });
        departmentIds.set(departmentSpec.code, department.id);
      }

      const programmeSpecs = [
        {
          code: "BSC-CS",
          name: "BSc Computer Science",
          departmentCode: "SCI-CS",
          unitPrefix: "CSC",
        },
        {
          code: "BSC-NUR",
          name: "BSc Nursing",
          departmentCode: "HLT-NUR",
          unitPrefix: "NUR",
        },
        {
          code: "LLB",
          name: "LLB Law",
          departmentCode: "LAW-LAW",
          unitPrefix: "LAW",
        },
        {
          code: "BBA",
          name: "BBA Business",
          departmentCode: "BUS-BUS",
          unitPrefix: "BUS",
        },
      ] as const;
      const programmeIds = new Map<string, string>();

      for (const programmeSpec of programmeSpecs) {
        const programme = await transaction.programme.upsert({
          where: { code: programmeSpec.code },
          create: {
            code: programmeSpec.code,
            name: programmeSpec.name,
            departmentId: requiredMapValue(
              departmentIds,
              programmeSpec.departmentCode,
              `department "${programmeSpec.departmentCode}"`,
            ),
            awardLevel: "BACHELOR",
            durationYears: 4,
          },
          update: {},
        });
        programmeIds.set(programmeSpec.code, programme.id);
      }

      const academicYear = await transaction.academicYear.upsert({
        where: { label: "2026" },
        create: {
          label: "2026",
          startDate: utcDate(2026, 1, 1),
          endDate: utcDate(2026, 12, 31),
        },
        update: {},
      });
      const intakeSpecs = [
        {
          sequence: 1,
          name: "January",
          startDate: utcDate(2026, 1, 1),
          endDate: utcDate(2026, 4, 30),
          selectionOpensAt: utcDate(2025, 12, 1),
          selectionClosesAt: utcDate(2025, 12, 20),
          status: "CLOSED" as const,
        },
        {
          sequence: 2,
          name: "May",
          startDate: utcDate(2026, 5, 1),
          endDate: utcDate(2026, 8, 31),
          selectionOpensAt: utcDate(2026, 3, 1),
          selectionClosesAt: utcDate(2026, 4, 20),
          status: "CLOSED" as const,
        },
        {
          sequence: 3,
          name: "September",
          startDate: utcDate(2026, 9, 1),
          endDate: utcDate(2026, 12, 31),
          selectionOpensAt: utcDate(2026, 7, 1),
          selectionClosesAt: utcDate(2026, 8, 20),
          status: "ACTIVE" as const,
        },
      ] as const;
      const intakeIds = new Map<number, string>();

      for (const intakeSpec of intakeSpecs) {
        const intake = await transaction.intake.upsert({
          where: {
            academicYearId_sequence: {
              academicYearId: academicYear.id,
              sequence: intakeSpec.sequence,
            },
          },
          create: {
            ...intakeSpec,
            academicYearId: academicYear.id,
          },
          update: {},
        });
        intakeIds.set(intakeSpec.sequence, intake.id);
      }

      const registrar = await seedUser(
        "sample.registrar@university.local",
        "Sample Registrar",
        "registrar",
        utcDate(2025, 12, 1),
      );
      const admissionsOfficer = await seedUser(
        "sample.admissions.officer@university.local",
        "Sample Admissions Officer",
        "admissions_officer",
        utcDate(2026, 9, 1),
      );
      const admissionsHead = await seedUser(
        "sample.admissions.head@university.local",
        "Sample Admissions Head",
        "admissions_head",
        utcDate(2025, 12, 1),
      );

      const lecturerSpecs = [
        {
          email: "sample.lecturer.01@university.local",
          name: "Sample Lecturer 01",
          staffNumber: "DEV-STAFF-001",
          departmentCode: "SCI-CS",
        },
        {
          email: "sample.lecturer.02@university.local",
          name: "Sample Lecturer 02",
          staffNumber: "DEV-STAFF-002",
          departmentCode: "SCI-CS",
        },
        {
          email: "sample.lecturer.03@university.local",
          name: "Sample Lecturer 03",
          staffNumber: "DEV-STAFF-003",
          departmentCode: "HLT-NUR",
        },
        {
          email: "sample.lecturer.04@university.local",
          name: "Sample Lecturer 04",
          staffNumber: "DEV-STAFF-004",
          departmentCode: "LAW-LAW",
        },
        {
          email: "sample.lecturer.05@university.local",
          name: "Sample Lecturer 05",
          staffNumber: "DEV-STAFF-005",
          departmentCode: "BUS-BUS",
        },
      ] as const;
      const lecturerIdsByDepartment = new Map<string, string[]>();

      for (const lecturerSpec of lecturerSpecs) {
        const user = await seedUser(
          lecturerSpec.email,
          lecturerSpec.name,
          "lecturer",
          utcDate(2025, 12, 1),
        );
        const lecturer = await transaction.lecturer.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            staffNumber: lecturerSpec.staffNumber,
            departmentId: requiredMapValue(
              departmentIds,
              lecturerSpec.departmentCode,
              `department "${lecturerSpec.departmentCode}"`,
            ),
          },
          update: {},
        });
        const departmentLecturers = lecturerIdsByDepartment.get(lecturerSpec.departmentCode) ?? [];
        departmentLecturers.push(lecturer.id);
        lecturerIdsByDepartment.set(lecturerSpec.departmentCode, departmentLecturers);
      }

      const scheduleOptions = ["DAY", "EVENING", "WEEKEND", "DISTANCE"] as const;
      const studentSpecs = Array.from({ length: 20 }, (_, index) => {
        const programmeSpec = programmeSpecs[Math.floor(index / 5)];
        const schedule = scheduleOptions[index % scheduleOptions.length];
        if (programmeSpec === undefined || schedule === undefined) {
          throw new Error(`Could not build sample student ${index + 1}.`);
        }

        const ordinal = String(index + 1).padStart(2, "0");
        return {
          email: `sample.student.${ordinal}@university.local`,
          name: `Sample Student ${ordinal}`,
          phone: `+1000000${String(index + 1).padStart(4, "0")}`,
          dateOfBirth: utcDate(2000 + (index % 6), (index % 12) + 1, (index % 27) + 1),
          programmeCode: programmeSpec.code,
          schedule,
          studyMode: index % 2 === 0 ? ("ONLINE" as const) : ("PHYSICAL" as const),
          studentNumber: `DEV-STU-2026-${ordinal}`,
          admittedAt: utcDate(2026, 1, index + 2),
        };
      });
      const students: SampleStudentRecord[] = [];

      for (const studentSpec of studentSpecs) {
        const user = await seedUser(
          studentSpec.email,
          studentSpec.name,
          "student",
          studentSpec.admittedAt,
        );
        const student = await transaction.student.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            studentNumber: studentSpec.studentNumber,
            phone: studentSpec.phone,
            dateOfBirth: studentSpec.dateOfBirth,
            gender: "Sample",
            nationality: "Sample",
            schedule: studentSpec.schedule,
            createdAt: studentSpec.admittedAt,
            updatedAt: studentSpec.admittedAt,
          },
          update: {},
        });
        students.push({
          id: student.id,
          email: studentSpec.email,
          name: studentSpec.name,
          phone: studentSpec.phone,
          dateOfBirth: studentSpec.dateOfBirth,
          programmeCode: studentSpec.programmeCode,
          schedule: studentSpec.schedule,
          studyMode: studentSpec.studyMode,
          studentNumber: studentSpec.studentNumber,
          admittedAt: studentSpec.admittedAt,
        });
      }

      const generalCourseUnitSpecs: SampleCourseUnitSpec[] = [
        {
          code: "GEN-101",
          name: "Academic Writing",
          level: "LEVEL_100",
          ownerDepartmentCode: "SCI-CS",
          intakeSlot: 1,
          isGeneral: true,
          eligibleFacultyCodes: facultySpecs.map(({ code }) => code),
        },
        {
          code: "GEN-102",
          name: "Quantitative Reasoning",
          level: "LEVEL_100",
          ownerDepartmentCode: "SCI-CS",
          intakeSlot: 2,
          isGeneral: true,
          eligibleFacultyCodes: facultySpecs.map(({ code }) => code),
        },
        {
          code: "GEN-103",
          name: "Digital Literacy",
          level: "LEVEL_100",
          ownerDepartmentCode: "SCI-CS",
          intakeSlot: 3,
          isGeneral: true,
          eligibleFacultyCodes: facultySpecs.map(({ code }) => code),
        },
      ];
      const courseUnitLevels = {
        1: "LEVEL_100",
        2: "LEVEL_200",
        3: "LEVEL_300",
        4: "LEVEL_400",
      } as const;
      const studyYears = [1, 2, 3, 4] as const;
      const intakeSlots = [1, 2, 3] as const;
      const courseUnitSpecs = [...generalCourseUnitSpecs];
      const curriculumPlacements: SampleCurriculumPlacement[] = [];

      for (const programmeSpec of programmeSpecs) {
        for (const intakeSlot of intakeSlots) {
          const generalUnit = requiredMapValue(
            new Map(generalCourseUnitSpecs.map((unit) => [unit.intakeSlot, unit])),
            intakeSlot,
            `general course unit for intake slot ${intakeSlot}`,
          );
          curriculumPlacements.push({
            programmeCode: programmeSpec.code,
            courseUnitCode: generalUnit.code,
            studyYear: 1,
            intakeSlot,
            type: "CORE",
          });
        }

        for (const studyYear of studyYears) {
          for (const intakeSlot of intakeSlots) {
            const types =
              studyYear === 1 ? (["ELECTIVE"] as const) : (["CORE", "ELECTIVE"] as const);

            for (const type of types) {
              const suffix = type === "CORE" ? "C" : "E";
              const code = `${programmeSpec.unitPrefix}-Y${studyYear}I${intakeSlot}-${suffix}`;
              courseUnitSpecs.push({
                code,
                name: `${programmeSpec.name} Year ${studyYear} Intake ${intakeSlot} ${type === "CORE" ? "Core" : "Elective"}`,
                level: courseUnitLevels[studyYear],
                ownerDepartmentCode: programmeSpec.departmentCode,
                intakeSlot,
                isGeneral: false,
                eligibleFacultyCodes: [],
              });
              curriculumPlacements.push({
                programmeCode: programmeSpec.code,
                courseUnitCode: code,
                studyYear,
                intakeSlot,
                type,
              });
            }
          }
        }
      }

      const courseUnitIds = new Map<string, string>();

      for (const courseUnitSpec of courseUnitSpecs) {
        const courseUnit = await transaction.courseUnit.upsert({
          where: { code: courseUnitSpec.code },
          create: {
            code: courseUnitSpec.code,
            name: courseUnitSpec.name,
            creditUnits: 3,
            level: courseUnitSpec.level,
            ownerDepartmentId: requiredMapValue(
              departmentIds,
              courseUnitSpec.ownerDepartmentCode,
              `department "${courseUnitSpec.ownerDepartmentCode}"`,
            ),
            isGeneral: courseUnitSpec.isGeneral,
            openToAllFaculties: false,
            status: "ACTIVE",
          },
          update: {},
        });
        courseUnitIds.set(courseUnitSpec.code, courseUnit.id);

        for (const facultyCode of courseUnitSpec.eligibleFacultyCodes) {
          const facultyId = requiredMapValue(facultyIds, facultyCode, `faculty "${facultyCode}"`);
          await transaction.courseUnitFacultyEligibility.upsert({
            where: {
              courseUnitId_facultyId: {
                courseUnitId: courseUnit.id,
                facultyId,
              },
            },
            create: {
              courseUnitId: courseUnit.id,
              facultyId,
            },
            update: {},
          });
        }
      }

      for (const placement of curriculumPlacements) {
        const programmeId = requiredMapValue(
          programmeIds,
          placement.programmeCode,
          `programme "${placement.programmeCode}"`,
        );
        const courseUnitId = requiredMapValue(
          courseUnitIds,
          placement.courseUnitCode,
          `course unit "${placement.courseUnitCode}"`,
        );

        await transaction.programmeCourseUnit.upsert({
          where: {
            programmeId_courseUnitId: {
              programmeId,
              courseUnitId,
            },
          },
          create: {
            programmeId,
            courseUnitId,
            studyYear: placement.studyYear,
            intakeSlot: placement.intakeSlot,
            type: placement.type,
          },
          update: {},
        });
      }

      for (const programmeSpec of programmeSpecs) {
        const programmeId = requiredMapValue(
          programmeIds,
          programmeSpec.code,
          `programme "${programmeSpec.code}"`,
        );
        for (const studyYear of studyYears) {
          for (const intakeSlot of intakeSlots) {
            const id = sampleUuid(`elective-rule:${programmeSpec.code}:${studyYear}:${intakeSlot}`);
            await transaction.programmeElectiveRule.upsert({
              where: { id },
              create: {
                id,
                programmeId,
                studyYear,
                intakeSlot,
                minCredits: 3,
                maxCredits: 3,
              },
              update: {},
            });
          }
        }
      }

      const deliveryModes = ["PHYSICAL", "ONLINE", "HYBRID"] as const;
      const daysOfWeek = [
        "SUNDAY",
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
      ] as const;
      const sessionDates = {
        1: { month: 4, day: 15 },
        2: { month: 8, day: 15 },
        3: { month: 12, day: 10 },
      } as const;
      const offeringIds = new Map<string, string>();
      let lecturerIndex = 0;

      for (const courseUnitSpec of courseUnitSpecs) {
        const courseUnitId = requiredMapValue(
          courseUnitIds,
          courseUnitSpec.code,
          `course unit "${courseUnitSpec.code}"`,
        );
        const intakeId = requiredMapValue(
          intakeIds,
          courseUnitSpec.intakeSlot,
          `intake ${courseUnitSpec.intakeSlot}`,
        );
        const deliveryMode = deliveryModes[lecturerIndex % deliveryModes.length];
        if (deliveryMode === undefined) {
          throw new Error("Missing sample offering delivery mode.");
        }
        const offering = await transaction.courseUnitOffering.upsert({
          where: {
            courseUnitId_intakeId: {
              courseUnitId,
              intakeId,
            },
          },
          create: {
            courseUnitId,
            intakeId,
            capacity: 60,
            deliveryMode,
            status: courseUnitSpec.intakeSlot === 3 ? "OPEN" : "CLOSED",
          },
          update: {},
        });
        offeringIds.set(courseUnitSpec.code, offering.id);

        const assignedLecturers = requiredMapValue(
          lecturerIdsByDepartment,
          courseUnitSpec.ownerDepartmentCode,
          `lecturers for "${courseUnitSpec.ownerDepartmentCode}"`,
        );
        const lecturerId = assignedLecturers[lecturerIndex % assignedLecturers.length];
        if (lecturerId === undefined) {
          throw new Error(`No sample lecturer for "${courseUnitSpec.ownerDepartmentCode}".`);
        }
        await transaction.offeringLecturer.upsert({
          where: {
            offeringId_lecturerId: {
              offeringId: offering.id,
              lecturerId,
            },
          },
          create: {
            offeringId: offering.id,
            lecturerId,
            role: "PRIMARY",
          },
          update: {},
        });

        const sessionBase = sessionDates[courseUnitSpec.intakeSlot];
        const sessionDate = utcDate(2026, sessionBase.month, sessionBase.day + (lecturerIndex % 5));
        const dayOfWeek = daysOfWeek[sessionDate.getUTCDay()];
        const startHour = 9 + (lecturerIndex % 5);
        if (dayOfWeek === undefined) {
          throw new Error("Could not determine a sample timetable weekday.");
        }

        const room =
          deliveryMode === "ONLINE" ? null : `Development Room ${101 + (lecturerIndex % 20)}`;
        const meetingUrl =
          deliveryMode === "PHYSICAL"
            ? null
            : `https://meet.example.invalid/${courseUnitSpec.code.toLowerCase()}`;
        const timetableSlotId = sampleUuid(`timetable:${offering.id}`);
        const timetableSlot = await transaction.timetableSlot.upsert({
          where: { id: timetableSlotId },
          create: {
            id: timetableSlotId,
            offeringId: offering.id,
            dayOfWeek,
            startTime: utcDate(1970, 1, 1, startHour),
            endTime: utcDate(1970, 1, 1, startHour + 1),
            room,
            deliveryMode,
            defaultMeetingUrl: meetingUrl,
          },
          update: {},
        });
        const sessionId = sampleUuid(`class-session:${offering.id}`);
        const sessionStart = utcDate(
          2026,
          sessionBase.month,
          sessionBase.day + (lecturerIndex % 5),
          startHour,
        );
        const sessionEnd = utcDate(
          2026,
          sessionBase.month,
          sessionBase.day + (lecturerIndex % 5),
          startHour + 1,
        );

        await transaction.classSession.upsert({
          where: { id: sessionId },
          create: {
            id: sessionId,
            offeringId: offering.id,
            slotId: timetableSlot.id,
            startsAt: sessionStart,
            endsAt: sessionEnd,
            deliveryMode,
            room,
            meetingUrl,
            status: courseUnitSpec.intakeSlot === 3 ? "SCHEDULED" : "HELD",
          },
          update: {},
        });
        lecturerIndex += 1;
      }

      const januaryIntakeId = requiredMapValue(intakeIds, 1, "January intake");
      const septemberIntakeId = requiredMapValue(intakeIds, 3, "September intake");
      const selectedAt = utcDate(2026, 8, 18);

      for (const student of students) {
        const programmeSpec = requiredMapValue(
          new Map(programmeSpecs.map((spec) => [spec.code, spec])),
          student.programmeCode,
          `programme "${student.programmeCode}"`,
        );
        const programmeId = requiredMapValue(
          programmeIds,
          student.programmeCode,
          `programme "${student.programmeCode}"`,
        );
        const enrollmentId = sampleUuid(`programme-enrollment:${student.studentNumber}`);

        await transaction.programmeEnrollment.upsert({
          where: { id: enrollmentId },
          create: {
            id: enrollmentId,
            studentId: student.id,
            programmeId,
            admissionIntakeId: januaryIntakeId,
            currentStudyYear: 1,
            currentIntakeSlot: 3,
            status: "ACTIVE",
            createdAt: student.admittedAt,
            updatedAt: student.admittedAt,
          },
          update: {},
        });
        await transaction.intakeRegistration.upsert({
          where: {
            studentId_intakeId: {
              studentId: student.id,
              intakeId: septemberIntakeId,
            },
          },
          create: {
            studentId: student.id,
            intakeId: septemberIntakeId,
            status: "REGISTERED",
            createdAt: selectedAt,
            updatedAt: selectedAt,
          },
          update: {},
        });

        for (const courseUnitCode of ["GEN-103", `${programmeSpec.unitPrefix}-Y1I3-E`]) {
          const offeringId = requiredMapValue(
            offeringIds,
            courseUnitCode,
            `offering for "${courseUnitCode}"`,
          );
          await transaction.unitRegistration.upsert({
            where: {
              studentId_offeringId: {
                studentId: student.id,
                offeringId,
              },
            },
            create: {
              studentId: student.id,
              offeringId,
              intakeId: septemberIntakeId,
              status: "SELECTED",
              isRetake: false,
              selectedAt,
              createdAt: selectedAt,
              updatedAt: selectedAt,
            },
            update: {},
          });
        }

        const admittedAt = student.admittedAt;
        const applicationRef = `DEV-ADMISSION-${student.studentNumber}`;
        const application = await transaction.application.upsert({
          where: { externalRef: applicationRef },
          create: {
            applicantName: student.name,
            email: student.email,
            phone: student.phone,
            dateOfBirth: student.dateOfBirth,
            nationality: "Sample",
            studyMode: student.studyMode,
            schedule: student.schedule,
            desiredProgrammeId: programmeId,
            desiredIntakeId: januaryIntakeId,
            source: "WEBSITE",
            externalRef: applicationRef,
            status: "ADMITTED",
            admittedById: admissionsHead.id,
            admittedAt,
            studentId: student.id,
            createdAt: admittedAt,
            updatedAt: admittedAt,
          },
          update: {},
        });

        await transaction.admissionRecord.upsert({
          where: { applicationId: application.id },
          create: {
            applicationId: application.id,
            studentId: student.id,
            programmeId,
            admissionIntakeId: januaryIntakeId,
            studyMode: student.studyMode,
            schedule: student.schedule,
            admittedById: admissionsHead.id,
            admittedAt,
            createdAt: admittedAt,
            updatedAt: admittedAt,
          },
          update: {},
        });
      }

      const additionalApplications: {
        status:
          | "SUBMITTED"
          | "UNDER_REVIEW"
          | "DOCS_APPROVED"
          | "DOCS_REJECTED"
          | "REJECTED"
          | "WITHDRAWN";
        documentStatus?: "PENDING" | "APPROVED" | "REJECTED";
      }[] = [
        { status: "SUBMITTED" },
        { status: "UNDER_REVIEW", documentStatus: "PENDING" },
        { status: "DOCS_APPROVED", documentStatus: "APPROVED" },
        { status: "DOCS_REJECTED", documentStatus: "REJECTED" },
        { status: "REJECTED" },
        { status: "WITHDRAWN" },
      ];

      for (const [index, applicationSpec] of additionalApplications.entries()) {
        const programmeSpec = programmeSpecs[index % programmeSpecs.length];
        if (programmeSpec === undefined) {
          throw new Error("Missing sample programme for an application.");
        }

        const applicationRef = `DEV-APPLICATION-${applicationSpec.status}`;
        const applicationCreatedAt = utcDate(2026, 10, 20 + index);
        const applicationUpdatedAt =
          applicationSpec.documentStatus === undefined
            ? applicationCreatedAt
            : utcDate(2026, 11, 1, 10);
        const application = await transaction.application.upsert({
          where: { externalRef: applicationRef },
          create: {
            applicantName: `Sample Applicant ${applicationSpec.status}`,
            email: `sample.applicant.${applicationSpec.status.toLowerCase()}@university.local`,
            phone: `+100000099${String(index + 1).padStart(2, "0")}`,
            dateOfBirth: utcDate(2002, index + 1, 10),
            nationality: "Sample",
            studyMode: index % 2 === 0 ? "ONLINE" : "PHYSICAL",
            schedule: "DAY",
            desiredProgrammeId: requiredMapValue(
              programmeIds,
              programmeSpec.code,
              `programme "${programmeSpec.code}"`,
            ),
            desiredIntakeId: septemberIntakeId,
            source: "ADMISSION_OFFICE",
            externalRef: applicationRef,
            status: applicationSpec.status,
            enteredById: admissionsOfficer.id,
            createdAt: applicationCreatedAt,
            updatedAt: applicationUpdatedAt,
          },
          update: {},
        });

        if (applicationSpec.documentStatus !== undefined) {
          const reviewed =
            applicationSpec.documentStatus === "PENDING" ? null : admissionsOfficer.id;
          const reviewedAt = reviewed === null ? null : utcDate(2026, 11, 1, 10);
          const documentId = sampleUuid(`application-document:${applicationRef}`);
          await transaction.applicationDocument.upsert({
            where: { id: documentId },
            create: {
              id: documentId,
              applicationId: application.id,
              type: "TRANSCRIPT",
              storageKey: `development-samples/${applicationRef.toLowerCase()}/transcript.pdf`,
              status: applicationSpec.documentStatus,
              reviewerNote:
                applicationSpec.documentStatus === "REJECTED"
                  ? "Development sample: please provide a clearer document."
                  : null,
              reviewedById: reviewed,
              reviewedAt,
              createdAt: utcDate(2026, 10, 15),
              updatedAt: reviewedAt ?? utcDate(2026, 10, 15),
            },
            update: {},
          });
        }
      }

      await transaction.attendanceRule.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {},
      });

      const allStudentsAnnouncementId = sampleUuid("announcement:student-welcome");
      const targetedAnnouncementId = sampleUuid("announcement:unit-update");
      const announcements = [
        {
          id: allStudentsAnnouncementId,
          title: "Development Sample: Welcome to the Academic Year",
          body: "This announcement is development-only sample content.",
          category: "GENERAL" as const,
          status: "PUBLISHED" as const,
          isPinned: true,
          sortOrder: 1,
          publishAt: utcDate(2026, 1, 1),
          expiresAt: utcDate(2026, 12, 31, 23, 59),
        },
        {
          id: targetedAnnouncementId,
          title: "Development Sample: Course Unit Update",
          body: "This targeted announcement is development-only sample content.",
          category: "ACADEMIC" as const,
          status: "DRAFT" as const,
          isPinned: false,
          sortOrder: 2,
          publishAt: utcDate(2026, 12, 1),
          expiresAt: null,
        },
      ] as const;

      for (const announcement of announcements) {
        await transaction.announcement.upsert({
          where: { id: announcement.id },
          create: {
            ...announcement,
            createdById: registrar.id,
          },
          update: {},
        });
      }

      const allStudentsAudienceId = sampleUuid(
        `announcement-audience:${allStudentsAnnouncementId}:all-students`,
      );
      await transaction.announcementAudience.upsert({
        where: { id: allStudentsAudienceId },
        create: {
          id: allStudentsAudienceId,
          announcementId: allStudentsAnnouncementId,
          audienceType: "ALL_STUDENTS",
          targetId: null,
        },
        update: {},
      });
      const targetedOfferingId = requiredMapValue(offeringIds, "GEN-103", "offering for GEN-103");
      const targetedAudienceId = sampleUuid(
        `announcement-audience:${targetedAnnouncementId}:${targetedOfferingId}`,
      );
      await transaction.announcementAudience.upsert({
        where: { id: targetedAudienceId },
        create: {
          id: targetedAudienceId,
          announcementId: targetedAnnouncementId,
          audienceType: "COURSE_UNIT_OFFERING",
          targetId: targetedOfferingId,
        },
        update: {},
      });

      const calendarEventSpecs = [
        {
          id: sampleUuid("calendar-event:founders-day"),
          title: "Development Sample: Founders Day",
          description: "Sample holiday entry; not an intake or class session.",
          type: "HOLIDAY" as const,
          startsAt: utcDate(2026, 12, 25),
          endsAt: utcDate(2026, 12, 26),
          allDay: true,
        },
        {
          id: sampleUuid("calendar-event:academic-review"),
          title: "Development Sample: Academic Review",
          description: "Sample academic event for calendar testing.",
          type: "ACADEMIC" as const,
          startsAt: utcDate(2026, 12, 15, 9),
          endsAt: utcDate(2026, 12, 15, 11),
          allDay: false,
        },
      ] as const;

      for (const event of calendarEventSpecs) {
        await transaction.calendarEvent.upsert({
          where: { id: event.id },
          create: {
            ...event,
            createdById: registrar.id,
          },
          update: {},
        });
      }

      const studentCalendarAudienceId = sampleUuid(
        `calendar-audience:${calendarEventSpecs[0].id}:students`,
      );
      await transaction.calendarEventAudience.upsert({
        where: { id: studentCalendarAudienceId },
        create: {
          id: studentCalendarAudienceId,
          calendarEventId: calendarEventSpecs[0].id,
          audienceType: "ALL_STUDENTS",
          targetId: null,
        },
        update: {},
      });
      const lecturerCalendarAudienceId = sampleUuid(
        `calendar-audience:${calendarEventSpecs[1].id}:lecturers`,
      );
      await transaction.calendarEventAudience.upsert({
        where: { id: lecturerCalendarAudienceId },
        create: {
          id: lecturerCalendarAudienceId,
          calendarEventId: calendarEventSpecs[1].id,
          audienceType: "ALL_LECTURERS",
          targetId: null,
        },
        update: {},
      });
    },
    { maxWait: 10_000, timeout: 120_000 },
  );
}

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

        const forbiddenAdminPermissions = await transaction.permission.findMany({
          where: {
            OR: adminForbiddenPermissionPrefixes.map((prefix) => ({
              key: { startsWith: prefix },
            })),
          },
          select: { id: true },
        });

        // Remove legacy grants as well as preventing new prohibited grants.
        await transaction.rolePermission.deleteMany({
          where: {
            roleId: adminRoleId,
            permissionId: { in: forbiddenAdminPermissions.map(({ id }) => id) },
          },
        });

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
    await seedDevelopmentSampleData();
  } finally {
    await prisma.$disconnect();
  }
}

void seed().catch((error: unknown) => {
  console.error("Prisma seed failed.", error);
  process.exitCode = 1;
});
