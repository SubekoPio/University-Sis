// Purpose: Manage session meeting links, cancellation, and rescheduling.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentConfig } from "../config/environment.config.js";
import { RbacService } from "../common/rbac/rbac.service.js";
import { validateAcademicUuid, validateMeetingUrl } from "./meeting-link.validation.js";
import { TimetableRepository } from "./timetable.repository.js";
import type { ClassSessionSummary } from "./timetable.types.js";

const SESSION_MANAGE_PERMISSION = "academic:session:manage";
const OFFERING_MANAGE_PERMISSION = "academic:offering:manage";

/** Provides secure meeting-link and lifecycle operations for scheduled sessions. */
@Injectable()
export class SessionService {
  private readonly allowedMeetingHosts: string[];

  /** Receives session persistence, RBAC, and the validated meeting-host allow-list. */
  constructor(
    private readonly repository: TimetableRepository,
    private readonly rbac: RbacService,
    config: ConfigService<EnvironmentConfig, true>,
  ) {
    this.allowedMeetingHosts = config.get("MEETING_ALLOWED_HOSTS", { infer: true });
  }

  /** Sets a session's HTTPS link without returning the private URL in the result. */
  async setMeetingLink(
    sessionId: string,
    meetingUrl: string,
    actorId: string,
  ): Promise<ClassSessionSummary> {
    const session = await this.getManageableSession(sessionId, actorId);
    this.assertScheduled(session);
    const normalizedUrl = validateMeetingUrl(meetingUrl, this.allowedMeetingHosts);
    if (normalizedUrl === null) {
      throw new BadRequestException("A meeting link is required.");
    }

    const updated = await this.repository.setMeetingLink(session.id, normalizedUrl);
    if (updated === null) {
      throw new ConflictException("The session is no longer scheduled.");
    }
    return updated;
  }

  /** Cancels a scheduled session while preserving its historical record. */
  async cancel(sessionId: string, actorId: string): Promise<ClassSessionSummary> {
    const session = await this.getManageableSession(sessionId, actorId);
    this.assertScheduled(session);
    const cancelled = await this.repository.cancelSession(session.id);
    if (cancelled === null) {
      throw new ConflictException("The session is no longer scheduled.");
    }
    return cancelled;
  }

  /** Reschedules a session if its room and lecturers remain available. */
  async reschedule(
    sessionId: string,
    startsAt: Date,
    endsAt: Date,
    actorId: string,
  ): Promise<ClassSessionSummary> {
    const session = await this.getManageableSession(sessionId, actorId);
    this.assertScheduled(session);
    this.validateSessionRange(startsAt, endsAt);
    this.assertWithinIntake(session, startsAt, endsAt);

    const hasClash = await this.repository.hasSessionClash({
      offeringId: session.offeringId,
      startsAt,
      endsAt,
      room: session.room,
      lecturerIds: session.offering.lecturers.map(({ lecturerId }) => lecturerId),
      excludedSessionId: session.id,
    });
    if (hasClash) {
      throw new ConflictException("The rescheduled session conflicts with a room or lecturer.");
    }

    const updated = await this.repository.rescheduleSession(session.id, startsAt, endsAt);
    if (updated === null) {
      throw new ConflictException("The session is no longer scheduled.");
    }
    return updated;
  }

  private async getManageableSession(
    sessionId: string,
    actorId: string,
  ): Promise<NonNullable<Awaited<ReturnType<TimetableRepository["findSessionForManagement"]>>>> {
    const id = validateAcademicUuid(sessionId, "Session ID");
    const session = await this.repository.findSessionForManagement(id);
    if (session === null) {
      throw new NotFoundException("Class session not found.");
    }

    const actor = await this.getActivePermissions(actorId);
    if (!actor.permissions.includes(SESSION_MANAGE_PERMISSION)) {
      throw new ForbiddenException(`The ${SESSION_MANAGE_PERMISSION} permission is required.`);
    }
    if (
      actor.permissions.includes(OFFERING_MANAGE_PERMISSION) ||
      actor.permissions.includes("academic:structure:manage")
    ) {
      return session;
    }
    if (!(await this.repository.isLecturerAssignedToOffering(actorId, session.offeringId))) {
      throw new ForbiddenException("Lecturers may manage sessions only for assigned offerings.");
    }
    return session;
  }

  private async getActivePermissions(actorId: string) {
    const id = validateAcademicUuid(actorId, "Actor ID");
    const actor = await this.rbac.getAuthorizationSnapshot(id);
    if (actor.permissions.length === 0) {
      throw new ForbiddenException("An active account with academic permissions is required.");
    }
    return actor;
  }

  private assertScheduled(
    session: NonNullable<Awaited<ReturnType<TimetableRepository["findSessionForManagement"]>>>,
  ): void {
    if (session.status !== "SCHEDULED") {
      throw new ConflictException("Only scheduled sessions can be changed.");
    }
  }

  private validateSessionRange(startsAt: Date, endsAt: Date): void {
    if (
      !(startsAt instanceof Date) ||
      !Number.isFinite(startsAt.getTime()) ||
      !(endsAt instanceof Date) ||
      !Number.isFinite(endsAt.getTime())
    ) {
      throw new BadRequestException("Session start and end must be valid dates.");
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException("A session must end after it starts.");
    }
  }

  private assertWithinIntake(
    session: NonNullable<Awaited<ReturnType<TimetableRepository["findSessionForManagement"]>>>,
    startsAt: Date,
    endsAt: Date,
  ): void {
    const startBoundary = this.startOfUtcDay(session.offering.intake.startDate).getTime();
    const endBoundary =
      this.startOfUtcDay(session.offering.intake.endDate).getTime() + 24 * 60 * 60 * 1000;
    if (startsAt.getTime() < startBoundary || endsAt.getTime() > endBoundary) {
      throw new BadRequestException("A class session must remain within its intake dates.");
    }
  }

  private startOfUtcDay(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
}
