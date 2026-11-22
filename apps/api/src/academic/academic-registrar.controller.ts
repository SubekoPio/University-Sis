// Purpose: Expose registrar-owned academic structure, curriculum, offering, session, and communication APIs.
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/rbac/jwt-auth.guard.js";
import { PermissionsGuard } from "../common/rbac/permissions.guard.js";
import { RolesGuard } from "../common/rbac/roles.guard.js";
import { Permissions, Roles } from "../common/rbac/rbac.decorators.js";
import { CurrentUser } from "../common/rbac/current-user.decorator.js";
import type { AuthenticatedUser } from "../common/rbac/rbac.types.js";
import { PaginationDto } from "../common/dto/pagination.dto.js";
import { AcademicYearsService } from "./academic-years.service.js";
import { AnnouncementsService } from "./announcements.service.js";
import { CalendarService } from "./calendar.service.js";
import { CourseUnitsService } from "./course-units.service.js";
import { CurriculumService } from "./curriculum.service.js";
import { DepartmentsService } from "./departments.service.js";
import { FacultiesService } from "./faculties.service.js";
import { HomeService } from "./home.service.js";
import { IntakesService } from "./intakes.service.js";
import { LecturersService } from "./lecturers.service.js";
import { OfferingsService } from "./offerings.service.js";
import { ProgrammesService } from "./programmes.service.js";
import { SessionService } from "./session.service.js";
import { StudentsService } from "./students.service.js";
import { TimetableService } from "./timetable.service.js";
import {
  AcademicIdParamDto,
  AssignLecturerDto,
  BulkOfferingDto,
  CreateAcademicYearDto,
  CreateAnnouncementDto,
  CreateCourseUnitDto,
  CreateDepartmentDto,
  CreateFacultyDto,
  CreateLecturerDto,
  CreateOfferingDto,
  CreateProgrammeDto,
  CurriculumPlacementListDto,
  ElectiveRuleListDto,
  GeneralEligibilityDto,
  MeetingLinkDto,
  OfferingCapacityDto,
  PrerequisiteListDto,
  RescheduleSessionDto,
  TimetableSlotDto,
  TransitionIntakeDto,
  UpdateAcademicYearDto,
  UpdateAnnouncementDto,
  UpdateCourseUnitDto,
  UpdateDepartmentDto,
  UpdateFacultyDto,
  UpdateIntakeDto,
  UpdateLecturerDto,
  UpdateProgrammeDto,
  UpdateStudentDto,
  CourseUnitIdParamDto,
  OfferingIdParamDto,
  SessionIdParamDto,
  StudentIdParamDto,
} from "./dto/academic.http.dto.js";

/** Registrar endpoints for academic catalogue and institutional operations. */
@ApiTags("Academic")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("registrar")
@Controller("academic")
export class AcademicRegistrarController {
  /**
   *
   */
  constructor(
    private readonly faculties: FacultiesService,
    private readonly departments: DepartmentsService,
    private readonly programmes: ProgrammesService,
    private readonly academicYears: AcademicYearsService,
    private readonly intakes: IntakesService,
    private readonly courseUnits: CourseUnitsService,
    private readonly curriculum: CurriculumService,
    private readonly offerings: OfferingsService,
    private readonly lecturers: LecturersService,
    private readonly students: StudentsService,
    private readonly timetable: TimetableService,
    private readonly sessions: SessionService,
    private readonly announcements: AnnouncementsService,
    private readonly calendarService: CalendarService,
    private readonly home: HomeService,
  ) {}

