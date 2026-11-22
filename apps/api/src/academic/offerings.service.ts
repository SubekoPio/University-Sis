// Purpose: Coordinate shared course-unit offerings, capacity, and lecturer assignments.
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DeliveryMode, OfferingLecturerRole } from "@prisma/client";
import type {
  AssignOfferingLecturerInput,
  BulkCreateOfferingsInput,
  CreateOfferingInput,
} from "./academic-catalog.types.js";
import type { OfferingDetails } from "./offerings.repository.js";
import { OfferingsRepository } from "./offerings.repository.js";
import { rethrowUniqueConflict, validateUuid } from "./academic.validation.js";
import { CourseUnitsService } from "./course-units.service.js";
import { CurriculumService } from "./curriculum.service.js";
import { IntakesService } from "./intakes.service.js";

/** Provides shared course-unit offering and lecturer assignment operations. */
@Injectable()
export class OfferingsService {
  /** Receives the repository and course-unit, curriculum, and intake services. */
  constructor(
    private readonly repository: OfferingsRepository,
    private readonly courseUnitsService: CourseUnitsService,
    private readonly curriculumService: CurriculumService,
    private readonly intakesService: IntakesService,
  ) {}

  /** Lists all offerings configured for an active intake. */
  async listOfferings(intakeId: string): Promise<OfferingDetails[]> {
    const intake = await this.intakesService.getIntake(intakeId);
    return this.repository.listForIntake(intake.id);
  }

  /** Creates one planned offering and rejects a duplicate unit-intake pair. */
  async createOffering(input: CreateOfferingInput): Promise<OfferingDetails> {
    const courseUnitId = validateUuid(input.courseUnitId, "Course-unit ID");
    const intakeId = validateUuid(input.intakeId, "Intake ID");
    const courseUnit = await this.courseUnitsService.getCourseUnit(courseUnitId);
    if (courseUnit.status !== "ACTIVE") {
      throw new ConflictException("Only active course units can receive new offerings.");
    }
    await this.intakesService.getIntake(intakeId);

    const normalized: CreateOfferingInput = {
      courseUnitId,
      intakeId,
      deliveryMode: this.validateDeliveryMode(input.deliveryMode),
      capacity: this.validateCapacity(input.capacity),
    };
    try {
      return await this.repository.create(normalized);
    } catch (error: unknown) {
      rethrowUniqueConflict(
        error,
        "This course unit already has an offering for the selected intake.",
      );
    }
  }

  /** Creates one offering for every distinct active curriculum unit in an intake. */
  async bulkCreateFromCurriculum(
    intakeId: string,
    input: BulkCreateOfferingsInput,
  ): Promise<OfferingDetails[]> {
    const intake = await this.intakesService.getIntake(intakeId);
    const normalized: BulkCreateOfferingsInput = {
      deliveryMode: this.validateDeliveryMode(input.deliveryMode),
      capacity: this.validateCapacity(input.capacity),
    };
    const courseUnitIds = await this.curriculumService.getCourseUnitIdsForIntakeSlot(
      intake.sequence,
    );
    if (courseUnitIds.length === 0) {
      return [];
    }

    const existing = await this.repository.findExistingUnitIds(intake.id, courseUnitIds);
    if (existing.length > 0) {
      throw new ConflictException(
        "One or more curriculum course units already have an offering for this intake.",
      );
    }

    try {
      return await this.repository.bulkCreate(intake.id, courseUnitIds, normalized);
    } catch (error: unknown) {
      rethrowUniqueConflict(
        error,
        "A course unit already has an offering for the selected intake.",
      );
    }
  }

  /** Copies the previous intake's offerings and lecturer roles into a new setup. */
  async copyFromPreviousIntake(intakeId: string): Promise<OfferingDetails[]> {
    const intake = await this.intakesService.getIntake(intakeId);
    const result = await this.repository.copyFromPreviousIntake(intake.id);
    if (result.kind === "target-not-found") {
      throw new NotFoundException("Intake not found.");
    }
    if (result.kind === "previous-intake-not-found") {
      throw new NotFoundException("No previous intake was found to copy.");
    }
    if (result.kind === "duplicate-offerings") {
      throw new ConflictException(
        "One or more copied course units already have an offering for this intake.",
      );
    }
    return result.offerings;
  }

