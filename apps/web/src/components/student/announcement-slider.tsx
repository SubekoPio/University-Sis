"use client";

// Purpose: Render the accessible pinned-first announcement slider for student home.
// Used by: StudentHomePage hero.
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { StudentHomeAnnouncement } from "@/lib/student-home";

interface AnnouncementSliderProps {
  announcements: readonly StudentHomeAnnouncement[];
}

/** Displays one compact excerpt while preserving full announcement text in a dialog. */
export function AnnouncementSlider({ announcements }: AnnouncementSliderProps) {
  const sorted = [...announcements]
    .sort((left, right) => Number(right.isPinned) - Number(left.isPinned))
    .slice(0, 5);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (sorted.length < 2 || paused || reducedMotion) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % sorted.length);
    }, 6_000);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, sorted.length]);

  if (sorted.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-xl border border-card/30 bg-card/10 p-6 text-center">
        <p className="text-sm text-card/85">No announcements right now</p>
      </div>
    );
  }

  const current = sorted[index] ?? sorted[0]!;
  const excerpt = current.body
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

  function showPrevious() {
    setIndex((currentIndex) => (currentIndex - 1 + sorted.length) % sorted.length);
  }

  function showNext() {
    setIndex((currentIndex) => (currentIndex + 1) % sorted.length);
  }

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        const end = event.changedTouches[0]?.clientX;
        touchStart.current = null;
        if (start === undefined || start === null || end === undefined) return;
        if (end - start > 45) showPrevious();
        if (start - end > 45) showNext();
      }}
      className="relative min-h-48 overflow-hidden rounded-xl border border-card/30 bg-card/10 p-5"
      aria-label="Announcements"
    >
      {/* The slide content is fully text labeled and keeps image content decorative. */}
      <div className="pr-12">
        <span className="inline-flex rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-brand">
          {current.category}
        </span>
        <h2 className="mt-3 line-clamp-2 text-lg font-semibold text-card">{current.title}</h2>
        {current.imageUrl ? (
          // The API supplies a short-lived image URL; text remains available without it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.imageUrl} alt="" className="mt-3 h-20 w-full rounded-lg object-cover" />
        ) : (
          <div className="mt-3 hidden h-20 place-items-center rounded-lg border border-card/20 text-card/70 sm:grid">
            <ImageIcon aria-hidden="true" className="size-5" />
          </div>
        )}
        <p className="mt-3 line-clamp-2 text-sm leading-5 text-card/80">
          {excerpt || "Read the full announcement."}
        </p>
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          className="mt-3 rounded-md text-sm font-semibold text-card underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card"
        >
          Read more
        </button>
      </div>

      {/* Arrow controls are available alongside dots for pointer and keyboard users. */}
      <div className="absolute right-3 top-3 flex gap-1">
        <button
          type="button"
          onClick={showPrevious}
          aria-label="Previous announcement"
          className="grid size-8 place-items-center rounded-full bg-card/10 text-card hover:bg-card/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          onClick={showNext}
          aria-label="Next announcement"
          className="grid size-8 place-items-center rounded-full bg-card/10 text-card hover:bg-card/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card"
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>

      <div className="mt-4 flex justify-center gap-2" aria-label="Announcement slide position">
        {sorted.map((announcement, dotIndex) => (
          <button
            key={announcement.id}
            type="button"
            onClick={() => setIndex(dotIndex)}
            aria-label={`Show announcement ${dotIndex + 1}`}
            aria-current={dotIndex === index ? "true" : undefined}
            className={[
              "size-2 rounded-full border border-card",
              dotIndex === index ? "bg-card" : "bg-transparent",
            ].join(" ")}
          />
        ))}
      </div>

      {/* Native dialog provides focus containment and Escape dismissal. */}
      <dialog
        ref={dialogRef}
        aria-labelledby={`announcement-${current.id}`}
        className="m-auto w-[min(34rem,calc(100%-2rem))] rounded-xl border border-line bg-card p-0 text-ink backdrop:bg-ink/50"
      >
        <div className="p-6">
          <span className="inline-flex rounded-full bg-info-soft px-2.5 py-1 text-xs font-semibold text-info">
            {current.category}
          </span>
          <h2 id={`announcement-${current.id}`} className="mt-3 text-xl font-semibold">
            {current.title}
          </h2>
          {current.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.imageUrl}
              alt=""
              className="mt-4 max-h-64 w-full rounded-lg object-cover"
            />
          )}
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ink/80">
            {current.body
              .replace(/<[^>]*>/g, " ")
              .replace(/\s+/g, " ")
              .trim()}
          </p>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="mt-6 rounded-lg border border-field px-4 py-2 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Close
          </button>
        </div>
      </dialog>
    </div>
  );
}
