// Purpose: Coordinate student-profile access, admission creation, and audited changes.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, StudentSchedule, StudyMode, UserStatus } from "@prisma/client";
import type { Student } from "@prisma/client";
import { isUUID } from "class-validator";
import { RbacService } from "../common/rbac/rbac.service.js";
import {
  isPrismaRequestError,
  normalizeRequiredText,
  requireUpdateFields,
} from "./academic.validation.js";
import { StudentsRepository } from "./students.repository.js";
import type { ChangedStudyMode, StudentProfile } from "./students.repository.js";
import type {
  ChangeStudyModeInput,
  CreateStudentProfileForAdmissionInput,
  StudentListFilters,
  StudentPage,
  UpdateStudentInput,
} from "./sis.types.js";

const STUDENT_READ_PERMISSION = "sis:student:read";
const STUDENT_READ_OWN_PERMISSION = "sis:student:read_own";
const STUDENT_CREATE_PERMISSION = "sis:student:create_after_admission";
const STUDENT_UPDATE_PERMISSION = "sis:student:update";
const STUDENT_UPDATE_OWN_PERMISSION = "sis:student:update_contact_own";
const STUDENT_ARCHIVE_PERMISSION = "sis:student:archive";
const STUDY_MODE_CHANGE_PERMISSION = "admissions:study-mode:change";
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const OWN_CONTACT_FIELDS = new Set<string>([
  "phone",
  "address",
  "nextOfKinName",
  "nextOfKinPhone",
  "nextOfKinRelationship",
]);

/** Provides permission-gated student-profile workflows. */
@Injectable()
export class StudentsService {
  /** Receives student persistence and RBAC services. */
  constructor(
    private readonly repository: StudentsRepository,
    private readonly rbac: RbacService,
  ) {}

  /** Creates a student profile only inside the already-authorized admission transaction. */
  async createProfileForAdmission(
    transaction: Prisma.TransactionClient,
    input: CreateStudentProfileForAdmissionInput,
    actorId: string,
  ): Promise<Student> {
    await this.assertPermission(actorId, STUDENT_CREATE_PERMISSION);
    this.validateStudentProfileForAdmission(input);

    const student = await this.repository.createProfileForAdmission(
      transaction,
      {
        ...input,
        studentNumber: normalizeRequiredText(input.studentNumber, "Student number").toUpperCase(),
        phone: normalizeRequiredText(input.phone, "Student phone"),
        nationality: normalizeRequiredText(input.nationality, "Student nationality"),
      },
      actorId,
    );
    if (student === null) {
      throw new ConflictException(
        "The active student account is missing or already has a profile.",
      );
    }

    return student;
  }

  /** Searches active student profiles with bounded pagination and scope-aware results. */
  async listStudents(
    filters: StudentListFilters,
    actorId: string,
  ): Promise<StudentPage<StudentProfile>> {
    const permissions = await this.getActivePermissions(actorId);
    const canReadAll = permissions.includes(STUDENT_READ_PERMISSION);
    if (!canReadAll && !permissions.includes(STUDENT_READ_OWN_PERMISSION)) {
      throw new ForbiddenException(`The ${STUDENT_READ_PERMISSION} permission is required.`);
    }

    const page = filters.page ?? DEFAULT_PAGE;
    const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
    if (!Number.isSafeInteger(page) || page < 1) {
      throw new BadRequestException("Page must be a positive integer.");
    }
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      throw new BadRequestException(`Page size must be between 1 and ${MAX_PAGE_SIZE}.`);
    }
    const skip = (page - 1) * pageSize;
    if (!Number.isSafeInteger(skip)) {
      throw new BadRequestException("Page offset is outside the supported range.");
    }

