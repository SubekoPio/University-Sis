"use client";

// Purpose: Render selected course units and Attend or room actions.
// Used by: StudentHomePage.
import { CalendarClock, ExternalLink, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/api-client";
import type { StudentHomeCourseUnit, StudentHomeView } from "@/lib/student-home";

interface StudentCourseUnitsProps {
  home: StudentHomeView;
}

/** Renders the selected course-unit cards for the current intake. */
export function StudentCourseUnits({ home }: StudentCourseUnitsProps) {
  const [attendError, setAttendError] = useState<string | null>(null);
  const [attendingId, setAttendingId] = useState<string | null>(null);

  async function attend(unit: StudentHomeCourseUnit): Promise<void> {
    const sessionId = unit.nextSession?.sessionId;
    const studentId = home.studentId;
    if (sessionId === undefined || studentId === undefined) {
      setAttendError(
        "The Attend action is unavailable because the home response did not include the session and student identifiers.",
      );
      return;
    }

    setAttendingId(unit.offeringId);
    setAttendError(null);
    try {
      const result = await apiRequest<{ meetingUrl: string }>(`/sessions/${sessionId}/attend`, {
        method: "POST",
        body: JSON.stringify({ studentId }),
        headers: { "Content-Type": "application/json" },
      });
      window.open(result.meetingUrl, "_blank", "noopener,noreferrer");
    } catch (error: unknown) {
      setAttendError(error instanceof Error ? error.message : "The meeting could not be opened.");
    } finally {
      setAttendingId(null);
    }
  }

  if (home.courseUnits.length === 0) {
    return (
      <section
        aria-labelledby="course-units-title"
        className="rounded-xl border border-line bg-card p-5"
      >
        <h2 id="course-units-title" className="text-lg font-semibold text-ink">
          My course units
        </h2>
        <p className="mt-3 text-sm text-ink/70">No course units selected for this intake.</p>
        {home.profile.intake?.status === "SELECTION_OPEN" && (
          <Link
            href="/student/course-units"
            className="mt-4 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Select course units
          </Link>
        )}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="course-units-title"
      className="rounded-xl border border-line bg-card p-5"
    >
      <h2 id="course-units-title" className="text-lg font-semibold text-ink">
        My course units
      </h2>
      {attendError && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-error/30 bg-error-soft p-3 text-sm text-error"
        >
          {attendError}
        </p>
      )}
      <div className="mt-4 grid gap-3">
        {home.courseUnits.map((unit) => {
          const nextSession = unit.nextSession;
          const canAttend =
            home.profile.studyMode === "ONLINE" &&
            nextSession?.canAttend === true &&
            nextSession.sessionId !== undefined &&
            home.studentId !== undefined;
          return (
            <article key={unit.offeringId} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                    {unit.code}
                  </p>
                  <h3 className="mt-1 font-semibold text-ink">{unit.name}</h3>
                </div>
                {canAttend ? (
                  <button
                    type="button"
                    onClick={() => void attend(unit)}
                    disabled={attendingId === unit.offeringId}
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-card disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <ExternalLink aria-hidden="true" className="size-4" />
                    {attendingId === unit.offeringId ? "Opening…" : "Attend"}
                  </button>
                ) : home.profile.studyMode === "ONLINE" && nextSession?.canAttend === true ? (
                  <button
                    type="button"
                    onClick={() => void attend(unit)}
                    title="The home response is missing the identifiers required for Attend"
                    className="rounded-lg border border-field px-3 py-2 text-sm font-semibold text-ink/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Attend unavailable
                  </button>
                ) : null}
              </div>

              <div className="mt-3 grid gap-2 text-sm text-ink/75 sm:grid-cols-2">
                <p className="flex items-center gap-2">
                  <Users aria-hidden="true" className="size-4 text-accent" />
                  {unit.lecturers.length > 0 ? unit.lecturers.join(", ") : "Lecturer not assigned"}
                </p>
                {nextSession ? (
                  <p className="flex items-center gap-2">
                    <CalendarClock aria-hidden="true" className="size-4 text-accent" />
                    {format(new Date(nextSession.startsAt), "EEE, MMM d · h:mm a")}
                  </p>
                ) : (
                  <p className="flex items-center gap-2">
                    <CalendarClock aria-hidden="true" className="size-4 text-accent" />
                    No upcoming class
                  </p>
                )}
                {home.profile.studyMode === "PHYSICAL" && (unit.room ?? unit.nextSession?.room) ? (
                  <p className="flex items-center gap-2 sm:col-span-2">
                    <MapPin aria-hidden="true" className="size-4 text-accent" />
                    Room: {unit.room ?? unit.nextSession?.room}
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
