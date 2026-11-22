"use client";

// Purpose: Render the student month calendar and selected-day agenda.
// Used by: StudentHomePage.
import { CalendarDays, GraduationCap, Info, Landmark, Presentation, Users } from "lucide-react";
import { format, isWithinInterval, startOfDay } from "date-fns";
import { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import type { StudentHomeEvent } from "@/lib/student-home";

interface StudentCalendarProps {
  events: readonly StudentHomeEvent[];
}

const eventPresentation: Record<
  StudentHomeEvent["type"],
  { label: string; icon: typeof CalendarDays }
> = {
  ACADEMIC: { label: "Academic date", icon: GraduationCap },
  HOLIDAY: { label: "Holiday", icon: Landmark },
  EXAM: { label: "Exam", icon: GraduationCap },
  GENERAL: { label: "General", icon: Info },
  INTAKE_MILESTONE: { label: "Intake date", icon: CalendarDays },
  CLASS_SESSION: { label: "Class", icon: Presentation },
  PROVIDER: { label: "External event", icon: Users },
};

/**
 * Renders a month grid with event markers and an icon-labeled day agenda.
 *
 * @param props - Aggregated calendar events.
 * @returns The student calendar and selected-day agenda.
 */
export function StudentCalendar({ events }: StudentCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  const eventDates = useMemo(
    () =>
      events.flatMap((event) => {
        const start = startOfDay(new Date(event.startsAt));
        const end = startOfDay(new Date(event.endsAt));
        const dates: Date[] = [];
        for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
          dates.push(new Date(day));
        }
        return dates;
      }),
    [events],
  );

  const dayEvents = events.filter((event) =>
    isWithinInterval(selectedDay, {
      start: startOfDay(new Date(event.startsAt)),
      end: startOfDay(new Date(event.endsAt)),
    }),
  );

  return (
    <section aria-labelledby="student-calendar-title" className="grid gap-5">
      {/* Major calendar section keeps month selection and agenda visually separate. */}
      <h2 id="student-calendar-title" className="text-lg font-semibold text-ink">
        Calendar
      </h2>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="overflow-x-auto rounded-lg border border-line bg-card p-3">
          <DayPicker
            mode="single"
            selected={selectedDay}
            onSelect={(day) => {
              if (day !== undefined) setSelectedDay(day);
            }}
            modifiers={{ hasEvent: eventDates }}
            modifiersClassNames={{
              hasEvent:
                "relative font-semibold text-ink after:absolute after:bottom-1 after:size-1.5 after:rounded-full after:bg-accent",
            }}
            className="mx-auto"
          />
        </div>

        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-sm font-semibold text-ink">{format(selectedDay, "EEEE, MMM d")}</p>
          {dayEvents.length === 0 ? (
            <p className="mt-3 text-sm text-ink/70">No events scheduled.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {dayEvents.map((event) => {
                const presentation = eventPresentation[event.type];
                const Icon = presentation.icon;
                return (
                  <li key={event.id} className="flex gap-3 rounded-lg bg-surface p-3">
                    <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink/65">
                        {presentation.label}
                      </p>
                      <p className="mt-1 text-sm font-medium text-ink">{event.title}</p>
                      {!event.allDay && (
                        <p className="mt-1 text-xs text-ink/70">
                          {format(new Date(event.startsAt), "h:mm a")} -{" "}
                          {format(new Date(event.endsAt), "h:mm a")}
                        </p>
                      )}
                      {event.room && <p className="mt-1 text-xs text-ink/70">Room: {event.room}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