  /**
   *
   */
  @Get("faculties") @Permissions("academic:structure:manage") listFaculties() {
    return this.faculties.listFaculties();
  }
  /**
   *
   */
  @Post("faculties") @Permissions("academic:structure:manage") createFaculty(
    @Body() input: CreateFacultyDto,
  ) {
    return this.faculties.createFaculty(input);
  }
  /**
   *
   */
  @Get("faculties/:id") @Permissions("academic:structure:manage") getFaculty(
    @Param() params: AcademicIdParamDto,
  ) {
    return this.faculties.getFaculty(params.id);
  }
  /**
   *
   */
  @Patch("faculties/:id") @Permissions("academic:structure:manage") updateFaculty(
    @Param() params: AcademicIdParamDto,
    @Body() input: UpdateFacultyDto,
  ) {
    return this.faculties.updateFaculty(params.id, input);
  }
  /**
   *
   */
  @Delete("faculties/:id") @Permissions("academic:structure:manage") deleteFaculty(
    @Param() params: AcademicIdParamDto,
  ) {
    return this.faculties.deleteFaculty(params.id);
  }

  /**
   *
   */
  @Get("departments") @Permissions("academic:structure:manage") listDepartments() {
    return this.departments.listDepartments();
  }
  /**
   *
   */
  @Post("departments") @Permissions("academic:structure:manage") createDepartment(
    @Body() input: CreateDepartmentDto,
  ) {
    return this.departments.createDepartment(input);
  }
  /**
   *
   */
  @Get("departments/:id") @Permissions("academic:structure:manage") getDepartment(
    @Param() params: AcademicIdParamDto,
  ) {
    return this.departments.getDepartment(params.id);
  }
  /**
   *
   */
  @Patch("departments/:id") @Permissions("academic:structure:manage") updateDepartment(
    @Param() params: AcademicIdParamDto,
    @Body() input: UpdateDepartmentDto,
  ) {
    return this.departments.updateDepartment(params.id, input);
  }
  /**
   *
   */
  @Delete("departments/:id") @Permissions("academic:structure:manage") deleteDepartment(
    @Param() params: AcademicIdParamDto,
  ) {
    return this.departments.deleteDepartment(params.id);
  }

  /**
   *
   */
  @Get("programmes") @Permissions("academic:structure:manage") listProgrammes() {
    return this.programmes.listProgrammes();
  }
  /**
   *
   */
  @Post("programmes") @Permissions("academic:structure:manage") createProgramme(
    @Body() input: CreateProgrammeDto,
  ) {
    return this.programmes.createProgramme(input);
  }
  /**
   *
   */
  @Get("programmes/:id") @Permissions("academic:structure:manage") getProgramme(
    @Param() params: AcademicIdParamDto,
  ) {
    return this.programmes.getProgramme(params.id);
  }
  /**
   *
   */
  @Patch("programmes/:id") @Permissions("academic:structure:manage") updateProgramme(
    @Param() params: AcademicIdParamDto,
    @Body() input: UpdateProgrammeDto,
  ) {
    return this.programmes.updateProgramme(params.id, input);
  }
  /**
   *
   */
  @Delete("programmes/:id") @Permissions("academic:structure:manage") deleteProgramme(
    @Param() params: AcademicIdParamDto,
  ) {
    return this.programmes.deleteProgramme(params.id);
  }

  /**
   *
   */
  @Get("years") @Permissions("academic:structure:manage") listAcademicYears() {
    return this.academicYears.listAcademicYears();
  }
  /**
   *
   */
  @Post("years") @Permissions("academic:structure:manage") createAcademicYear(
    @Body() input: CreateAcademicYearDto,
  ) {
    return this.academicYears.createAcademicYear(input);
  }
  /**
   *
   */
  @Get("years/:id") @Permissions("academic:structure:manage") getAcademicYear(
    @Param() params: AcademicIdParamDto,
  ) {
    return this.academicYears.getAcademicYear(params.id);
  }
  /**
   *
   */
  @Patch("years/:id") @Permissions("academic:structure:manage") updateAcademicYear(
    @Param() params: AcademicIdParamDto,
    @Body() input: UpdateAcademicYearDto,
  ) {
    return this.academicYears.updateAcademicYear(params.id, input);
  }
  /**
   *
   */
  @Delete("years/:id") @Permissions("academic:structure:manage") deleteAcademicYear(
    @Param() params: AcademicIdParamDto,
  ) {
    return this.academicYears.deleteAcademicYear(params.id);
  }

