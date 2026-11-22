// Purpose: Coordinate prompted course-unit data and validated student selections.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CourseUnitOfferingStatus,
  IntakeStatus,
  UnitRegistrationStatus,
  UserStatus,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { isUUID } from "class-validator";
import { RbacService } from "../common/rbac/rbac.service.js";
import { HomeCacheService } from "./home-cache.service.js";
import { normalizeRequiredText } from "./academic.validation.js";
import {
  UnitSelectionRuleError,
  type PromptedUnit,
  type PromptedUnitsResult,
  type UnitSelectionErrorReason,
  type UnitSelectionRegistration,
} from "./unit-selection.types.js";
import {
  UnitSelectionsRepository,
  type UnitSelectionOfferingRecord,
  type UnitSelectionSnapshot,
  type UnitSelectionValidator,
  UnitSelectionWriteConflictError,
} from "./unit-selections.repository.js";

const SELECT_OWN_PERMISSION = "academic:unit:select";
const ENROLLMENT_MANAGE_PERMISSION = "academic:enrollment:manage";
const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

/** Provides permission-gated course-unit prompts, selection, and drop operations. */
@Injectable()
export class UnitSelectionService {
  /** Receives registration persistence and authorization services. */
  constructor(
    private readonly repository: UnitSelectionsRepository,
    private readonly rbac: RbacService,
    private readonly homeCache: HomeCacheService,
  ) {}

  /** Returns core, elective, retake, and faculty-general unit prompts for an intake. */
  async getPromptedUnits(
    studentId: string,
    intakeId: string,
    actorId: string,
  ): Promise<PromptedUnitsResult> {
    const student = this.validateUuid(studentId, "Student ID");
    const intake = this.validateUuid(intakeId, "Intake ID");
    const actor = await this.getActivePermissions(actorId);
    const canManage = actor.permissions.includes(ENROLLMENT_MANAGE_PERMISSION);
    if (!canManage && !actor.permissions.includes(SELECT_OWN_PERMISSION)) {
      throw new ForbiddenException(`The ${SELECT_OWN_PERMISSION} permission is required.`);
    }

    const snapshot = await this.repository.getSnapshot(student, intake);
    this.assertSelectionContext(snapshot);
    if (!canManage && snapshot.student?.userId !== actor.userId) {
      throw new ForbiddenException("Students may only view their own prompted course units.");
    }

    const enrollment = snapshot.activeEnrollments[0];
    if (enrollment === undefined) {
      throw this.ruleError(
        "ACTIVE_ENROLLMENT_REQUIRED",
        "An active programme enrollment is required.",
      );
    }
    if (snapshot.intake === null) {
      throw this.ruleError("INTAKE_NOT_FOUND", "Intake not found.", 404);
    }
    const selectedOfferingIds = new Set(
      snapshot.registrations
        .filter((registration) => registration.status === UnitRegistrationStatus.SELECTED)
        .map(({ offeringId }) => offeringId),
    );
    const offeringByCourseUnit = new Map(
      snapshot.offerings.map((offering) => [offering.courseUnitId, offering]),
    );
    if (
      snapshot.curriculumEntries.some(
        (entry) =>
          entry.type === "CORE" &&
          (entry.courseUnit.status !== "ACTIVE" ||
            offeringByCourseUnit.get(entry.courseUnitId) === undefined ||
            offeringByCourseUnit.get(entry.courseUnitId)?.status ===
              CourseUnitOfferingStatus.CANCELLED),
      )
    ) {
      throw this.ruleError(
        "CORE_OFFERING_MISSING",
        "A required core unit has no selectable offering.",
      );
    }
    const currentEntries = snapshot.curriculumEntries.filter(
      ({ courseUnit }) => courseUnit.status === "ACTIVE",
    );
    const curriculumIds = new Set(currentEntries.map(({ courseUnitId }) => courseUnitId));
    const core = currentEntries
      .filter(({ type }) => type === "CORE")
      .flatMap(({ courseUnitId }) => {
        const offering = offeringByCourseUnit.get(courseUnitId);
        return offering === undefined || offering.status === CourseUnitOfferingStatus.CANCELLED
          ? []
          : [this.toPromptedUnit(offering, true, selectedOfferingIds, snapshot)];
      });
    const electives = currentEntries
      .filter(({ type }) => type === "ELECTIVE")
      .flatMap(({ courseUnitId }) => {
        const offering = offeringByCourseUnit.get(courseUnitId);
        return offering === undefined || offering.status === CourseUnitOfferingStatus.CANCELLED
          ? []
          : [this.toPromptedUnit(offering, false, selectedOfferingIds, snapshot)];
      });
    const generalUnits = snapshot.offerings
      .filter(
        (offering) =>
          !curriculumIds.has(offering.courseUnitId) &&
          offering.courseUnit.isGeneral &&
          this.isFacultyEligible(offering, enrollment.programme.department.facultyId) &&
          offering.status !== CourseUnitOfferingStatus.CANCELLED,
      )
      .map((offering) => this.toPromptedUnit(offering, false, selectedOfferingIds, snapshot));

    return {
      core,
      electives,
      retakes: [],
      generalUnits,
      electiveCreditRules: snapshot.electiveRules.map(({ minCredits, maxCredits }) => ({
        minCredits,
        maxCredits,
      })),
    };
  }

