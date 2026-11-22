// Purpose: Coordinate enrollment history, lifecycle transitions, and academic progression.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  IntakeRegistrationStatus,
  IntakeStatus,
  ProgrammeEnrollmentStatus,
  UserStatus,
} from "@prisma/client";
import { isUUID } from "class-validator";
import { RbacService } from "../common/rbac/rbac.service.js";
import { normalizeRequiredText } from "./academic.validation.js";
import { ProgrammeEnrollmentsRepository } from "./programme-enrollments.repository.js";
import type { ProgrammeEnrollmentRecord } from "./programme-enrollments.repository.js";
import type { EnrollmentTransitionInput } from "./sis.types.js";

const ENROLLMENT_MANAGE_PERMISSION = "academic:enrollment:manage";
const ENROLLMENT_READ_OWN_PERMISSION = "academic:enrollment:read_own";

/** Provides permission-gated enrollment lifecycle and progression workflows. */
@Injectable()
export class ProgrammeEnrollmentService {
  /** Receives enrollment persistence and RBAC services. */
  constructor(
    private readonly repository: ProgrammeEnrollmentsRepository,
    private readonly rbac: RbacService,
  ) {}

  /** Lists all current and historical programme enrollments in scope. */
  async getEnrollmentHistory(
    studentId: string,
    actorId: string,
  ): Promise<ProgrammeEnrollmentRecord[]> {
    const id = this.validateUuid(studentId, "Student ID");
    const permissions = await this.getActivePermissions(actorId);
    const canManage = permissions.includes(ENROLLMENT_MANAGE_PERMISSION);
    if (!canManage && !permissions.includes(ENROLLMENT_READ_OWN_PERMISSION)) {
      throw new ForbiddenException(`The ${ENROLLMENT_MANAGE_PERMISSION} permission is required.`);
    }
    const ownerId = await this.repository.findStudentOwner(id);
    if (ownerId === null) {
      throw new NotFoundException("Student not found.");
    }
    if (!canManage && ownerId !== actorId) {
      throw new ForbiddenException("Students may only read their own enrollment history.");
    }
    return this.repository.listForStudent(id);
  }

  /** Defers an active programme enrollment while preserving its record. */
  defer(input: EnrollmentTransitionInput): Promise<ProgrammeEnrollmentRecord> {
    return this.transition(
      input,
      [ProgrammeEnrollmentStatus.ACTIVE],
      ProgrammeEnrollmentStatus.DEFERRED,
    );
  }

  /** Withdraws an active or deferred programme enrollment without deleting its history. */
  withdraw(input: EnrollmentTransitionInput): Promise<ProgrammeEnrollmentRecord> {
    return this.transition(
      input,
      [ProgrammeEnrollmentStatus.ACTIVE, ProgrammeEnrollmentStatus.DEFERRED],
      ProgrammeEnrollmentStatus.WITHDRAWN,
    );
  }

  /** Marks an active programme enrollment complete without removing its record. */
  complete(input: EnrollmentTransitionInput): Promise<ProgrammeEnrollmentRecord> {
    return this.transition(
      input,
      [ProgrammeEnrollmentStatus.ACTIVE],
      ProgrammeEnrollmentStatus.COMPLETED,
    );
  }

