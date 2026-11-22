// Purpose: Compute continuous online attendance from clipped presence intervals.
import { AttendanceStatus } from "@prisma/client";

/** One reported or provider-recorded presence interval. */
export interface PresenceIntervalInput {
  joinedAt: Date;
  leftAt: Date;
}

/** Session window used to clip reported presence. */
export interface PresenceSessionWindow {
  startsAt: Date;
  endsAt: Date;
}

/** Continuous-presence and reconnect thresholds from the global attendance rule. */
export interface ContinuousPresenceRule {
  minContinuousPercent: number;
  reconnectGraceSeconds: number;
}

/** Computed online attendance outcome and interval totals, in whole seconds. */
export interface ContinuousPresenceResult {
  status: AttendanceStatus;
  longestContinuousSeconds: number;
  totalSeconds: number;
}

interface TimeRange {
  start: number;
  end: number;
}

/**
 * Clips presence to a session, merges reconnects within the grace period, and
 * marks present only when the longest continuous stay meets the threshold.
 */
export function computeContinuousPresence(
  intervals: readonly PresenceIntervalInput[],
  session: PresenceSessionWindow,
  rule: ContinuousPresenceRule,
): ContinuousPresenceResult {
  const sessionStart = timestamp(session.startsAt, "Session start");
  const sessionEnd = timestamp(session.endsAt, "Session end");
  if (sessionEnd <= sessionStart) {
    throw new RangeError("Session end must be after session start.");
  }
  if (
    !Number.isSafeInteger(rule.minContinuousPercent) ||
    rule.minContinuousPercent < 0 ||
    rule.minContinuousPercent > 100
  ) {
    throw new RangeError("Minimum continuous attendance percentage must be from 0 to 100.");
  }
  if (!Number.isSafeInteger(rule.reconnectGraceSeconds) || rule.reconnectGraceSeconds < 0) {
    throw new RangeError("Reconnect grace must be a non-negative whole number of seconds.");
  }

  const clipped = intervals.flatMap((interval): TimeRange[] => {
    const joinedAt = timestamp(interval.joinedAt, "Presence join time");
    const leftAt = timestamp(interval.leftAt, "Presence leave time");
    if (leftAt < joinedAt) {
      throw new RangeError("Presence leave time must not be before join time.");
    }
    const start = Math.max(sessionStart, joinedAt);
    const end = Math.min(sessionEnd, leftAt);
    return end <= start ? [] : [{ start, end }];
  });
  clipped.sort((left, right) => left.start - right.start || left.end - right.end);

  const presence = mergeRanges(clipped, 0);
  const continuous = mergeRanges(presence, rule.reconnectGraceSeconds * 1000);
  const totalMilliseconds = presence.reduce((total, range) => total + range.end - range.start, 0);
  const longestMilliseconds = continuous.reduce(
    (longest, range) => Math.max(longest, range.end - range.start),
    0,
  );
  const meetsThreshold =
    longestMilliseconds > 0 &&
    (longestMilliseconds / (sessionEnd - sessionStart)) * 100 >= rule.minContinuousPercent;

  return {
    status: meetsThreshold ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT,
    longestContinuousSeconds: Math.floor(longestMilliseconds / 1000),
    totalSeconds: Math.floor(totalMilliseconds / 1000),
  };
}

function mergeRanges(ranges: readonly TimeRange[], maximumGapMilliseconds: number): TimeRange[] {
  const merged: TimeRange[] = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous === undefined || range.start - previous.end > maximumGapMilliseconds) {
      merged.push({ ...range });
    } else {
      previous.end = Math.max(previous.end, range.end);
    }
  }
  return merged;
}

function timestamp(value: Date, label: string): number {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new RangeError(`${label} must be a valid date.`);
  }
  return value.getTime();
}
