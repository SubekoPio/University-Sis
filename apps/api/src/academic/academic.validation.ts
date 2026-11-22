// Purpose: Share academic-structure input validation and persistence error mapping.
import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { isUUID } from "class-validator";
import type { CreateIntakeInput } from "./academic.types.js";

/** Trims a required string and rejects empty values. */
export function normalizeRequiredText(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestException(`${label} is required.`);
  }

  return value.trim();
}

/** Trims and uppercases a required institutional code. */
export function normalizeCode(value: string, label: string): string {
  return normalizeRequiredText(value, label).toUpperCase();
}

/** Rejects an invalid UUID before it reaches Prisma. */
export function validateUuid(value: string, label: string): string {
  if (typeof value !== "string" || !isUUID(value)) {
    throw new BadRequestException(`${label} must be a valid UUID.`);
  }

  return value;
}

/** Validates and returns a finite date value. */
export function validateDate(value: Date, label: string): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new BadRequestException(`${label} must be a valid date.`);
  }

  return value;
}

/** Validates the inclusive start and end dates of an academic year. */
export function validateAcademicYearRange(startDate: Date, endDate: Date): void {
  if (startDate.getTime() > endDate.getTime()) {
    throw new BadRequestException("Academic-year start date must not be after its end date.");
  }
}

/** Validates one intake's dates, selection window, and academic-year boundaries. */
export function validateIntakeWindow(
  intake: CreateIntakeInput,
  yearStartDate: Date,
  yearEndDate: Date,
): void {
  if (!Number.isInteger(intake.sequence) || intake.sequence < 1 || intake.sequence > 3) {
    throw new BadRequestException("Intake sequence must be 1, 2, or 3.");
  }
  if (intake.startDate.getTime() > intake.endDate.getTime()) {
    throw new BadRequestException("Intake start date must not be after its end date.");
  }
  if (
    intake.startDate.getTime() < yearStartDate.getTime() ||
    intake.endDate.getTime() > yearEndDate.getTime()
  ) {
    throw new BadRequestException("Intake dates must fall within the academic year.");
  }
  if (intake.selectionOpensAt.getTime() >= intake.selectionClosesAt.getTime()) {
    throw new BadRequestException("The intake selection window must open before it closes.");
  }
  if (intake.selectionClosesAt.getTime() >= intake.endDate.getTime()) {
    throw new BadRequestException("The selection window must close before the intake ends.");
  }
}

/** Rejects date ranges that overlap, treating both intake endpoints as inclusive. */
export function validateNoOverlappingIntakes(
  intakes: readonly Pick<CreateIntakeInput, "sequence" | "startDate" | "endDate">[],
): void {
  const ordered = [...intakes].sort(
    (left, right) => left.startDate.getTime() - right.startDate.getTime(),
  );
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (
      previous !== undefined &&
      current !== undefined &&
      current.startDate.getTime() <= previous.endDate.getTime()
    ) {
      throw new BadRequestException("Intake date ranges must not overlap.");
    }
  }
}

/** Validates exactly three uniquely sequenced intakes within one academic year. */
export function validateThreeIntakes(
  intakes: readonly CreateIntakeInput[],
  yearStartDate: Date,
  yearEndDate: Date,
): void {
  if (intakes.length !== 3) {
    throw new BadRequestException("An academic year must be created with exactly three intakes.");
  }

  const sequences = intakes.map(({ sequence }) => sequence).sort((left, right) => left - right);
  if (sequences.some((sequence, index) => sequence !== index + 1)) {
    throw new BadRequestException("Academic-year intakes must have sequences 1, 2, and 3.");
  }

  for (const intake of intakes) {
    validateIntakeWindow(intake, yearStartDate, yearEndDate);
  }
  validateNoOverlappingIntakes(intakes);
}

/** Rejects updates that do not contain at least one defined field. */
export function requireUpdateFields(input: object, label: string): void {
  if (Object.values(input).every((value) => value === undefined)) {
    throw new BadRequestException(`At least one ${label} field must be provided.`);
  }
}

/** Identifies a Prisma request failure by its known error code. */
export function isPrismaRequestError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

/** Maps a unique-constraint error to a conflict and rethrows all other failures. */
export function rethrowUniqueConflict(error: unknown, message: string): never {
  if (isPrismaRequestError(error, "P2002")) {
    throw new ConflictException(message);
  }

  throw error;
}