  /**
   *
   */
  @Get("years/:id/intakes") @Permissions("academic:structure:manage") listIntakes(
    @Param() params: AcademicIdParamDto,
  ) {
    return this.intakes.listIntakes(params.id);
  }
  /**
   *
   */
  @Get("intakes/:id") @Permissions("academic:structure:manage") getIntake(
    @Param() params: AcademicIdParamDto,
  ) {
    return this.intakes.getIntake(params.id);
  }
  /**
   *
   */
  @Patch("intakes/:id") @Permissions("academic:structure:manage") updateIntake(
    @Param() params: AcademicIdParamDto,
    @Body() input: UpdateIntakeDto,
  ) {
    return this.intakes.updateIntake(params.id, input);
  }
  /**
   *
   */
  @Post("intakes/:id/status") @Permissions("academic:structure:manage") transitionIntake(
    @Param() params: AcademicIdParamDto,
    @Body() input: TransitionIntakeDto,
  ) {
    return this.intakes.transitionIntakeStatus(params.id, input.status);
  }
  /**
   *
   */
  @Delete("intakes/:id") @Permissions("academic:structure:manage") deleteIntake(
    @Param() params: AcademicIdParamDto,
  ) {
    return this.intakes.deleteIntake(params.id);
  }

  /**
   *
   */
  @Get("course-units") @Permissions("academic:curriculum:manage") listCourseUnits() {
    return this.courseUnits.listCourseUnits();
  }
  /**
   *
   */
  @Post("course-units") @Permissions("academic:curriculum:manage") createCourseUnit(
    @Body() input: CreateCourseUnitDto,
  ) {
    return this.courseUnits.createCourseUnit(input);
  }
  /**
   *
   */
  @Get("course-units/:id") @Permissions("academic:curriculum:manage") getCourseUnit(
    @Param() params: CourseUnitIdParamDto,
  ) {
    return this.courseUnits.getCourseUnit(params.id);
  }
  /**
   *
   */
  @Patch("course-units/:id") @Permissions("academic:curriculum:manage") updateCourseUnit(
    @Param() params: CourseUnitIdParamDto,
    @Body() input: UpdateCourseUnitDto,
  ) {
    return this.courseUnits.updateCourseUnit(params.id, input);
  }
  /**
   *
   */
  @Post("course-units/:id/general-eligibility")
  @Permissions("academic:curriculum:manage")
  configureGeneralEligibility(
    @Param() params: CourseUnitIdParamDto,
    @Body() input: GeneralEligibilityDto,
  ) {
    return this.courseUnits.configureGeneralEligibility(params.id, input);
  }
  /**
   *
   */
  @Delete("course-units/:id") @Permissions("academic:curriculum:manage") deleteCourseUnit(
    @Param() params: CourseUnitIdParamDto,
  ) {
    return this.courseUnits.deleteCourseUnit(params.id);
  }

