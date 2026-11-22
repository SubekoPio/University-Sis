// Purpose: Merge audience-filtered calendar events, intake milestones, and sessions.
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { isUUID } from "class-validator";
import { RbacService } from "../common/rbac/rbac.service.js";
import { CommunicationsRepository } from "./communications.repository.js";
import { matchesAudience } from "./communications.types.js";
import type { CalendarEventItem } from "./calendar.types.js";
import {
  CalendarEventProviderRegistry,
  type RegisteredCalendarEvent,
} from "./calendar-event-provider.registry.js";

const CALENDAR_MANAGE_PERMISSION = "calendar:event:manage";
const MAX_RANGE_MILLISECONDS = 62 * 24 * 60 * 60 * 1000;

/** Merges authored events, academic milestones, class sessions, and registered providers. */
@Injectable()
export class CalendarService {
  /** Receives calendar persistence, provider registry, and authorization services. */
  constructor(
    private readonly repository: CommunicationsRepository,
    private readonly providers: CalendarEventProviderRegistry,
    private readonly rbac: RbacService,
  ) {}

  /** Returns a user's calendar events in a range no longer than 62 days. */
  async getEvents(userId: string, from: Date, to: Date): Promise<CalendarEventItem[]> {
    const user = this.validateUuid(userId, "User ID");
    this.validateRange(from, to);
    const [context, authorization] = await Promise.all([
      this.repository.findAudienceContext(user),
      this.rbac.getAuthorizationSnapshot(user),
    ]);
    if (context === null) {
      throw new NotFoundException("Active user not found.");
    }

    const intakeIds = [
      ...(context.student?.intakeIds ?? []),
      ...(context.lecturer?.intakeIds ?? []),
    ];
    const offeringIds = [
      ...(context.student?.offeringIds ?? []),
      ...(context.lecturer?.offeringIds ?? []),
    ];
    const includeAllIntakes = authorization.permissions.includes(CALENDAR_MANAGE_PERMISSION);
    const [authoredEvents, intakeSources, sessions, providerEvents] = await Promise.all([
      this.repository.findCalendarEvents(from, to),
      this.repository.findIntakeCalendarSources(intakeIds, includeAllIntakes, from, to),
      this.repository.findCalendarSessions(offeringIds, from, to),
      this.providers.getEvents(user, from, to),
    ]);

    const result: CalendarEventItem[] = authoredEvents
      .filter(
        ({ audiences }) =>
          // An empty selector list denotes an institution-wide calendar event.
          audiences.length === 0 ||
          audiences.some((audience) => matchesAudience(audience, context)),
      )
      .map((event) => ({
        id: `calendar:${event.id}`,
        title: event.title,
        description: event.description,
        type: event.type,
        source: "AUTHORED",
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        allDay: event.allDay,
      }));

    for (const intake of intakeSources) {
      const milestones = [
        this.milestone(
          intake.id,
          "selection-opens",
          `${intake.name} course-unit selection opens`,
          intake.selectionOpensAt,
          intake.academicYear.label,
          from,
          to,
          false,
        ),
        this.milestone(
          intake.id,
          "selection-closes",
          `${intake.name} course-unit selection closes`,
          intake.selectionClosesAt,
          intake.academicYear.label,
          from,
          to,
          false,
        ),
        this.milestone(
          intake.id,
          "starts",
          `${intake.name} begins`,
          intake.startDate,
          intake.academicYear.label,
          from,
          to,
          true,
        ),
        this.milestone(
          intake.id,
          "ends",
          `${intake.name} ends`,
          intake.endDate,
          intake.academicYear.label,
          from,
          to,
          true,
        ),
      ].filter((event): event is CalendarEventItem => event !== null);
      result.push(...milestones);
    }

    result.push(
      ...sessions.map((session) => ({
        id: `session:${session.id}`,
        title: `${session.offering.courseUnit.code} - ${session.offering.courseUnit.name}`,
        description: session.room === null ? "" : `Room: ${session.room}`,
        type: "CLASS_SESSION" as const,
        source: "CLASS_SESSION" as const,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        allDay: false,
        offeringId: session.offering.id,
        deliveryMode: session.deliveryMode,
        room: session.room,
      })),
    );

    for (const providerEvent of providerEvents) {
      if (!this.isValidProviderEvent(providerEvent, from, to)) {
        throw new Error("A calendar event provider returned an invalid or out-of-range event.");
      }
      result.push({
        id: `provider:${providerEvent.providerKey}:${providerEvent.id}`,
        title: providerEvent.title,
        description: providerEvent.description,
        type: "PROVIDER",
        source: "PROVIDER",
        startsAt: providerEvent.startsAt,
        endsAt: providerEvent.endsAt,
        allDay: providerEvent.allDay,
        providerKey: providerEvent.providerKey,
        ...(providerEvent.category === undefined ? {} : { category: providerEvent.category }),
      });
    }

    return result.sort(
      (left, right) =>
        left.startsAt.getTime() - right.startsAt.getTime() || left.id.localeCompare(right.id),
    );
  }

  private validateRange(from: Date, to: Date): void {
    if (
      !(from instanceof Date) ||
      !Number.isFinite(from.getTime()) ||
      !(to instanceof Date) ||
      !Number.isFinite(to.getTime())
    ) {
      throw new BadRequestException("Calendar range bounds must be valid dates.");
    }
    if (to.getTime() < from.getTime()) {
      throw new BadRequestException("Calendar range end must not be before its start.");
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_MILLISECONDS) {
      throw new BadRequestException("Calendar ranges may not exceed 62 days.");
    }
  }

  private validateUuid(value: string, label: string): string {
    if (typeof value !== "string" || !isUUID(value)) {
      throw new BadRequestException(`${label} must be a valid UUID.`);
    }
    return value;
  }

  private milestone(
    intakeId: string,
    name: string,
    title: string,
    date: Date,
    academicYearLabel: string,
    from: Date,
    to: Date,
    allDay: boolean,
  ): CalendarEventItem | null {
    if (date.getTime() < from.getTime() || date.getTime() > to.getTime()) {
      return null;
    }
    return {
      id: `intake:${intakeId}:${name}`,
      title,
      description: `Academic year ${academicYearLabel}.`,
      type: "INTAKE_MILESTONE",
      source: "INTAKE",
      startsAt: date,
      endsAt: date,
      allDay,
    };
  }

  private isValidProviderEvent(event: RegisteredCalendarEvent, from: Date, to: Date): boolean {
    return (
      event.id.trim().length > 0 &&
      event.title.trim().length > 0 &&
      event.description.trim().length > 0 &&
      event.providerKey.trim().length > 0 &&
      event.startsAt instanceof Date &&
      event.endsAt instanceof Date &&
      Number.isFinite(event.startsAt.getTime()) &&
      Number.isFinite(event.endsAt.getTime()) &&
      event.endsAt.getTime() >= event.startsAt.getTime() &&
      event.startsAt.getTime() <= to.getTime() &&
      event.endsAt.getTime() >= from.getTime()
    );
  }
}
