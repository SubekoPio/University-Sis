// Purpose: Define shared audience selectors and matching context for communications.
import type { CommunicationAudienceType, Prisma } from "@prisma/client";

/** One audience selector persisted for an announcement or calendar event. */
export interface CommunicationAudienceInput {
  audienceType: CommunicationAudienceType;
  targetId: string | null;
}

/** Academic and authorization identities used to evaluate audience selectors. */
export interface CommunicationAudienceContext {
  userId: string;
  roleIds: string[];
  student: {
    studentId: string;
    programmeIds: string[];
    facultyIds: string[];
    intakeIds: string[];
    offeringIds: string[];
  } | null;
  lecturer: {
    lecturerId: string;
    facultyIds: string[];
    intakeIds: string[];
    offeringIds: string[];
  } | null;
}

/** Builds Prisma audience clauses that match any of a user's academic contexts. */
export function getAudienceWhere(
  context: CommunicationAudienceContext,
): Prisma.AnnouncementAudienceWhereInput[] {
  const clauses: Prisma.AnnouncementAudienceWhereInput[] = [];
  if (context.student !== null) {
    clauses.push({ audienceType: "ALL_STUDENTS", targetId: null });
    addTargetClause(clauses, "FACULTY", context.student.facultyIds);
    addTargetClause(clauses, "PROGRAMME", context.student.programmeIds);
    addTargetClause(clauses, "INTAKE", context.student.intakeIds);
    addTargetClause(clauses, "COURSE_UNIT_OFFERING", context.student.offeringIds);
  }
  if (context.lecturer !== null) {
    clauses.push({ audienceType: "ALL_LECTURERS", targetId: null });
    addTargetClause(clauses, "FACULTY", context.lecturer.facultyIds);
    addTargetClause(clauses, "INTAKE", context.lecturer.intakeIds);
    addTargetClause(clauses, "COURSE_UNIT_OFFERING", context.lecturer.offeringIds);
  }
  addTargetClause(clauses, "ROLE", context.roleIds);
  return clauses;
}

/** Returns whether one audience selector matches any identity on the account. */
export function matchesAudience(
  audience: CommunicationAudienceInput,
  context: CommunicationAudienceContext,
): boolean {
  switch (audience.audienceType) {
    case "ALL_STUDENTS":
      return context.student !== null;
    case "ALL_LECTURERS":
      return context.lecturer !== null;
    case "ROLE":
      return audience.targetId !== null && context.roleIds.includes(audience.targetId);
    case "FACULTY":
      return (
        audience.targetId !== null &&
        (context.student?.facultyIds.includes(audience.targetId) === true ||
          context.lecturer?.facultyIds.includes(audience.targetId) === true)
      );
    case "PROGRAMME":
      return (
        audience.targetId !== null &&
        context.student?.programmeIds.includes(audience.targetId) === true
      );
    case "INTAKE":
      return (
        audience.targetId !== null &&
        (context.student?.intakeIds.includes(audience.targetId) === true ||
          context.lecturer?.intakeIds.includes(audience.targetId) === true)
      );
    case "COURSE_UNIT_OFFERING":
      return (
        audience.targetId !== null &&
        (context.student?.offeringIds.includes(audience.targetId) === true ||
          context.lecturer?.offeringIds.includes(audience.targetId) === true)
      );
  }
}

function addTargetClause(
  clauses: Prisma.AnnouncementAudienceWhereInput[],
  audienceType: CommunicationAudienceType,
  targetIds: readonly string[],
): void {
  if (targetIds.length > 0) {
    clauses.push({ audienceType, targetId: { in: [...new Set(targetIds)] } });
  }
}
