// Purpose: Validate student Attend actions, log clicks, and return private join links.
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeliveryMode, StudyMode } from "@prisma/client";
import type { EnvironmentConfig } from "../config/environment.config.js";
import { RbacService } from "../common/rbac/rbac.service.js";
import { validateAcademicUuid, validateMeetingUrl } from "./meeting-link.validation.js";
import { TimetableRepository } from "./timetable.repository.js";
import { MEETING_PROVIDER } from "./timetable.types.js";
import type { AttendResult, MeetingProvider } from "./timetable.types.js";

const SESSION_ATTEND_PERMISSION = "academic:session:attend";
const JOIN_WINDOW_MINUTES = 10;

/** Provides permission-checked Attend actions for students with online study mode. */
@Injectable()
export class AttendService {
  private readonly allowedMeetingHosts: string[];

  /** Receives attendance persistence, RBAC, and the configured meeting provider. */
  constructor(
    private readonly repository: TimetableRepository,
    private readonly rbac: RbacService,
    @Inject(MEETING_PROVIDER) private readonly meetingProvider: MeetingProvider,
    config: ConfigService<EnvironmentConfig, true>,
  ) {
    this.allowedMeetingHosts = config.get("MEETING_ALLOWED_HOSTS", { infer: true });
  }

  /** Records an Attend click and returns its provider-generated meeting URL. */
  async attend(studentId: string, sessionId: string, actorId: string): Promise<AttendResult> {
    const student = validateAcademicUuid(studentId, "Student ID");
    const session = validateAcademicUuid(sessionId, "Session ID");
    const actor = validateAcademicUuid(actorId, "Actor ID");
    const authorization = await this.rbac.getAuthorizationSnapshot(actor);
    if (!authorization.permissions.includes(SESSION_ATTEND_PERMISSION)) {
      throw new ForbiddenException(`The ${SESSION_ATTEND_PERMISSION} permission is required.`);
    }

    const identity = await this.repository.findStudentAttendIdentity(student);
    if (identity === null) {
      throw new NotFoundException("Active student not found.");
    }
    if (identity.userId !== actor) {
      throw new ForbiddenException("Students may attend only their own class sessions.");
    }
    if (identity.admissionRecords[0]?.studyMode !== StudyMode.ONLINE) {
      throw new ForbiddenException(
        "Attend is available only to students in online study mode. Physical-study students must attend in person.",
      );
    }

    const classSession = await this.repository.findAttendSession(session, student);
    if (classSession === null) {
      throw new NotFoundException("Class session not found.");
    }
    if (classSession.status !== "SCHEDULED") {
      throw new ConflictException("Attend is unavailable for a session that is not scheduled.");
    }
    if (classSession.offering.registrations.length === 0) {
      throw new ForbiddenException("You must have selected this offering before attending.");
    }
    if (
      !this.supportsOnlineDelivery(classSession.deliveryMode) ||
      !this.supportsOnlineDelivery(classSession.offering.deliveryMode)
    ) {
      throw new ConflictException("Attend is available only for online or hybrid offerings.");
    }
    if (classSession.meetingUrl === null || classSession.meetingUrl.trim().length === 0) {
      throw new ConflictException("This session does not have a meeting link yet.");
    }

    const now = new Date();
    const opensAt = classSession.startsAt.getTime() - JOIN_WINDOW_MINUTES * 60 * 1000;
    if (now.getTime() < opensAt || now.getTime() > classSession.endsAt.getTime()) {
      throw new ConflictException(
        "Attend is available from 10 minutes before the session starts until it ends.",
      );
    }

    const storedMeetingUrl = validateMeetingUrl(classSession.meetingUrl, this.allowedMeetingHosts);
    if (storedMeetingUrl === null) {
      throw new ConflictException("This session does not have a meeting link yet.");
    }

    const meetingUrl = await this.meetingProvider.getJoinUrl({
      sessionId: classSession.id,
      studentId: identity.id,
      storedMeetingUrl,
    });
    await this.repository.createSessionJoin(identity.id, classSession.id, now);
    return { meetingUrl };
  }

  private supportsOnlineDelivery(mode: DeliveryMode): boolean {
    return mode === DeliveryMode.ONLINE || mode === DeliveryMode.HYBRID;
  }
}