  /** Completes a closed intake registration and advances the enrollment's study position. */
  async progressAfterIntake(
    enrollmentId: string,
    intakeId: string,
    actorId: string,
  ): Promise<ProgrammeEnrollmentRecord> {
    await this.assertCanManage(actorId);
    const id = this.validateUuid(enrollmentId, "Enrollment ID");
    const completedIntakeId = this.validateUuid(intakeId, "Intake ID");
    const context = await this.repository.findProgressionContext(id, completedIntakeId);
    if (context === null) {
      throw new NotFoundException("Programme enrollment or active intake not found.");
    }

    const { enrollment, intake } = context;
    if (enrollment.status !== ProgrammeEnrollmentStatus.ACTIVE) {
      throw new ConflictException("Only an active programme enrollment can progress.");
    }
    if (intake.status !== IntakeStatus.CLOSED) {
      throw new ConflictException("Progression is allowed only after the intake is closed.");
    }
    if (context.registrationStatus !== IntakeRegistrationStatus.REGISTERED) {
      throw new ConflictException("The student must be registered for the completed intake.");
    }
    if (intake.sequence !== enrollment.currentIntakeSlot) {
      throw new ConflictException(
        "The completed intake does not match the enrollment's current slot.",
      );
    }
    if (
      enrollment.currentStudyYear > enrollment.programme.durationYears ||
      enrollment.currentStudyYear < 1
    ) {
      throw new ConflictException("The enrollment's study year is outside its programme duration.");
    }

    const admissionYearIndex = context.academicYearIds.indexOf(
      enrollment.admissionIntake.academicYearId,
    );
    const completedYearIndex = context.academicYearIds.indexOf(intake.academicYearId);
    const expectedYearIndex = admissionYearIndex + enrollment.currentStudyYear - 1;
    if (
      admissionYearIndex < 0 ||
      completedYearIndex < 0 ||
      completedYearIndex !== expectedYearIndex
    ) {
      throw new ConflictException(
        "The completed intake does not match the enrollment's study year.",
      );
    }

    const finalProgrammeIntake =
      enrollment.currentStudyYear === enrollment.programme.durationYears &&
      enrollment.currentIntakeSlot === 3;
    const nextStudyYear =
      enrollment.currentIntakeSlot === 3 && !finalProgrammeIntake
        ? enrollment.currentStudyYear + 1
        : enrollment.currentStudyYear;
    const nextIntakeSlot =
      enrollment.currentIntakeSlot === 3 && !finalProgrammeIntake
        ? 1
        : finalProgrammeIntake
          ? enrollment.currentIntakeSlot
          : enrollment.currentIntakeSlot + 1;
    const nextStatus = finalProgrammeIntake
      ? ProgrammeEnrollmentStatus.COMPLETED
      : ProgrammeEnrollmentStatus.ACTIVE;

    const advanced = await this.repository.advanceAfterIntake({
      enrollmentId: id,
      intakeId: completedIntakeId,
      currentStudyYear: enrollment.currentStudyYear,
      currentIntakeSlot: enrollment.currentIntakeSlot,
      nextStudyYear,
      nextIntakeSlot,
      nextStatus,
      actorId,
    });
    if (advanced === null) {
      throw new ConflictException("The enrollment or intake changed before progression completed.");
    }
    return advanced;
  }

  private async transition(
    input: EnrollmentTransitionInput,
    expectedStatuses: ProgrammeEnrollmentStatus[],
    nextStatus: ProgrammeEnrollmentStatus,
  ): Promise<ProgrammeEnrollmentRecord> {
    const actorId = this.validateUuid(input.actorId, "Actor ID");
    await this.assertCanManage(actorId);
    const enrollmentId = this.validateUuid(input.enrollmentId, "Enrollment ID");
    const existing = await this.repository.findById(enrollmentId);
    if (existing === null) {
      throw new NotFoundException("Programme enrollment not found.");
    }
    if (!expectedStatuses.includes(existing.status)) {
      throw new ConflictException(
        `A ${existing.status.toLowerCase()} enrollment cannot be changed to ${nextStatus.toLowerCase()}.`,
      );
    }

    const reason =
      input.reason === undefined ? undefined : normalizeRequiredText(input.reason, "Reason");
    const updated = await this.repository.transitionStatus({
      enrollmentId,
      expectedStatuses,
      nextStatus,
      actorId,
      ...(reason === undefined ? {} : { reason }),
    });
    if (updated === null) {
      throw new ConflictException("The enrollment changed before its status could be updated.");
    }
    return updated;
  }

  private async assertCanManage(actorId: string): Promise<void> {
    const permissions = await this.getActivePermissions(actorId);
    if (!permissions.includes(ENROLLMENT_MANAGE_PERMISSION)) {
      throw new ForbiddenException(`The ${ENROLLMENT_MANAGE_PERMISSION} permission is required.`);
    }
  }

  private async getActivePermissions(actorId: string): Promise<string[]> {
    const userId = this.validateUuid(actorId, "Actor ID");
    const status = await this.repository.findUserStatus(userId);
    if (status !== UserStatus.ACTIVE) {
      throw new ForbiddenException("An active account is required for enrollment operations.");
    }
    return (await this.rbac.getAuthorizationSnapshot(userId)).permissions;
  }

  private validateUuid(value: string, label: string): string {
    if (typeof value !== "string" || !isUUID(value)) {
      throw new BadRequestException(`${label} must be a valid UUID.`);
    }
    return value;
  }
}
