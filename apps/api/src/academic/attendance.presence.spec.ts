// Purpose: Test clipping, reconnect merging, and longest-continuous attendance thresholds.
import { AttendanceStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  computeContinuousPresence,
  type ContinuousPresenceRule,
  type PresenceIntervalInput,
} from "./attendance.presence.js";

const SESSION_START = new Date("2026-11-22T09:00:00.000Z");
const SESSION_END = new Date("2026-11-22T11:00:00.000Z");
const SESSION = { startsAt: SESSION_START, endsAt: SESSION_END };
const RULE: ContinuousPresenceRule = {
  minContinuousPercent: 75,
  reconnectGraceSeconds: 180,
};

function interval(startMinutes: number, endMinutes: number): PresenceIntervalInput {
  return {
    joinedAt: new Date(SESSION_START.getTime() + startMinutes * 60_000),
    leftAt: new Date(SESSION_START.getTime() + endMinutes * 60_000),
  };
}

describe("computeContinuousPresence", () => {
  it("marks one uninterrupted stay present at the exact minimum percentage", () => {
    // Arrange: the student remains for exactly 75% of the two-hour session.
    const intervals = [interval(15, 105)];

    // Act: compute the student's longest continuous presence.
    const result = computeContinuousPresence(intervals, SESSION, RULE);

    // Assert: the threshold is inclusive and both durations use whole seconds.
    expect(result).toEqual({
      status: AttendanceStatus.PRESENT,
      longestContinuousSeconds: 90 * 60,
      totalSeconds: 90 * 60,
    });
  });

  it("does not add separate short visits even when their total exceeds the threshold", () => {
    // Arrange: two 55-minute visits total 110 minutes but are separated beyond grace.
    const intervals = [interval(0, 55), interval(65, 120)];

    // Act: calculate attendance.
    const result = computeContinuousPresence(intervals, SESSION, RULE);

    // Assert: only the longest 55-minute visit is compared with the 90-minute threshold.
    expect(result.status).toBe(AttendanceStatus.ABSENT);
    expect(result.longestContinuousSeconds).toBe(55 * 60);
    expect(result.totalSeconds).toBe(110 * 60);
  });

  it("merges visits separated by exactly the reconnect grace", () => {
    // Arrange: the visits have a three-minute gap matching the configured grace.
    const intervals = [interval(0, 42), interval(45, 90)];

    // Act: compute the merged continuous stay.
    const result = computeContinuousPresence(intervals, SESSION, RULE);

    // Assert: the grace gap joins the visits, but is not counted as actual presence.
    expect(result.status).toBe(AttendanceStatus.PRESENT);
    expect(result.longestContinuousSeconds).toBe(90 * 60);
    expect(result.totalSeconds).toBe(87 * 60);
  });

  it("does not merge visits when their gap is one millisecond over grace", () => {
    // Arrange: the second visit begins 180 seconds and one millisecond after the first.
    const intervals = [
      interval(0, 44),
      {
        joinedAt: new Date(SESSION_START.getTime() + 44 * 60_000 + 180_001),
        leftAt: new Date(SESSION_START.getTime() + 90 * 60_000),
      },
    ];

    // Act: compute attendance at millisecond precision.
    const result = computeContinuousPresence(intervals, SESSION, RULE);

    // Assert: being just outside the grace leaves the student absent.
    expect(result.status).toBe(AttendanceStatus.ABSENT);
    expect(result.longestContinuousSeconds).toBe(44 * 60);
  });

  it("clips intervals to the session before calculating either duration", () => {
    // Arrange: presence begins before the session and leaves after it.
    const intervals = [
      {
        joinedAt: new Date(SESSION_START.getTime() - 10 * 60_000),
        leftAt: new Date(SESSION_END.getTime() + 10 * 60_000),
      },
    ];

    // Act: compute only the in-session interval.
    const result = computeContinuousPresence(intervals, SESSION, RULE);

    // Assert: out-of-session minutes do not increase attendance.
    expect(result).toEqual({
      status: AttendanceStatus.PRESENT,
      longestContinuousSeconds: 2 * 60 * 60,
      totalSeconds: 2 * 60 * 60,
    });
  });

  it("unions overlapping intervals instead of double-counting them", () => {
    // Arrange: provider reconnects produce overlapping copies of the same presence.
    const intervals = [interval(0, 60), interval(30, 75)];

    // Act: calculate the presence union.
    const result = computeContinuousPresence(intervals, SESSION, {
      ...RULE,
      minContinuousPercent: 60,
    });

    // Assert: overlap is counted once while the resulting stay meets the threshold.
    expect(result.status).toBe(AttendanceStatus.PRESENT);
    expect(result.longestContinuousSeconds).toBe(75 * 60);
    expect(result.totalSeconds).toBe(75 * 60);
  });

  it("treats a zero-length interval as no presence", () => {
    // Arrange: a provider emits a join and leave at the same instant.
    const instant = interval(10, 10);

    // Act: compute attendance.
    const result = computeContinuousPresence([instant], SESSION, RULE);

    // Assert: a zero-duration event cannot satisfy even the minimum threshold.
    expect(result).toEqual({
      status: AttendanceStatus.ABSENT,
      longestContinuousSeconds: 0,
      totalSeconds: 0,
    });
  });

  it("returns absent for an empty report", () => {
    // Arrange: no presence intervals were received.
    const intervals: PresenceIntervalInput[] = [];

    // Act: compute attendance.
    const result = computeContinuousPresence(intervals, SESSION, RULE);

    // Assert: no visit is not attendance, including when a threshold is configured.
    expect(result.status).toBe(AttendanceStatus.ABSENT);
  });

  it("does not count presence wholly outside the session", () => {
    // Arrange: the student visits only before the session starts.
    const intervals = [
      {
        joinedAt: new Date(SESSION_START.getTime() - 20 * 60_000),
        leftAt: new Date(SESSION_START.getTime() - 1),
      },
    ];

    // Act: clip and compute.
    const result = computeContinuousPresence(intervals, SESSION, RULE);

    // Assert: clipped-away intervals contribute nothing.
    expect(result.status).toBe(AttendanceStatus.ABSENT);
    expect(result.longestContinuousSeconds).toBe(0);
    expect(result.totalSeconds).toBe(0);
  });

  it("uses millisecond precision when comparing the threshold", () => {
    // Arrange: one stay is one millisecond short of 75% of the session.
    const intervals = [
      {
        joinedAt: new Date(SESSION_START.getTime()),
        leftAt: new Date(SESSION_START.getTime() + 90 * 60_000 - 1),
      },
    ];

    // Act: calculate the result before rounding stored whole-second values.
    const result = computeContinuousPresence(intervals, SESSION, RULE);

    // Assert: rounding durations must not turn a below-threshold stay into PRESENT.
    expect(result.status).toBe(AttendanceStatus.ABSENT);
  });

  it("validates session bounds, interval order, and rule values", () => {
    // Arrange: prepare invalid session, interval, and rule inputs.
    const reversedSession = { startsAt: SESSION_END, endsAt: SESSION_START };
    const reversedInterval = [interval(20, 10)];

    // Act / Assert: malformed values fail explicitly rather than being silently counted.
    expect(() => computeContinuousPresence([], reversedSession, RULE)).toThrow(RangeError);
    expect(() => computeContinuousPresence(reversedInterval, SESSION, RULE)).toThrow(RangeError);
    expect(() =>
      computeContinuousPresence([], SESSION, { ...RULE, minContinuousPercent: 101 }),
    ).toThrow(RangeError);
    expect(() =>
      computeContinuousPresence([], SESSION, { ...RULE, reconnectGraceSeconds: -1 }),
    ).toThrow(RangeError);
  });
});
