"use client";

// Purpose: Render overall and per-course-unit attendance percentages.
// Used by: StudentHomePage.
import { CircleAlert, TrendingDown } from "lucide-react";
import type { StudentHomeView } from "@/lib/student-home";

interface AttendanceSummaryProps {
  summary: StudentHomeView["attendanceSummary"];
}

/** Renders a reserved teal attendance badge or an explicit warning state. */
export function AttendanceSummary({ summary }: AttendanceSummaryProps) {
  if (summary === null) {
    return (
      <section
        aria-labelledby="attendance-title"
        className="rounded-xl border border-line bg-card p-5"
      >
        <h2 id="attendance-title" className="text-lg font-semibold text-ink">
          Attendance
        </h2>
        <p className="mt-3 text-sm text-ink/70">No sessions yet</p>
      </section>
    );
  }

  const overall = summary.overall.percentage;
  const belowMinimum = summary.overall.belowMinimum;
  const percentageLabel = overall === null ? "No sessions yet" : `${overall}%`;

  return (
    <section
      aria-labelledby="attendance-title"
      className="rounded-xl border border-line bg-card p-5"
    >
      <h2 id="attendance-title" className="text-lg font-semibold text-ink">
        Attendance
      </h2>
      {belowMinimum ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-warning-soft px-3 py-2 text-warning">
          <TrendingDown aria-hidden="true" className="size-4" />
          <span className="font-bold">{percentageLabel}</span>
          <span className="flex items-center gap-1 text-sm font-semibold">
            <CircleAlert aria-hidden="true" className="size-4" />
            Below minimum
          </span>
        </div>
      ) : (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-badge px-3 py-2 text-card">
          <span className="font-bold">{percentageLabel}</span>
        </div>
      )}

      {summary.offerings.length === 0 ? (
        <p className="mt-4 text-sm text-ink/70">No sessions yet</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {summary.offerings.map((offering) => (
            <li
              key={offering.offeringId}
              className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-accent">{offering.courseUnitCode}</p>
                <p className="truncate text-sm text-ink/75">{offering.courseUnitName}</p>
              </div>
              {offering.percentage === null ? (
                <span className="text-sm text-ink/70">No sessions yet</span>
              ) : offering.belowMinimum ? (
                <span className="flex items-center gap-1 rounded-full bg-warning-soft px-2 py-1 text-xs font-semibold text-warning">
                  <CircleAlert aria-hidden="true" className="size-3" />
                  {offering.percentage}% · Below minimum
                </span>
              ) : (
                <span className="rounded-full bg-badge px-2 py-1 text-xs font-semibold text-card">
                  {offering.percentage}%
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