  /** Adds course units after validating the resulting intake selection. */
  selectUnits(
    studentId: string,
    intakeId: string,
    offeringIds: string[],
    actorId: string,
  ): Promise<UnitSelectionRegistration[]> {
    return this.addUnits({ studentId, intakeId, offeringIds, actorId });
  }

  /** Drops a selected unit before the intake selection deadline. */
  async dropUnit(
    studentId: string,
    intakeId: string,
    offeringId: string,
    actorId: string,
  ): Promise<UnitSelectionRegistration> {
    const student = this.validateUuid(studentId, "Student ID");
    const intake = this.validateUuid(intakeId, "Intake ID");
    const offering = this.validateUuid(offeringId, "Offering ID");
    const actor = await this.getActivePermissions(actorId);
    this.assertCanSelectOwn(actor);
    const now = new Date();
    let targetUserId: string | undefined;
    const validate: UnitSelectionValidator = (snapshot) => {
      this.assertSelectionContext(snapshot);
      targetUserId = snapshot.student?.userId;
      if (targetUserId === undefined) {
        throw new NotFoundException("Student profile not found.");
      }
      this.assertOwner(snapshot, actor.userId);
      this.assertDropAllowed(snapshot, offering, now);
    };

    try {
      const dropped = await this.repository.dropUnit(
        { studentId: student, intakeId: intake, offeringId: offering },
        validate,
      );
      if (dropped === null) {
        throw this.ruleError("UNIT_NOT_SELECTED", "The course unit is not currently selected.");
      }
      if (targetUserId === undefined) {
        throw new Error("The student identity was not loaded during unit selection.");
      }
      await this.homeCache.invalidateUser(targetUserId);
      return dropped;
    } catch (error: unknown) {
      if (error instanceof UnitSelectionRuleError) {
        throw error;
      }
      if (error instanceof UnitSelectionWriteConflictError) {
        throw this.ruleError(
          "CONCURRENT_SELECTION_CHANGE",
          "The selection changed concurrently; reload the prompted units and retry.",
        );
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw this.ruleError(
          "CONCURRENT_SELECTION_CHANGE",
          "The selection changed concurrently; reload the prompted units and retry.",
        );
      }
      throw error;
    }
  }

  /** Performs a registrar override that bypasses only the selection window. */
  async overrideSelection(input: {
    studentId: string;
    intakeId: string;
    offeringIds: string[];
    actorId: string;
    reason: string;
  }): Promise<UnitSelectionRegistration[]> {
    const student = this.validateUuid(input.studentId, "Student ID");
    const intake = this.validateUuid(input.intakeId, "Intake ID");
    const actor = await this.getActivePermissions(input.actorId);
    this.assertCanManage(actor);
    const reason = normalizeRequiredText(input.reason, "Override reason");
    return this.addUnits({
      studentId: student,
      intakeId: intake,
      offeringIds: input.offeringIds,
      actorId: actor.userId,
      overrideReason: reason,
    });
  }

