// Purpose: Test exact three-intake academic-year validation and repository delegation.
import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AcademicYearsService } from "./academic-years.service.js";
import type { AcademicYearsRepository } from "./academic-years.repository.js";

const NOW = new Date("2026-11-22T12:00:00.000Z");

describe("AcademicYearsService", () => {
  it("creates exactly three intakes for one academic year", async () => {
    // Arrange: provide sequences one through three with non-overlapping windows.
    const repository = {
      createWithIntakes: vi.fn(),
    } as unknown as AcademicYearsRepository;
    vi.mocked(repository.createWithIntakes).mockResolvedValue({
      id: "c2d0b38c-26f3-466c-9a9e-6cc361223621",
      label: "2026/2027",
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      endDate: new Date("2027-07-31T23:59:59.999Z"),
      deletedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
      intakes: [],
    });
    const service = new AcademicYearsService(repository);

    // Act: create the academic year.
    await service.createAcademicYear({
      label: "2026/2027",
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      endDate: new Date("2027-07-31T23:59:59.999Z"),
      intakes: [
        {
          sequence: 1,
          name: "Intake 1",
          startDate: new Date("2026-09-01T00:00:00.000Z"),
          endDate: new Date("2026-11-30T23:59:59.999Z"),
          selectionOpensAt: new Date("2026-08-10T00:00:00.000Z"),
          selectionClosesAt: new Date("2026-08-31T23:59:59.999Z"),
        },
        {
          sequence: 2,
          name: "Intake 2",
          startDate: new Date("2026-12-01T00:00:00.000Z"),
          endDate: new Date("2027-02-28T23:59:59.999Z"),
          selectionOpensAt: new Date("2026-11-01T00:00:00.000Z"),
          selectionClosesAt: new Date("2026-11-30T23:59:59.999Z"),
        },
        {
          sequence: 3,
          name: "Intake 3",
          startDate: new Date("2027-03-01T00:00:00.000Z"),
          endDate: new Date("2027-05-31T23:59:59.999Z"),
          selectionOpensAt: new Date("2027-02-01T00:00:00.000Z"),
          selectionClosesAt: new Date("2027-02-28T23:59:59.999Z"),
        },
      ],
    });

    // Assert: the repository receives all three intake definitions.
    expect(repository.createWithIntakes).toHaveBeenCalledWith(
      expect.objectContaining({ label: "2026/2027" }),
      expect.arrayContaining([
        expect.objectContaining({ sequence: 1 }),
        expect.objectContaining({ sequence: 2 }),
        expect.objectContaining({ sequence: 3 }),
      ]),
    );
  });

  it("rejects academic-year input with fewer than three intakes", async () => {
    // Arrange: provide only one intake.
    const repository = {
      createWithIntakes: vi.fn(),
    } as unknown as AcademicYearsRepository;
    const service = new AcademicYearsService(repository);

    // Act / Assert: the validation boundary rejects incomplete intake setup.
    await expect(
      service.createAcademicYear({
        label: "2026/2027",
        startDate: new Date("2026-08-01T00:00:00.000Z"),
        endDate: new Date("2027-07-31T23:59:59.999Z"),
        intakes: [
          {
            sequence: 1,
            name: "Intake 1",
            startDate: new Date("2026-09-01T00:00:00.000Z"),
            endDate: new Date("2026-12-31T23:59:59.999Z"),
            selectionOpensAt: new Date("2026-08-01T00:00:00.000Z"),
            selectionClosesAt: new Date("2026-08-28T23:59:59.999Z"),
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createWithIntakes).not.toHaveBeenCalled();
  });
});