    const search = filters.search?.trim();
    const result = await this.repository.list({
      ...(search ? { search } : {}),
      skip,
      take: pageSize,
      ...(canReadAll ? {} : { userId: actorId }),
    });
    return { ...result, page, pageSize };
  }

  /** Reads a student profile within the caller's full-record or own-record scope. */
  async getStudent(studentId: string, actorId: string): Promise<StudentProfile> {
    const id = this.validateUuid(studentId, "Student ID");
    const permissions = await this.getActivePermissions(actorId);
    if (
      !permissions.includes(STUDENT_READ_PERMISSION) &&
      !permissions.includes(STUDENT_READ_OWN_PERMISSION)
    ) {
      throw new ForbiddenException(`The ${STUDENT_READ_PERMISSION} permission is required.`);
    }

    const student = await this.repository.findById(id);
    if (student === null) {
      throw new NotFoundException("Student not found.");
    }
    if (!permissions.includes(STUDENT_READ_PERMISSION) && student.userId !== actorId) {
      throw new ForbiddenException("Students may only read their own profile.");
    }

    return student;
  }

  /** Updates editable profile fields without changing the student's schedule. */
  async updateStudent(
    studentId: string,
    input: UpdateStudentInput,
    actorId: string,
  ): Promise<StudentProfile> {
    const id = this.validateUuid(studentId, "Student ID");
    requireUpdateFields(input, "student");
    const permissions = await this.getActivePermissions(actorId);
    const canUpdateAll = permissions.includes(STUDENT_UPDATE_PERMISSION);
    if (!canUpdateAll && !permissions.includes(STUDENT_UPDATE_OWN_PERMISSION)) {
      throw new ForbiddenException(`The ${STUDENT_UPDATE_PERMISSION} permission is required.`);
    }

    const data = this.normalizeStudentUpdate(input);
    if (!canUpdateAll) {
      if (Object.keys(data).some((field) => !OWN_CONTACT_FIELDS.has(field))) {
        throw new ForbiddenException("Students may only update their contact details.");
      }
      const current = await this.repository.findById(id);
      if (current === null) {
        throw new NotFoundException("Student not found.");
      }
      if (current.userId !== actorId) {
        throw new ForbiddenException("Students may only update their own contact details.");
      }
    }

    try {
      const updated = await this.repository.update(id, data, actorId);
      if (updated === null) {
        throw new NotFoundException("Student not found.");
      }
      return updated;
    } catch (error: unknown) {
      if (isPrismaRequestError(error, "P2002")) {
        throw new ConflictException("The student number or national ID is already in use.");
      }
      throw error;
    }
  }

  /** Deactivates a student account without deleting the student or enrollment history. */
  async archiveStudent(studentId: string, actorId: string): Promise<void> {
    const id = this.validateUuid(studentId, "Student ID");
    await this.assertPermission(actorId, STUDENT_ARCHIVE_PERMISSION);
    const target = await this.repository.findArchiveTarget(id);
    if (target === null) {
      throw new NotFoundException("Student not found.");
    }
    if (target.status === UserStatus.DEACTIVATED) {
      throw new ConflictException("The student account is already archived.");
    }
    if (target.userId === actorId) {
      throw new ForbiddenException("A user cannot archive their own student account.");
    }

    const userId = await this.repository.archive(id, actorId, new Date());
    if (userId === null) {
      throw new ConflictException("The student account changed before it could be archived.");
    }
    await this.rbac.invalidateAuthorizationSnapshot(userId);
  }

  /** Changes the admitted study mode with the existing admissions-head permission and an audit. */
  async changeStudyMode(input: ChangeStudyModeInput, actorId: string): Promise<ChangedStudyMode> {
    const applicationId = this.validateUuid(input.applicationId, "Application ID");
    if (!Object.values(StudyMode).includes(input.studyMode)) {
      throw new BadRequestException("The selected study mode is invalid.");
    }
    const reason = normalizeRequiredText(input.reason, "Study-mode change reason");
    await this.assertPermission(actorId, STUDY_MODE_CHANGE_PERMISSION);

    let result: Awaited<ReturnType<StudentsRepository["changeStudyMode"]>>;
    try {
      result = await this.repository.changeStudyMode(
        applicationId,
        input.studyMode,
        actorId,
        reason,
      );
    } catch (error: unknown) {
      if (isPrismaRequestError(error, "P2034")) {
        throw new ConflictException(
          "The application changed concurrently; reload it and try again.",
        );
      }
      throw error;
    }
    if (result.kind === "not_found") {
      throw new NotFoundException("Admitted application not found.");
    }
    if (result.kind === "unchanged") {
      throw new BadRequestException("The application already has the requested study mode.");
    }
    if (result.kind === "inconsistent") {
      throw new ConflictException(
        "The application and admission study modes changed concurrently or are inconsistent.",
      );
    }

    return result;
  }

  private async assertPermission(actorId: string, permission: string): Promise<void> {
    const permissions = await this.getActivePermissions(actorId);
    if (!permissions.includes(permission)) {
      throw new ForbiddenException(`The ${permission} permission is required.`);
    }
  }

  private async getActivePermissions(actorId: string): Promise<string[]> {
    this.validateUuid(actorId, "Actor ID");
    const status = await this.repository.findUserStatus(actorId);
    if (status !== UserStatus.ACTIVE) {
      throw new ForbiddenException("An active account is required for this student operation.");
    }
    return (await this.rbac.getAuthorizationSnapshot(actorId)).permissions;
  }

  private validateStudentProfileForAdmission(input: CreateStudentProfileForAdmissionInput): void {
    this.validateUuid(input.userId, "Student user ID");
    if (!Object.values(StudentSchedule).includes(input.schedule)) {
      throw new BadRequestException("The selected student schedule is invalid.");
    }
    if (!(input.dateOfBirth instanceof Date) || !Number.isFinite(input.dateOfBirth.getTime())) {
      throw new BadRequestException("Student date of birth must be valid.");
    }
  }

  private normalizeStudentUpdate(input: UpdateStudentInput): UpdateStudentInput {
    return {
      ...(input.studentNumber === undefined
        ? {}
        : {
            studentNumber: normalizeRequiredText(
              input.studentNumber,
              "Student number",
            ).toUpperCase(),
          }),
      ...(input.phone === undefined
        ? {}
        : { phone: this.normalizeOptionalText(input.phone, "Phone") }),
      ...(input.dateOfBirth === undefined
        ? {}
        : { dateOfBirth: this.normalizeDate(input.dateOfBirth) }),
      ...(input.gender === undefined
        ? {}
        : { gender: this.normalizeOptionalText(input.gender, "Gender") }),
      ...(input.nationality === undefined
        ? {}
        : { nationality: this.normalizeOptionalText(input.nationality, "Nationality") }),
      ...(input.nationalId === undefined
        ? {}
        : { nationalId: this.normalizeOptionalText(input.nationalId, "National ID") }),
      ...(input.address === undefined
        ? {}
        : { address: this.normalizeOptionalText(input.address, "Address") }),
      ...(input.nextOfKinName === undefined
        ? {}
        : { nextOfKinName: this.normalizeOptionalText(input.nextOfKinName, "Next-of-kin name") }),
      ...(input.nextOfKinPhone === undefined
        ? {}
        : {
            nextOfKinPhone: this.normalizeOptionalText(input.nextOfKinPhone, "Next-of-kin phone"),
          }),
      ...(input.nextOfKinRelationship === undefined
        ? {}
        : {
            nextOfKinRelationship: this.normalizeOptionalText(
              input.nextOfKinRelationship,
              "Next-of-kin relationship",
            ),
          }),
    };
  }

  private normalizeOptionalText(value: string | null, label: string): string | null {
    if (value === null) {
      return null;
    }
    if (typeof value !== "string") {
      throw new BadRequestException(`${label} must be text.`);
    }
    const normalized = value.trim();
    return normalized.length === 0 ? null : normalized;
  }

  private normalizeDate(value: Date | null): Date | null {
    if (value === null) {
      return null;
    }
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
      throw new BadRequestException("Student date of birth must be valid.");
    }
    return value;
  }

  private validateUuid(value: string, label: string): string {
    if (typeof value !== "string" || !isUUID(value)) {
      throw new BadRequestException(`${label} must be a valid UUID.`);
    }
    return value;
  }
}