  /**
   *
   */
  @Get("programmes/:id/curriculum/:studyYear/:intakeSlot")
  @Permissions("academic:curriculum:manage")
  listCurriculum(
    @Param("id") programmeId: string,
    @Param("studyYear") studyYear: string,
    @Param("intakeSlot") intakeSlot: string,
  ) {
    return this.curriculum.listCourseUnits(programmeId, Number(studyYear), Number(intakeSlot));
  }
  /**
   *
   */
  @Post("programmes/:id/curriculum/:studyYear/:intakeSlot")
  @Permissions("academic:curriculum:manage")
  setCurriculum(
    @Param("id") programmeId: string,
    @Param("studyYear") studyYear: string,
    @Param("intakeSlot") intakeSlot: string,
    @Body() input: CurriculumPlacementListDto,
  ) {
    return this.curriculum.setCourseUnits(
      programmeId,
      Number(studyYear),
      Number(intakeSlot),
      input.placements,
    );
  }
  /**
   *
   */
  @Get("programmes/:id/curriculum/:studyYear/:intakeSlot/electives")
  @Permissions("academic:curriculum:manage")
  listElectiveRules(
    @Param("id") programmeId: string,
    @Param("studyYear") studyYear: string,
    @Param("intakeSlot") intakeSlot: string,
  ) {
    return this.curriculum.listElectiveRules(programmeId, Number(studyYear), Number(intakeSlot));
  }
  /**
   *
   */
  @Post("programmes/:id/curriculum/:studyYear/:intakeSlot/electives")
  @Permissions("academic:curriculum:manage")
  setElectiveRules(
    @Param("id") programmeId: string,
    @Param("studyYear") studyYear: string,
    @Param("intakeSlot") intakeSlot: string,
    @Body() input: ElectiveRuleListDto,
  ) {
    return this.curriculum.setElectiveRules(
      programmeId,
      Number(studyYear),
      Number(intakeSlot),
      input.rules,
    );
  }
  /**
   *
   */
  @Get("course-units/:id/prerequisites")
  @Permissions("academic:curriculum:manage")
  listPrerequisites(@Param() params: CourseUnitIdParamDto) {
    return this.curriculum.listPrerequisites(params.id);
  }
  /**
   *
   */
  @Post("course-units/:id/prerequisites")
  @Permissions("academic:curriculum:manage")
  setPrerequisites(@Param() params: CourseUnitIdParamDto, @Body() input: PrerequisiteListDto) {
    return this.curriculum.setPrerequisites(params.id, input.prerequisiteIds);
  }

  /**
   *
   */
  @Get("offerings") @Permissions("academic:offering:manage") listOfferings(
    @Query("intakeId") intakeId: string,
  ) {
    return this.offerings.listOfferings(intakeId);
  }
  /**
   *
   */
  @Post("offerings") @Permissions("academic:offering:manage") createOffering(
    @Body() input: CreateOfferingDto,
  ) {
    return this.offerings.createOffering(input);
  }
  /**
   *
   */
  @Post("offerings/bulk") @Permissions("academic:offering:manage") bulkOfferings(
    @Query("intakeId") intakeId: string,
    @Body() input: BulkOfferingDto,
  ) {
    return this.offerings.bulkCreateFromCurriculum(intakeId, input);
  }
  /**
   *
   */
  @Post("offerings/copy") @Permissions("academic:offering:manage") copyOfferings(
    @Query("intakeId") intakeId: string,
  ) {
    return this.offerings.copyFromPreviousIntake(intakeId);
  }
  /**
   *
   */
  @Patch("offerings/:id/capacity") @Permissions("academic:offering:manage") setOfferingCapacity(
    @Param() params: OfferingIdParamDto,
    @Body() input: OfferingCapacityDto,
  ) {
    return this.offerings.setCapacity(params.id, input.capacity);
  }
  /**
   *
   */
  @Post("offerings/:id/lecturers") @Permissions("academic:offering:assign-lecturer") assignLecturer(
    @Param() params: OfferingIdParamDto,
    @Body() input: AssignLecturerDto,
  ) {
    return this.offerings.assignLecturer(params.id, input);
  }
  /**
   *
   */
  @Delete("offerings/:id/lecturers/:lecturerId")
  @Permissions("academic:offering:assign-lecturer")
  removeLecturer(@Param() params: OfferingIdParamDto, @Param("lecturerId") lecturerId: string) {
    return this.offerings.removeLecturer(params.id, lecturerId);
  }

  /**
   *
   */
  @Get("lecturers") @Permissions("academic:structure:manage") listLecturers(
    @Query("departmentId") departmentId: string | undefined,
    @Query("search") search: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lecturers.listLecturers({ departmentId, search }, user.id);
  }
  /**
   *
   */
  @Post("lecturers") @Permissions("academic:structure:manage") createLecturer(
    @Body() input: CreateLecturerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lecturers.createLecturer(input, user.id);
  }
  /**
   *
   */
  @Get("lecturers/:id") @Permissions("academic:structure:manage") getLecturer(
    @Param() params: AcademicIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lecturers.getLecturer(params.id, user.id);
  }
  /**
   *
   */
  @Patch("lecturers/:id") @Permissions("academic:structure:manage") updateLecturer(
    @Param() params: AcademicIdParamDto,
    @Body() input: UpdateLecturerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lecturers.updateLecturer(params.id, input, user.id);
  }

