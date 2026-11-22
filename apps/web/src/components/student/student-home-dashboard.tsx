"use client";

// Purpose: Compose the student home dashboard and load all sections from one request.
// Used by: apps/web/src/app/student/page.tsx.
import { useQuery } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import Link from "next/link";
import { apiRequest } from "@/lib/api-client";
import type { StudentHomeView } from "@/lib/student-home";
import { AnnouncementSlider } from "@/components/student/announcement-slider";
import { StudentCalendar } from "@/components/student/student-calendar";
import { StudentCourseUnits } from "@/components/student/student-course-units";
import { AttendanceSummary } from "@/components/student/attendance-summary";
import { StatusBanner } from "@/components/ui/status-banner";
import { Button } from "@/components/ui/button";

/** Derives a time-of-day greeting for the local hour. */
function getGreeting(): "Good morning" | "Good afternoon" | "Good evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Returns initials for the profile avatar fallback. */
function getInitials(name: string | null): string {
  if (name === null || name.trim().length === 0) return "US";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Loads and renders the complete student home dashboard. */
export function StudentHomeDashboard() {
  const query = useQuery({
    queryKey: ["student-home"],
    queryFn: () => apiRequest<StudentHomeView>("/student/me/home"),
  });

  if (query.isPending) {
    return (
      <section
        aria-label="Loading student home"
        className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:px-8"
      >
        <div className="h-64 animate-pulse rounded-2xl bg-brand/20" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,.65fr)]">
          <div className="h-96 animate-pulse rounded-xl bg-line" />
          <div className="grid gap-5">
            <div className="h-40 animate-pulse rounded-xl bg-line" />
            <div className="h-64 animate-pulse rounded-xl bg-line" />
          </div>
        </div>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <StatusBanner variant="error">
          We could not load your student home. Please retry.
        </StatusBanner>
        <Button type="button" className="mt-4" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </section>
    );
  }

  const home = query.data;
  const firstName =
    home.profile.name?.trim().split(/\s+/)[0] ?? home.profile.programme?.name ?? "Student";
  const intakeLabel = home.profile.intake
    ? `${home.profile.intake.academicYearLabel} · ${home.profile.intake.name}`
    : "No active intake";

  return (
    <section
      aria-label="Student home"
      className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
    >
      {/* Desktop hero spans the full content width. */}
      <section
        aria-labelledby="student-home-greeting"
        className="grid gap-5 rounded-2xl bg-brand p-5 text-card sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]"
      >
        <div className="flex min-h-48 items-start gap-4">
          <Link
            href="/profile"
            aria-label="Open student profile"
            className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-card/60 bg-card text-xl font-bold text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card"
          >
            {home.profile.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={home.profile.photoUrl} alt="" className="size-full object-cover" />
            ) : (
              <>
                <UserRound aria-hidden="true" className="sr-only" />
                <span aria-hidden="true">{getInitials(home.profile.name)}</span>
              </>
            )}
          </Link>
          <div className="min-w-0">
            <h1
              id="student-home-greeting"
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              {getGreeting()}, {firstName}
            </h1>
            <p className="mt-2 text-sm text-card/85">
              {home.profile.programme
                ? `${home.profile.programme.code} · ${home.profile.programme.name}`
                : "Programme not assigned"}
            </p>
            <p className="mt-1 text-sm text-card/75">{intakeLabel}</p>
          </div>
        </div>
        <AnnouncementSlider announcements={home.announcements} />
      </section>

      {/* CSS grid areas preserve the requested mobile and desktop visual order. */}
      <div
        className={[
          "grid gap-5",
          "grid-cols-1",
          "lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,.65fr)]",
          "[grid-template-areas:'attendance''course''calendar']",
          "lg:[grid-template-areas:'calendar_attendance''calendar_course']",
          "lg:grid-rows-[auto_1fr]",
        ].join(" ")}
      >
        <div className="[grid-area:attendance]">
          <AttendanceSummary summary={home.attendanceSummary} />
        </div>
        <div className="[grid-area:course]">
          <StudentCourseUnits home={home} />
        </div>
        <div className="[grid-area:calendar]">
          <StudentCalendar events={home.events} />
        </div>
      </div>
    </section>
  );
}