  /** Updates an offering's capacity; null removes the capacity limit. */
  async setCapacity(id: string, capacity: number | null): Promise<OfferingDetails> {
    const offering = await this.repository.updateCapacity(
      validateUuid(id, "Offering ID"),
      this.validateCapacity(capacity),
    );
    if (offering === null) {
      throw new NotFoundException("Offering not found.");
    }
    return offering;
  }

  /** Assigns a lecturer as PRIMARY or ASSISTANT to an offering. */
  async assignLecturer(offeringId: string, input: AssignOfferingLecturerInput) {
    const id = validateUuid(offeringId, "Offering ID");
    const lecturerId = validateUuid(input.lecturerId, "Lecturer ID");
    const role = this.validateLecturerRole(input.role);
    try {
      const result = await this.repository.assignLecturer(id, {
        lecturerId,
        role,
      });
      if (result.kind === "offering-not-found") {
        throw new NotFoundException("Offering not found.");
      }
      if (result.kind === "lecturer-not-found") {
        throw new NotFoundException("Active lecturer not found.");
      }
      if (result.kind === "primary-already-assigned") {
        throw new ConflictException("An offering can have only one PRIMARY lecturer.");
      }
      return result.assignment;
    } catch (error: unknown) {
      rethrowUniqueConflict(error, "This lecturer is already assigned to the offering.");
    }
  }

  /** Replaces one lecturer while preserving that assignment's role. */
  async replaceLecturer(
    offeringId: string,
    currentLecturerId: string,
    replacementLecturerId: string,
  ) {
    const id = validateUuid(offeringId, "Offering ID");
    const currentId = validateUuid(currentLecturerId, "Current lecturer ID");
    const replacementId = validateUuid(replacementLecturerId, "Replacement lecturer ID");
    if (currentId === replacementId) {
      throw new BadRequestException(
        "The replacement lecturer must differ from the current lecturer.",
      );
    }

    try {
      const result = await this.repository.replaceLecturer(id, currentId, replacementId);
      if (result.kind === "assignment-not-found") {
        throw new NotFoundException("Lecturer assignment not found.");
      }
      if (result.kind === "lecturer-not-found") {
        throw new NotFoundException("Active replacement lecturer not found.");
      }
      if (result.kind === "lecturer-already-assigned") {
        throw new ConflictException(
          "The replacement lecturer is already assigned to this offering.",
        );
      }
      return result.assignment;
    } catch (error: unknown) {
      rethrowUniqueConflict(
        error,
        "The replacement lecturer is already assigned to this offering.",
      );
    }
  }

  /** Removes one lecturer from an offering. */
  async removeLecturer(offeringId: string, lecturerId: string): Promise<void> {
    const removed = await this.repository.removeLecturer(
      validateUuid(offeringId, "Offering ID"),
      validateUuid(lecturerId, "Lecturer ID"),
    );
    if (!removed) {
      throw new NotFoundException("Lecturer assignment not found.");
    }
  }

  private validateCapacity(capacity: number | null | undefined): number | null {
    if (capacity === undefined || capacity === null) {
      return null;
    }
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new BadRequestException("Offering capacity must be a positive whole number or null.");
    }
    return capacity;
  }

  private validateDeliveryMode(mode: DeliveryMode): DeliveryMode {
    if (!Object.values(DeliveryMode).includes(mode)) {
      throw new BadRequestException("The selected delivery mode is invalid.");
    }
    return mode;
  }

  private validateLecturerRole(role: OfferingLecturerRole): OfferingLecturerRole {
    if (!Object.values(OfferingLecturerRole).includes(role)) {
      throw new BadRequestException("The selected lecturer role is invalid.");
    }
    return role;
  }
}
