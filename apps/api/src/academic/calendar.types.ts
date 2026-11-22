// Purpose: Define merged calendar items and the provider extension contract.
import type { CalendarEventType, DeliveryMode } from "@prisma/client";

/** Source bucket for one event returned from the aggregated calendar. */
export type CalendarEventSource = "AUTHORED" | "INTAKE" | "CLASS_SESSION" | "PROVIDER";

/** One event returned by CalendarService; meeting URLs are intentionally absent. */
export interface CalendarEventItem {
  id: string;
  title: string;
  description: string;
  type: CalendarEventType | "INTAKE_MILESTONE" | "CLASS_SESSION" | "PROVIDER";
  source: CalendarEventSource;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  offeringId?: string;
  deliveryMode?: DeliveryMode;
  room?: string | null;
  providerKey?: string;
  category?: string;
}

/** One normalized event supplied by a future assignment or exam provider. */
export interface CalendarEventProviderItem {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  category?: string;
}

/** Adapter contract for appending events from a feature module to user calendars. */
export interface CalendarEventProvider {
  /** Stable unique key used to identify events supplied by this provider. */
  readonly key: string;

  /** Returns provider events for one user and bounded date range. */
  getEvents(userId: string, from: Date, to: Date): Promise<CalendarEventProviderItem[]>;
}
