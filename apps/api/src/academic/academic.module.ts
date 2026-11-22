// Purpose: Register academic services and their Prisma repositories.
import { Module } from "@nestjs/common";
import { RbacModule } from "../common/rbac/rbac.module.js";
import { PrismaModule } from "../database/prisma.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { AcademicYearsRepository } from "./academic-years.repository.js";
import { AcademicYearsService } from "./academic-years.service.js";
import { AnnouncementsService } from "./announcements.service.js";
import { CalendarEventProviderRegistry } from "./calendar-event-provider.registry.js";
import { CalendarService } from "./calendar.service.js";
import { CommunicationsRepository } from "./communications.repository.js";
import { AttendanceRepository } from "./attendance.repository.js";
import { AttendanceService } from "./attendance.service.js";
import { AttendService } from "./attend.service.js";
import { CourseUnitsRepository } from "./course-units.repository.js";
import { CourseUnitsService } from "./course-units.service.js";
import { CurriculumRepository } from "./curriculum.repository.js";
import { CurriculumService } from "./curriculum.service.js";
import { DepartmentsRepository } from "./departments.repository.js";
import { DepartmentsService } from "./departments.service.js";
import { FacultiesRepository } from "./faculties.repository.js";
import { FacultiesService } from "./faculties.service.js";
import { HomeCacheService } from "./home-cache.service.js";
import { HomeRepository } from "./home.repository.js";
import { HomeService } from "./home.service.js";
import { IntakesRepository } from "./intakes.repository.js";
import { IntakesService } from "./intakes.service.js";
import { LecturersRepository } from "./lecturers.repository.js";
import { LecturersService } from "./lecturers.service.js";
import { ManualLinkProvider } from "./manual-link.provider.js";
import { OfferingsRepository } from "./offerings.repository.js";
import { OfferingsService } from "./offerings.service.js";
import { ProgrammeEnrollmentsRepository } from "./programme-enrollments.repository.js";
import { ProgrammeEnrollmentService } from "./programme-enrollment.service.js";
import { ProgrammesRepository } from "./programmes.repository.js";
import { ProgrammesService } from "./programmes.service.js";
import { StudentsRepository } from "./students.repository.js";
import { StudentsService } from "./students.service.js";
import { SessionService } from "./session.service.js";
import { TimetableRepository } from "./timetable.repository.js";
import { TimetableService } from "./timetable.service.js";
import { MEETING_PROVIDER } from "./timetable.types.js";
import { UnitSelectionService } from "./unit-selection.service.js";
import { UnitSelectionsRepository } from "./unit-selections.repository.js";
import { AcademicRegistrarController } from "./academic-registrar.controller.js";
import { AcademicLecturerController } from "./academic-lecturer.controller.js";
import { AcademicStudentController } from "./academic-student.controller.js";

/** Provides academic-structure services without registering HTTP controllers or guards. */
@Module({
  imports: [PrismaModule, RbacModule, StorageModule],
  controllers: [AcademicRegistrarController, AcademicLecturerController, AcademicStudentController],
  providers: [
    AcademicYearsRepository,
    AcademicYearsService,
    AnnouncementsService,
    AttendanceRepository,
    AttendanceService,
    AttendService,
    CalendarEventProviderRegistry,
    CalendarService,
    CommunicationsRepository,
    CourseUnitsRepository,
    CourseUnitsService,
    CurriculumRepository,
    CurriculumService,
    DepartmentsRepository,
    DepartmentsService,
    FacultiesRepository,
    FacultiesService,
    HomeCacheService,
    HomeRepository,
    HomeService,
    IntakesRepository,
    IntakesService,
    LecturersRepository,
    LecturersService,
    { provide: MEETING_PROVIDER, useClass: ManualLinkProvider },
    OfferingsRepository,
    OfferingsService,
    ProgrammeEnrollmentsRepository,
    ProgrammeEnrollmentService,
    ProgrammesRepository,
    ProgrammesService,
    StudentsRepository,
    StudentsService,
    SessionService,
    TimetableRepository,
    TimetableService,
    UnitSelectionsRepository,
    UnitSelectionService,
  ],
  exports: [
    AcademicYearsService,
    AnnouncementsService,
    AttendanceService,
    AttendService,
    CalendarEventProviderRegistry,
    CalendarService,
    CourseUnitsService,
    CurriculumService,
    DepartmentsService,
    FacultiesService,
    HomeService,
    IntakesService,
    LecturersService,
    OfferingsService,
    ProgrammeEnrollmentService,
    ProgrammesService,
    StudentsService,
    SessionService,
    TimetableService,
    UnitSelectionService,
  ],
})
export class AcademicModule {}
