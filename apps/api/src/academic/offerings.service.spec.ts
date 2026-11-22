// Purpose: Test unique course-unit offerings within an intake and bulk duplicate prevention.
import { ConflictException } from "@nestjs/common";
import { DeliveryMode } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { CourseUnitsService } from "./course-units.service.js";
import { CurriculumService } from "./curriculum.service.js";
import { IntakesService } from "./intakes.service.js";
import { OfferingsRepository } from "./offerings.repository.js";
import { OfferingsService } from "./offerings.service.js";

const UNIT_ID = "c2d0b38c-26f3-466c-9a9e-6cc361223621";
const INTAKE_ID = "93e81866-3eea-4bdf-b681-b18696f22af7";

describe("OfferingsService", () => {
  it("rejects a second bulk offering for a unit already offered in the intake", async () => {
    // Arrange: curriculum contains the unit and the destination intake already has it.
    const repository = {
      findExistingUnitIds: vi.fn(),
    } as unknown as OfferingsRepository;
    vi.mocked(repository.findExistingUnitIds).mockResolvedValue([UNIT_ID]);
    const courseUnits = {} as CourseUnitsService;
    const curriculum = {
      getCourseUnitIdsForIntakeSlot: vi.fn().mockResolvedValue([UNIT_ID]),
    } as unknown as CurriculumService;
    const intakes = {
      getIntake: vi.fn().mockResolvedValue({
        id: INTAKE_ID,
        sequence: 1,
      }),
    } as unknown as IntakesService;
    const service = new OfferingsService(repository, courseUnits, curriculum, intakes);

    // Act / Assert: the one-offering-per-unit rule rejects the bulk operation.
    await expect(
      service.bulkCreateFromCurriculum(INTAKE_ID, {
        deliveryMode: DeliveryMode.PHYSICAL,
        capacity: null,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