  /**
   *
   */
  @Get("students") @Permissions("sis:student:read") listStudents(
    @Query() query: PaginationDto & { search?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.students.listStudents(
      { search: query.search, page: query.page, pageSize: query.pageSize },
      user.id,
    );
  }
  /**
   *
   */
  @Get("students/:id") @Permissions("sis:student:read") getStudent(
    @Param() params: StudentIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.students.getStudent(params.id, user.id);
  }
  /**
   *
   */
  @Patch("students/:id") @Permissions("sis:student:update") updateStudent(
    @Param() params: StudentIdParamDto,
    @Body() input: UpdateStudentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.students.updateStudent(params.id, input, user.id);
  }
  /**
   *
   */
  @Post("students/:id/archive") @Permissions("sis:student:archive") archiveStudent(
    @Param() params: StudentIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.students.archiveStudent(params.id, user.id);
  }

  /**
   *
   */
  @Get("offerings/:id/timetable") @Permissions("academic:timetable:manage") listSlots(
    @Param() params: OfferingIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timetable.listSlotsForOffering(params.id, user.id);
  }
  /**
   *
   */
  @Post("timetable") @Permissions("academic:timetable:manage") createSlot(
    @Body() input: TimetableSlotDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timetable.createSlot(input, user.id);
  }
  /**
   *
   */
  @Post("intakes/:id/sessions/generate")
  @Permissions("academic:session:manage")
  generateIntakeSessions(
    @Param() params: AcademicIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timetable.generateSessionsForIntake(params.id, user.id);
  }
  /**
   *
   */
  @Post("offerings/:id/sessions/generate")
  @Permissions("academic:session:manage")
  generateOfferingSessions(
    @Param() params: OfferingIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timetable.generateSessionsForOffering(params.id, user.id);
  }
  /**
   *
   */
  @Post("sessions/:id/meeting-link") @Permissions("academic:session:manage") setMeetingLink(
    @Param() params: SessionIdParamDto,
    @Body() input: MeetingLinkDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.setMeetingLink(params.id, input.meetingUrl, user.id);
  }
  /**
   *
   */
  @Post("sessions/:id/cancel") @Permissions("academic:session:manage") cancelSession(
    @Param() params: SessionIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.cancel(params.id, user.id);
  }
  /**
   *
   */
  @Post("sessions/:id/reschedule") @Permissions("academic:session:manage") rescheduleSession(
    @Param() params: SessionIdParamDto,
    @Body() input: RescheduleSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.reschedule(params.id, input.startsAt, input.endsAt, user.id);
  }

  /**
   *
   */
  @Post("announcements") @Permissions("announcements:manage") createAnnouncement(
    @Body() input: CreateAnnouncementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.announcements.create(input, user.id);
  }
  /**
   *
   */
  @Patch("announcements/:id") @Permissions("announcements:manage") updateAnnouncement(
    @Param() params: AcademicIdParamDto,
    @Body() input: UpdateAnnouncementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.announcements.update(params.id, input, user.id);
  }
  /**
   *
   */
  @Post("announcements/:id/publish") @Permissions("announcements:manage") publishAnnouncement(
    @Param() params: AcademicIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.announcements.publish(params.id, user.id);
  }
  /**
   *
   */
  @Post("announcements/:id/archive") @Permissions("announcements:manage") archiveAnnouncement(
    @Param() params: AcademicIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.announcements.archive(params.id, user.id);
  }

  /**
   *
   */
  @Get("me/home") @Permissions("auth:profile:read_own") registrarHome(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.home.getRegistrarHome(user.id, user.id);
  }
  /**
   *
   */
  @Get("me/calendar") @Permissions("calendar:event:manage") registrarCalendar(
    @Query("from") from: string,
    @Query("to") to: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.calendarService.getEvents(user.id, new Date(from), new Date(to));
  }
}