  private async addUnits(input: {
    studentId: string;
    intakeId: string;
    offeringIds: string[];
    actorId: string;
    overrideReason?: string;
  }): Promise<UnitSelectionRegistration[]> {
    const studentId = this.validateUuid(input.studentId, "Student ID");
    const intakeId = this.validateUuid(input.intakeId, "Intake ID");
    const actor = await this.getActivePermissions(input.actorId);
    if (input.overrideReason === undefined) {
      this.assertCanSelectOwn(actor);
    } else {
      this.assertCanManage(actor);
    }
    const offeringIds = input.offeringIds.map((offeringId) =>
      this.validateUuid(offeringId, "Offering ID"),
    );
    if (offeringIds.length === 0) {
      throw new BadRequestException("At least one offering must be selected.");
    }
    if (new Set(offeringIds).size !== offeringIds.length) {
      throw this.ruleError("DUPLICATE_OFFERING", "An offering may be selected only once.");
    }

    const now = new Date();
    let targetUserId: string | undefined;
    const validate: UnitSelectionValidator = (snapshot) => {
      this.assertSelectionContext(snapshot);
      targetUserId = snapshot.student?.userId;
      if (targetUserId === undefined) {
        throw new NotFoundException("Student profile not found.");
      }
      this.assertOwner(snapshot, actor.userId, input.overrideReason !== undefined);
      this.assertWindowOpen(snapshot, now, input.overrideReason !== undefined);
      this.assertUnitsValid(snapshot, offeringIds);
    };

    try {
      const registrations = await this.repository.selectUnits(
        {
          studentId,
          intakeId,
          offeringIds,
          actorId: actor.userId,
          selectedAt: now,
          ...(input.overrideReason === undefined ? {} : { overrideReason: input.overrideReason }),
        },
        validate,
      );
      if (targetUserId === undefined) {
        throw new Error("The student identity was not loaded during course-unit selection.");
      }
      await this.homeCache.invalidateUser(targetUserId);
      return registrations;
    } catch (error: unknown) {
      if (error instanceof UnitSelectionRuleError) {
        throw error;
      }
      if (error instanceof UnitSelectionWriteConflictError) {
        throw this.ruleError(
          "CONCURRENT_SELECTION_CHANGE",
          "The selection changed concurrently; reload the prompted units and retry.",
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || error.code === "P2002")
      ) {
        throw this.ruleError(
          error.code === "P2002" ? "UNIT_ALREADY_SELECTED" : "CONCURRENT_SELECTION_CHANGE",
          "The selection changed concurrently; reload the prompted units and retry.",
        );
      }
      throw error;
    }
  }

  private assertSelectionContext(snapshot: UnitSelectionSnapshot): void {
    if (snapshot.student === null) {
      throw this.ruleError("STUDENT_NOT_FOUND", "Student not found.", 404);
    }
    if (snapshot.student.userStatus !== UserStatus.ACTIVE) {
      throw this.ruleError("STUDENT_NOT_FOUND", "The student account is not active.", 404);
    }
    if (snapshot.intake === null) {
      throw this.ruleError("INTAKE_NOT_FOUND", "Intake not found.", 404);
    }
    if (snapshot.activeEnrollments.length === 0) {
      throw this.ruleError(
        "ACTIVE_ENROLLMENT_REQUIRED",
        "The student has no active programme enrollment.",
      );
    }
    if (snapshot.activeEnrollments.length !== 1) {
      throw this.ruleError(
        "MULTIPLE_ACTIVE_ENROLLMENTS",
        "The student must have exactly one active programme enrollment.",
      );
    }
    const enrollment = snapshot.activeEnrollments[0];
    if (enrollment === undefined) {
      throw this.ruleError(
        "ACTIVE_ENROLLMENT_REQUIRED",
        "The student has no active programme enrollment.",
      );
    }
    if (
      enrollment.programme.deletedAt !== null ||
      enrollment.programme.department.deletedAt !== null ||
      enrollment.programme.department.faculty.deletedAt !== null
    ) {
      throw this.ruleError("PROGRAMME_UNAVAILABLE", "The student's programme is not active.");
    }
    if (
      snapshot.intake.sequence !== enrollment.currentIntakeSlot ||
      enrollment.currentStudyYear < 1 ||
      enrollment.currentStudyYear > enrollment.programme.durationYears
    ) {
      throw this.ruleError(
        "INTAKE_NOT_CURRENT",
        "The intake does not match the student's current study slot.",
      );
    }
    const admissionYearIndex = snapshot.academicYearIds.indexOf(enrollment.admissionAcademicYearId);
    const currentYearIndex = snapshot.academicYearIds.indexOf(snapshot.intake.academicYearId);
    if (
      admissionYearIndex < 0 ||
      currentYearIndex < 0 ||
      currentYearIndex !== admissionYearIndex + enrollment.currentStudyYear - 1
    ) {
      throw this.ruleError(
        "INTAKE_NOT_CURRENT",
        "The intake does not match the student's current study year.",
      );
    }
  }

