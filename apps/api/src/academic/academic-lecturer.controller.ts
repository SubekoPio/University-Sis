// Purpose: Expose lecturer-owned offering, session, attendance, announcement, and home operations.
import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/rbac/jwt-auth.guard.js";
import { PermissionsGuard } from "../common/rbac/permissions.guard.js";
import { RolesGuard } from "../common/rbac/roles.guard.js";
import { Permissions, Roles } from "../common/rbac/rbac.decorators.js";
import { CurrentUser } from "../common/rbac/current-user.decorator.js";
import type { AuthenticatedUser } from "../common/rbac/rbac.types.js";
import { AnnouncementsService } from "./announcements.service.js";
import { AttendanceService } from "./attendance.service.js";
import { CalendarService } from "./calendar.service.js";
import { HomeService } from "./home.service.js";
import { SessionService } from "./session.service.js";
import { TimetableService } from "./timetable.service.js";
import {
  AcademicIdParamDto,
  AttendanceCsvReportDto,
  AttendanceOverrideDto,
  CreateAnnouncementDto,
  MeetingLinkDto,
  OfferingIdParamDto,
  PhysicalAttendanceBulkDto,
  RescheduleSessionDto,
  SessionIdParamDto,
} from "./dto/academic.http.dto.js";

/** Lecturer endpoints restricted to assigned offerings and owned announcements. */
@ApiTags("Lecturer academic")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("lecturer")
@Controller("lecturer")
export class AcademicLecturerController {
  /**
   *
   */
  constructor(
    private readonly timetable: TimetableService,
    private readonly sessions: SessionService,
    private readonly attendance: AttendanceService,
    private readonly announcements: AnnouncementsService,
    private readonly calendar: CalendarService,
    private readonly home: HomeService,
  ) {}

  /**
   *
   */
  @Get("offerings/:id/timetable")
  @Permissions("academic:session:manage")
  @ApiOperation({ summary: "List timetable slots for an assigned offering" })
  listSlots(@Param() params: OfferingIdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.timetable.listSlotsForOffering(params.id, user.id);
  }

  /**
   *
   */
  @Post("offerings/:id/sessions/generate")
  @Permissions("academic:session:manage")
  @ApiOperation({ summary: "Generate class sessions for an assigned offering" })
  generateSessions(@Param() params: OfferingIdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.timetable.generateSessionsForOffering(params.id, user.id);
  }

  /**
   *
   */
  @Post("sessions/:id/meeting-link")
  @Permissions("academic:session:manage")
  setMeetingLink(
    @Param() params: SessionIdParamDto,
    @Body() input: MeetingLinkDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.setMeetingLink(params.id, input.meetingUrl, user.id);
  }

  /**
   *
   */
  @Post("sessions/:id/cancel")
  @Permissions("academic:session:manage")
  cancelSession(@Param() params: SessionIdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.cancel(params.id, user.id);
  }

  /**
   *
   */
  @Post("sessions/:id/reschedule")
  @Permissions("academic:session:manage")
  rescheduleSession(
    @Param() params: SessionIdParamDto,
    @Body() input: RescheduleSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.reschedule(params.id, input.startsAt, input.endsAt, user.id);
  }

  /**
   *
   */
  @Post("sessions/:id/attendance/report")
  @Permissions("attendance:review")
  @ApiOperation({ summary: "Import an attendance report for an assigned online session" })
  importReport(
    @Param() params: SessionIdParamDto,
    @Body() input: AttendanceCsvReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.importPresenceReport(params.id, input.csv, user.id);
  }

  /**
   *
   */
  @Post("sessions/:id/attendance/physical")
  @Permissions("academic:attendance:record_assigned")
  markPhysicalAttendance(
    @Param() params: SessionIdParamDto,
    @Body() input: PhysicalAttendanceBulkDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.markPhysicalAttendanceBulk(params.id, input.marks, user.id);
  }

  /**
   *
   */
  @Post("sessions/:id/attendance/override")
  @Permissions("attendance:override")
  overrideAttendance(
    @Param() params: SessionIdParamDto,
    @Body() input: AttendanceOverrideDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.overrideAttendance(
      params.id,
      input.studentId,
      input.status,
      input.reason,
      user.id,
    );
  }

  /**
   *
   */
  @Post("announcements")
  @Permissions("announcements:post-own")
  createAnnouncement(@Body() input: CreateAnnouncementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.announcements.create(input, user.id);
  }

  /**
   *
   */
  @Post("announcements/:id/publish")
  @Permissions("announcements:post-own")
  publishAnnouncement(@Param() params: AcademicIdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.announcements.publish(params.id, user.id);
  }

  /**
   *
   */
  @Post("announcements/:id/archive")
  @Permissions("announcements:post-own")
  archiveAnnouncement(@Param() params: AcademicIdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.announcements.archive(params.id, user.id);
  }

  /**
   *
   */
  @Get("me/home")
  @Permissions("auth:profile:read_own")
  lecturerHome(@CurrentUser() user: AuthenticatedUser) {
    return this.home.getLecturerHome(user.id, user.id);
  }

  /**
   *
   */
  @Get("me/calendar")
  @Permissions("academic:catalog:read")
  lecturerCalendar(
    @Query("from") from: string,
    @Query("to") to: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.calendar.getEvents(user.id, new Date(from), new Date(to));
  }
}
