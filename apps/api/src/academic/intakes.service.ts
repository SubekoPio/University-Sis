// Purpose: Coordinate intake date validation, lifecycle transitions, and persistence.
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { IntakeStatus } from "@prisma/client";
import type { Intake } from "@prisma/client";
import {
  normalizeRequiredText,
  requireUpdateFields,
  validateDate,
  validateIntakeWindow,
  validateNoOverlappingIntakes,
  validateUuid,
} from "./academic.validation.js";
import type { IntakeWithAcademicYear } from "./intakes.repository.js";
import type {
  CreateIntakeInput,
  IntakeStatusTransition,
  UpdateIntakeInput,
} from "./academic.types.js";
import { IntakesRepository } from "./intakes.repository.js";

const nextIntakeStatus: Record<IntakeStatus, IntakeStatus | null> = {
  [IntakeStatus.UPCOMING]: IntakeStatus.SELECTION_OPEN,
  [IntakeStatus.SELECTION_OPEN]: IntakeStatus.ACTIVE,
  [IntakeStatus.ACTIVE]: IntakeStatus.CLOSED,
  [IntakeStatus.CLOSED]: null,
};

/** Provides intake scheduling and lifecycle operations to academic feature modules. */
@Injectable()
export class IntakesService {
  /** Receives the intake repository. */
  constructor(private readonly repository: IntakesRepository) {}

  /** Lists active intakes for an active academic year. */
  async listIntakes(academicYearId: string): Promise<Intake[]> {
    const intakes = await this.repository.listForAcademicYear(
      validateUuid(academicYearId, "Academic-year ID"),
    );
    if (intakes === null) {
      throw new NotFoundException("Academic year not found.");
    }

    return intakes;
  }

  /** Finds an active intake or throws when it does not exist. */
  async getIntake(id: string): Promise<IntakeWithAcademicYear> {
    const intake = await this.repository.findById(validateUuid(id, "Intake ID"));
    if (intake === null) {
      throw new NotFoundException("Intake not found.");
    }

    return intake;
  }

  /** Updates intake dates or name after checking its year bounds and sibling dates. */
  async updateIntake(id: string, input: UpdateIntakeInput): Promise<IntakeWithAcademicYear> {
    const intakeId = validateUuid(id, "Intake ID");
    requireUpdateFields(input, "intake");
    const current = await this.repository.findById(intakeId);
    if (current === null) {
      throw new NotFoundException("Intake not found.");
    }

    const data: UpdateIntakeInput = {
      ...(input.name === undefined
        ? {}
        : { name: normalizeRequiredText(input.name, "Intake name") }),
      ...(input.startDate === undefined
        ? {}
        : { startDate: validateDate(input.startDate, "Intake start date") }),
      ...(input.endDate === undefined
        ? {}
        : { endDate: validateDate(input.endDate, "Intake end date") }),
      ...(input.selectionOpensAt === undefined
        ? {}
        : {
            selectionOpensAt: validateDate(input.selectionOpensAt, "Selection opening date"),
          }),
      ...(input.selectionClosesAt === undefined
        ? {}
        : {
            selectionClosesAt: validateDate(input.selectionClosesAt, "Selection closing date"),
          }),
    };
    const candidate: CreateIntakeInput = {
      sequence: current.sequence,
      name: data.name ?? current.name,
      startDate: data.startDate ?? current.startDate,
      endDate: data.endDate ?? current.endDate,
      selectionOpensAt: data.selectionOpensAt ?? current.selectionOpensAt,
      selectionClosesAt: data.selectionClosesAt ?? current.selectionClosesAt,
    };
    validateIntakeWindow(candidate, current.academicYear.startDate, current.academicYear.endDate);

    const siblings = await this.repository.listAllForAcademicYear(current.academicYearId);
    if (siblings === null) {
      throw new NotFoundException("Academic year not found.");
    }
    validateNoOverlappingIntakes([
      ...siblings.filter((sibling) => sibling.id !== current.id),
      candidate,
    ]);

    const updated = await this.repository.update(intakeId, data);
    if (updated === null) {
      throw new ConflictException("The intake changed before the update could be saved.");
    }

    return updated;
  }

  /** Advances an intake by exactly one permitted lifecycle state. */
  async transitionIntakeStatus(
    id: string,
    nextStatus: IntakeStatusTransition,
  ): Promise<IntakeWithAcademicYear> {
    const intakeId = validateUuid(id, "Intake ID");
    if (!Object.values(IntakeStatus).includes(nextStatus)) {
      throw new BadRequestException("The requested intake status is invalid.");
    }

    const current = await this.repository.findById(intakeId);
    if (current === null) {
      throw new NotFoundException("Intake not found.");
    }
    if (nextIntakeStatus[current.status] !== nextStatus) {
      throw new ConflictException(
        `An intake in ${current.status} can only transition to ${nextIntakeStatus[current.status] ?? "no further status"}.`,
      );
    }

    const updated = await this.repository.transitionStatus(intakeId, current.status, nextStatus);
    if (updated === null) {
      throw new ConflictException(
        "The intake status changed before the transition could be saved.",
      );
    }

    return updated;
  }

  /** Deletes an unreferenced intake or soft-deletes an intake referenced by history. */
  async deleteIntake(id: string): Promise<void> {
    const deleted = await this.repository.delete(validateUuid(id, "Intake ID"), new Date());
    if (deleted === null) {
      throw new NotFoundException("Intake not found.");
    }
  }
}