  private assertWindowOpen(snapshot: UnitSelectionSnapshot, now: Date, override: boolean): void {
    const intake = snapshot.intake;
    if (intake === null) {
      throw this.ruleError("INTAKE_NOT_FOUND", "Intake not found.", 404);
    }
    if (intake.status === IntakeStatus.CLOSED) {
      throw this.ruleError(
        "SELECTION_WINDOW_CLOSED",
        "The intake is closed for course-unit selection.",
      );
    }
    if (
      !override &&
      (now.getTime() < intake.selectionOpensAt.getTime() ||
        now.getTime() >= intake.selectionClosesAt.getTime())
    ) {
      throw this.ruleError(
        "SELECTION_WINDOW_CLOSED",
        "The course-unit selection window is not open.",
      );
    }
  }

  private assertUnitsValid(snapshot: UnitSelectionSnapshot, offeringIds: string[]): void {
    const enrollment = snapshot.activeEnrollments[0];
    const intake = snapshot.intake;
    if (enrollment === undefined || intake === null) {
      throw this.ruleError(
        "ACTIVE_ENROLLMENT_REQUIRED",
        "An active programme enrollment is required.",
      );
    }
    const offeringsById = new Map(snapshot.offerings.map((offering) => [offering.id, offering]));
    const curriculumByUnitId = new Map(
      snapshot.curriculumEntries.map((entry) => [entry.courseUnitId, entry]),
    );
    const registrationsByOffering = new Map(
      snapshot.registrations.map((registration) => [registration.offeringId, registration]),
    );
    const requested: UnitSelectionOfferingRecord[] = [];

    for (const offeringId of offeringIds) {
      const offering = offeringsById.get(offeringId);
      if (offering === undefined || offering.intakeId !== intake.id) {
        throw this.ruleError(
          "OFFERING_NOT_FOUND",
          "An offering is not available in this intake.",
          404,
        );
      }
      if (offering.status === CourseUnitOfferingStatus.CANCELLED) {
        throw this.ruleError("OFFERING_CANCELLED", "A cancelled offering cannot be selected.");
      }
      if (offering.courseUnit.status !== "ACTIVE") {
        throw this.ruleError("UNIT_NOT_ELIGIBLE", "An inactive course unit cannot be selected.");
      }
      if (
        !curriculumByUnitId.has(offering.courseUnitId) &&
        (!offering.courseUnit.isGeneral ||
          !this.isFacultyEligible(offering, enrollment.programme.department.facultyId))
      ) {
        throw this.ruleError(
          "UNIT_NOT_ELIGIBLE",
          "A selected course unit is outside the student's programme or faculty eligibility.",
        );
      }

      const registration = registrationsByOffering.get(offeringId);
      if (registration?.status === UnitRegistrationStatus.SELECTED) {
        throw this.ruleError("UNIT_ALREADY_SELECTED", "The offering is already selected.");
      }
      if (registration?.status === UnitRegistrationStatus.COMPLETED) {
        throw this.ruleError(
          "COMPLETED_UNIT_CANNOT_BE_SELECTED",
          "The completed offering cannot be selected again.",
        );
      }
      requested.push(offering);
    }

    const resultingOfferings = [
      ...snapshot.registrations
        .filter((registration) => registration.status === UnitRegistrationStatus.SELECTED)
        .map((registration) => offeringsById.get(registration.offeringId))
        .filter((offering): offering is UnitSelectionOfferingRecord => offering !== undefined),
      ...requested,
    ];
    const resultingIds = new Set(resultingOfferings.map(({ id }) => id));
    const coreEntries = snapshot.curriculumEntries.filter((entry) => entry.type === "CORE");
    for (const entry of coreEntries) {
      const coreOffering = snapshot.offerings.find(
        (offering) => offering.courseUnitId === entry.courseUnitId,
      );
      if (
        coreOffering === undefined ||
        coreOffering.status === CourseUnitOfferingStatus.CANCELLED
      ) {
        throw this.ruleError(
          "CORE_OFFERING_MISSING",
          "A required core unit has no selectable offering.",
        );
      }
      if (!resultingIds.has(coreOffering.id)) {
        throw this.ruleError("CORE_UNITS_REQUIRED", "All required core units must be included.");
      }
    }

    const passedIds = new Set(snapshot.completedUnitIds);
    for (const offering of resultingOfferings) {
      for (const { prerequisiteId } of offering.courseUnit.prerequisites) {
        if (!passedIds.has(prerequisiteId)) {
          throw this.ruleError(
            "PREREQUISITE_NOT_MET",
            `The prerequisite ${prerequisiteId} must be completed before selecting this unit.`,
          );
        }
      }
    }

    this.assertNoTimetableClashes(resultingOfferings);
    this.assertElectiveCredits(snapshot, resultingOfferings, curriculumByUnitId);

    for (const offering of requested) {
      if (offering.capacity === null) {
        continue;
      }
      const occupied = snapshot.selectedCounts.get(offering.id) ?? 0;
      if (occupied >= offering.capacity) {
        throw this.ruleError("CAPACITY_EXCEEDED", `The offering ${offering.id} has no seats left.`);
      }
    }
  }

