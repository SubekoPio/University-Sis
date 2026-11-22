// Purpose: Register academic-structure services and their Prisma repositories.
import { Module } from "@nestjs/common";
import { PrismaModule } from "../database/prisma.module.js";
import { AcademicYearsRepository } from "./academic-years.repository.js";
import { AcademicYearsService } from "./academic-years.service.js";
import { CourseUnitsRepository } from "./course-units.repository.js";
import { CourseUnitsService } from "./course-units.service.js";
import { CurriculumRepository } from "./curriculum.repository.js";
import { CurriculumService } from "./curriculum.service.js";
import { DepartmentsRepository } from "./departments.repository.js";
import { DepartmentsService } from "./departments.service.js";
import { FacultiesRepository } from "./faculties.repository.js";
import { FacultiesService } from "./faculties.service.js";
import { IntakesRepository } from "./intakes.repository.js";
import { IntakesService } from "./intakes.service.js";
import { OfferingsRepository } from "./offerings.repository.js";
import { OfferingsService } from "./offerings.service.js";
import { ProgrammesRepository } from "./programmes.repository.js";
import { ProgrammesService } from "./programmes.service.js";

/** Provides academic-structure services without registering HTTP controllers or guards. */
@Module({
  imports: [PrismaModule],
  providers: [
    AcademicYearsRepository,
    AcademicYearsService,
    CourseUnitsRepository,
    CourseUnitsService,
    CurriculumRepository,
    CurriculumService,
    DepartmentsRepository,
    DepartmentsService,
    FacultiesRepository,
    FacultiesService,
    IntakesRepository,
    IntakesService,
    OfferingsRepository,
    OfferingsService,
    ProgrammesRepository,
    ProgrammesService,
  ],
  exports: [
    AcademicYearsService,
    CourseUnitsService,
    CurriculumService,
    DepartmentsService,
    FacultiesService,
    IntakesService,
    OfferingsService,
    ProgrammesService,
  ],
})
export class AcademicModule {}
