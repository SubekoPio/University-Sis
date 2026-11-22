// Purpose: Register future feature-module calendar adapters without coupling CalendarService.
import { Injectable } from "@nestjs/common";
import type { CalendarEventProvider, CalendarEventProviderItem } from "./calendar.types.js";

/** One event annotated with the adapter that supplied it. */
export interface RegisteredCalendarEvent extends CalendarEventProviderItem {
  providerKey: string;
}

/** Holds the optional event providers contributed by feature modules. */
@Injectable()
export class CalendarEventProviderRegistry {
  private readonly providers = new Map<string, CalendarEventProvider>();

  /** Registers one provider and rejects blank or duplicate stable keys. */
  register(provider: CalendarEventProvider): void {
    const key = provider.key.trim();
    if (key.length === 0) {
      throw new Error("Calendar event providers must have a non-empty key.");
    }
    if (this.providers.has(key)) {
      throw new Error(`Calendar event provider key "${key}" is already registered.`);
    }
    this.providers.set(key, provider);
  }

  /** Collects normalized events from all registered providers. */
  async getEvents(userId: string, from: Date, to: Date): Promise<RegisteredCalendarEvent[]> {
    const providerResults = await Promise.all(
      [...this.providers.values()].map(async (provider) =>
        (await provider.getEvents(userId, from, to)).map((event) => ({
          ...event,
          providerKey: provider.key,
        })),
      ),
    );
    return providerResults.flat();
  }
}