  private assertElectiveCredits(
    snapshot: UnitSelectionSnapshot,
    offerings: UnitSelectionOfferingRecord[],
    curriculumByUnitId: Map<string, UnitSelectionSnapshot["curriculumEntries"][number]>,
  ): void {
    const credits = offerings.reduce((total, offering) => {
      const curriculum = curriculumByUnitId.get(offering.courseUnitId);
      return curriculum?.type === "ELECTIVE" ? total + offering.courseUnit.creditUnits : total;
    }, 0);
    if (snapshot.electiveRules.length === 0) {
      if (credits === 0) {
        return;
      }
      throw this.ruleError(
        "ELECTIVE_RULE_MISSING",
        "Elective units cannot be selected until a credit rule is configured.",
      );
    }
    const inRange = snapshot.electiveRules.some(
      (rule) => credits >= rule.minCredits && credits <= rule.maxCredits,
    );
    if (!inRange) {
      throw this.ruleError(
        "ELECTIVE_CREDIT_RULE_NOT_MET",
        "Selected elective credits must fit within a configured elective credit range.",
      );
    }
  }

  private assertNoTimetableClashes(offerings: UnitSelectionOfferingRecord[]): void {
    for (let leftIndex = 0; leftIndex < offerings.length; leftIndex += 1) {
      const left = offerings[leftIndex];
      if (left === undefined) {
        continue;
      }
      for (let rightIndex = leftIndex + 1; rightIndex < offerings.length; rightIndex += 1) {
        const right = offerings[rightIndex];
        if (right === undefined || left.id === right.id) {
          continue;
        }
        const recurringClash = left.timetableSlots.some((leftSlot) =>
          right.timetableSlots.some(
            (rightSlot) =>
              leftSlot.dayOfWeek === rightSlot.dayOfWeek &&
              this.overlaps(
                this.timeOfDay(leftSlot.startTime),
                this.timeOfDay(leftSlot.endTime),
                this.timeOfDay(rightSlot.startTime),
                this.timeOfDay(rightSlot.endTime),
              ),
          ),
        );
        const sessionClash = left.classSessions.some((leftSession) =>
          right.classSessions.some(
            (rightSession) =>
              leftSession.startsAt.getTime() < rightSession.endsAt.getTime() &&
              rightSession.startsAt.getTime() < leftSession.endsAt.getTime(),
          ),
        );
        const leftSlotClash = left.timetableSlots.some((leftSlot) =>
          right.classSessions.some((rightSession) =>
            this.sessionOverlapsSlot(rightSession.startsAt, rightSession.endsAt, leftSlot),
          ),
        );
        const rightSlotClash = right.timetableSlots.some((rightSlot) =>
          left.classSessions.some((leftSession) =>
            this.sessionOverlapsSlot(leftSession.startsAt, leftSession.endsAt, rightSlot),
          ),
        );
        if (recurringClash || sessionClash || leftSlotClash || rightSlotClash) {
          throw this.ruleError(
            "TIMETABLE_CLASH",
            `The offerings ${left.id} and ${right.id} have overlapping scheduled classes.`,
          );
        }
      }
    }
  }

