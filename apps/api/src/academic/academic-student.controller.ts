// Purpose: Expose student-owned prompted units, selection, timetable, attendance, announcements, calendar, and home APIs.
import { Controller, Get, Param, Post, Query, Body, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/rbac/jwt-auth.guard.js";
import { PermissionsGuard } from "../common/rbac/permissions.guard.js";
import { RolesGuard } from "../common/rbac/roles.guard.js";
import { Permissions, Roles } from "../common/rbac/rbac.decorators.js";
import { CurrentUser } from "../common/rbac/current-user.decorator.js";
import type { AuthenticatedUser } from "../common/rbac/rbac.types.js";
import { AnnouncementsService } from "./announcements.service.js";
import { AttendService } from "./attend.service.js";
import { AttendanceService } from "./attendance.service.js";
import { CalendarService } from "./calendar.service.js";
import { HomeService } from "./home.service.js";
import { TimetableService } from "./timetable.service.js";
import { UnitSelectionService } from "./unit-selection.service.js";
import {
  SessionIdParamDto,
  StudentIdParamDto,
  UnitSelectionDto,
  WeeklyScheduleQueryDto,
} from "./dto/academic.http.dto.js";

/** Student endpoints enforce own-record scope in the services and authorization guards. */
@ApiTags("Student academic")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("student")
@Controller("student")
export class AcademicStudentController {
  /**
   *
   */
  constructor(
    private readonly selectionService: UnitSelectionService,
    private readonly timetableService: TimetableService,
    private readonly attendanceService: AttendanceService,
    private readonly attendService: AttendService,
    private readonly announcementsService: AnnouncementsService,
    private readonly calendarService: CalendarService,
    private readonly homeService: HomeService,
  ) {}

  /**
   *
   */
  @Get("students/:id/intakes/:intakeId/prompted-units")
  @Permissions("academic:unit:select")
  @ApiOperation({ summary: "Get prompted course units for the authenticated student's intake" })
  promptedUnits(
    @Param() params: StudentIdParamDto,
    @Param("intakeId") intakeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.selectionService.getPromptedUnits(params.id, intakeId, user.id);
  }

  /**
   *
   */
  @Post("students/:id/intakes/:intakeId/selections")
  @Permissions("academic:unit:select")
  selectUnits(
    @Param() params: StudentIdParamDto,
    @Param("intakeId") intakeId: string,
    @Body() input: UnitSelectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.selectionService.selectUnits(params.id, intakeId, input.offeringIds, user.id);
  }

  /**
   *
   */
  @Post("students/:id/intakes/:intakeId/selections/:offeringId/drop")
  @Permissions("academic:unit:select")
  dropUnit(
    @Param() params: StudentIdParamDto,
    @Param("intakeId") intakeId: string,
    @Param("offeringId") offeringId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.selectionService.dropUnit(params.id, intakeId, offeringId, user.id);
  }

  /**
   *
   */
  @Get("students/:id/timetable")
  @Permissions("academic:session:attend")
  studentTimetable(
    @Param() params: StudentIdParamDto,
    @Query() query: WeeklyScheduleQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timetableService.getStudentWeeklySchedule(params.id, query.weekContaining, user.id);
  }

  /**
   *
   */
  @Post("sessions/:id/attend")
  @Permissions("academic:session:attend")
  @ApiOperation({
    summary: "Record the authenticated student's attendance action and obtain a join URL",
  })
  attendSession(
    @Param() params: SessionIdParamDto,
    @Body() input: StudentIdParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendService.attend(input.id, params.id, user.id);
  }

  /**
   *
   */
  @Get("students/:id/intakes/:intakeId/attendance")
  @Permissions("academic:attendance:read_own")
  attendanceSummary(
    @Param() params: StudentIdParamDto,
    @Param("intakeId") intakeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.getStudentAttendanceSummary(params.id, intakeId, user.id);
  }

  /**
   *
   */
  @Get("me/announcements")
  @Permissions("auth:profile:read_own")
  studentAnnouncements(
    @Query("limit") limit: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.announcementsService.getForUser(user.id, limit === undefined ? 5 : Number(limit));
  }

  /**
   *
   */
  @Get("me/calendar")
  @Permissions("auth:profile:read_own")
  studentCalendar(
    @Query("from") from: string,
    @Query("to") to: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.calendarService.getEvents(user.id, new Date(from), new Date(to));
  }

  /**
   *
   */
  @Get("me/home")
  @Permissions("auth:profile:read_own")
  studentHome(@CurrentUser() user: AuthenticatedUser) {
    return this.homeService.getStudentHome(user.id, user.id);
  }
}