  private assertDropAllowed(snapshot: UnitSelectionSnapshot, offeringId: string, now: Date): void {
    const intake = snapshot.intake;
    if (intake === null) {
      throw this.ruleError("INTAKE_NOT_FOUND", "Intake not found.", 404);
    }
    if (
      now.getTime() >= intake.selectionClosesAt.getTime() ||
      intake.status === IntakeStatus.CLOSED
    ) {
      throw this.ruleError("DROP_DEADLINE_PASSED", "The course-unit drop deadline has passed.");
    }
    const offering = snapshot.offerings.find(({ id }) => id === offeringId);
    if (offering === undefined) {
      throw this.ruleError("OFFERING_NOT_FOUND", "The offering was not found in this intake.", 404);
    }
    const registration = snapshot.registrations.find(
      (item) => item.offeringId === offeringId && item.status === UnitRegistrationStatus.SELECTED,
    );
    if (registration === undefined) {
      throw this.ruleError("UNIT_NOT_SELECTED", "The course unit is not currently selected.");
    }

    const curriculum = snapshot.curriculumEntries.find(
      ({ courseUnitId }) => courseUnitId === offering.courseUnitId,
    );
    if (curriculum?.type === "CORE") {
      throw this.ruleError("CORE_UNIT_CANNOT_DROP", "A compulsory core unit cannot be dropped.");
    }
    if (curriculum?.type !== "ELECTIVE") {
      return;
    }
    const selectedElectives = snapshot.registrations
      .filter((item) => item.status === UnitRegistrationStatus.SELECTED)
      .filter((item) => {
        const candidate = snapshot.offerings.find((entry) => entry.id === item.offeringId);
        return (
          candidate !== undefined &&
          snapshot.curriculumEntries.some(
            (entry) => entry.courseUnitId === candidate.courseUnitId && entry.type === "ELECTIVE",
          )
        );
      })
      .reduce((total, item) => {
        const candidate = snapshot.offerings.find((entry) => entry.id === item.offeringId);
        return total + (candidate?.courseUnit.creditUnits ?? 0);
      }, 0);
    const resultingCredits = selectedElectives - offering.courseUnit.creditUnits;
    if (
      snapshot.electiveRules.length > 0 &&
      !snapshot.electiveRules.some(
        (rule) => resultingCredits >= rule.minCredits && resultingCredits <= rule.maxCredits,
      )
    ) {
      throw this.ruleError(
        "ELECTIVE_CREDIT_RULE_NOT_MET",
        "Dropping this elective would violate the configured elective credit range.",
      );
    }
  }

  private toPromptedUnit(
    offering: UnitSelectionOfferingRecord,
    preselected: boolean,
    selectedIds: Set<string>,
    snapshot: UnitSelectionSnapshot,
  ): PromptedUnit {
    const primaryAssignment = offering.lecturers[0];
    const occupied = snapshot.selectedCounts.get(offering.id) ?? 0;
    const seatsLeft = offering.capacity === null ? null : Math.max(0, offering.capacity - occupied);
    return {
      offering: {
        id: offering.id,
        status: offering.status,
        capacity: offering.capacity,
        seatsLeft,
        courseUnit: {
          id: offering.courseUnit.id,
          code: offering.courseUnit.code,
          name: offering.courseUnit.name,
          creditUnits: offering.courseUnit.creditUnits,
        },
        primaryLecturer: primaryAssignment?.lecturer ?? null,
        // Meeting URLs are intentionally excluded from prompted-unit responses.
        sessions: offering.classSessions.map((session) => ({
          id: session.id,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          deliveryMode: session.deliveryMode,
          room: session.room,
        })),
      },
      isRetake: false,
      preselected,
      currentlySelected: selectedIds.has(offering.id),
    };
  }

  private isFacultyEligible(offering: UnitSelectionOfferingRecord, facultyId: string): boolean {
    return (
      offering.courseUnit.openToAllFaculties ||
      offering.courseUnit.facultyEligibilities.some((item) => item.facultyId === facultyId)
    );
  }

  private timeOfDay(value: Date): number {
    return (
      value.getUTCHours() * 3_600_000 +
      value.getUTCMinutes() * 60_000 +
      value.getUTCSeconds() * 1_000 +
      value.getUTCMilliseconds()
    );
  }

  private sessionOverlapsSlot(
    startsAt: Date,
    endsAt: Date,
    slot: UnitSelectionOfferingRecord["timetableSlots"][number],
  ): boolean {
    const weekday = WEEKDAYS[startsAt.getUTCDay()];
    return (
      weekday === slot.dayOfWeek &&
      this.overlaps(
        this.timeOfDay(startsAt),
        this.timeOfDay(endsAt),
        this.timeOfDay(slot.startTime),
        this.timeOfDay(slot.endTime),
      )
    );
  }

  private overlaps(
    leftStart: number,
    leftEnd: number,
    rightStart: number,
    rightEnd: number,
  ): boolean {
    return leftStart < rightEnd && rightStart < leftEnd;
  }

  private assertCanSelectOwn(actor: { permissions: string[] }): void {
    if (!actor.permissions.includes(SELECT_OWN_PERMISSION)) {
      throw new ForbiddenException(`The ${SELECT_OWN_PERMISSION} permission is required.`);
    }
  }

  private assertCanManage(actor: { permissions: string[] }): void {
    if (!actor.permissions.includes(ENROLLMENT_MANAGE_PERMISSION)) {
      throw new ForbiddenException(`The ${ENROLLMENT_MANAGE_PERMISSION} permission is required.`);
    }
  }

  private assertOwner(snapshot: UnitSelectionSnapshot, actorId: string, override = false): void {
    if (!override && snapshot.student?.userId !== actorId) {
      throw new ForbiddenException("Students may only select or drop their own course units.");
    }
  }

  private async getActivePermissions(
    actorId: string,
  ): Promise<{ userId: string; permissions: string[] }> {
    const userId = this.validateUuid(actorId, "Actor ID");
    const status = await this.repository.findUserStatus(userId);
    if (status !== UserStatus.ACTIVE) {
      throw new ForbiddenException("An active account is required for course-unit selection.");
    }
    const authorization = await this.rbac.getAuthorizationSnapshot(userId);
    return { userId, permissions: authorization.permissions };
  }

  private validateUuid(value: string, label: string): string {
    if (typeof value !== "string" || !isUUID(value)) {
      throw new BadRequestException(`${label} must be a valid UUID.`);
    }
    return value;
  }

  private ruleError(
    reason: UnitSelectionErrorReason,
    message: string,
    status?: number,
  ): UnitSelectionRuleError {
    return status === undefined
      ? new UnitSelectionRuleError(reason, message)
      : new UnitSelectionRuleError(reason, message, status);
  }
}
