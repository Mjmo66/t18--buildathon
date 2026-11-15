// Attendance and strikes. Pure functions, so the rules can move to a backend later.
import type { Commitment, Occurrence, Request, Snapshot, Volunteer } from "@/api/types";

/** Strikes count for six months after the charity marks a no-show. */
export const STRIKE_WINDOW_DAYS = 180;
/** At this many active strikes a volunteer can't accept new requests. */
export const SUSPEND_AT_STRIKES = 3;

export type Standing = "good" | "warning" | "final-warning" | "suspended";

const DAY_MS = 24 * 60 * 60 * 1000;

export function strikeExpiresAt(strike: Commitment): Date | null {
  return strike.attendanceMarkedAt
    ? new Date(new Date(strike.attendanceMarkedAt).getTime() + STRIKE_WINDOW_DAYS * DAY_MS)
    : null;
}

/** No-shows from the last six months, newest first. */
export function activeStrikes(
  commitments: Commitment[],
  volunteerId: string,
  now = new Date(),
): Commitment[] {
  return commitments
    .filter((c) => c.volunteerId === volunteerId && c.status === "no-show")
    .filter((c) => {
      const expires = strikeExpiresAt(c);
      return expires !== null && expires > now;
    })
    .sort((a, b) => (b.attendanceMarkedAt ?? "").localeCompare(a.attendanceMarkedAt ?? ""));
}

export function standingFor(strikeCount: number): Standing {
  if (strikeCount >= SUSPEND_AT_STRIKES) return "suspended";
  if (strikeCount === SUSPEND_AT_STRIKES - 1) return "final-warning";
  if (strikeCount >= 1) return "warning";
  return "good";
}

export function volunteerStanding(
  commitments: Commitment[],
  volunteerId: string,
  now = new Date(),
) {
  const strikes = activeStrikes(commitments, volunteerId, now);
  const attended = commitments.filter(
    (c) => c.volunteerId === volunteerId && c.status === "completed",
  ).length;
  return { strikes, standing: standingFor(strikes.length), attended };
}

export interface AttendanceRow {
  commitment: Commitment;
  occurrence: Occurrence;
  request: Request;
  volunteer: Volunteer;
}

/**
 * Sessions that have ended, split into ones the charity still needs to confirm
 * and ones already confirmed (came / didn't come).
 */
export function attendanceRows(data: Snapshot, now = new Date()) {
  const rows: AttendanceRow[] = [];
  for (const commitment of data.commitments) {
    if (commitment.status === "cancelled") continue;
    const occurrence = data.occurrences.find((o) => o.id === commitment.occurrenceId);
    const request = occurrence && data.requests.find((r) => r.id === occurrence.requestId);
    const volunteer = data.volunteers.find((v) => v.id === commitment.volunteerId);
    if (!occurrence || !request || !volunteer || new Date(occurrence.end) > now) continue;
    rows.push({ commitment, occurrence, request, volunteer });
  }
  const waiting = rows
    .filter((r) => r.commitment.status === "accepted")
    .sort((a, b) => b.occurrence.start.localeCompare(a.occurrence.start));
  const confirmed = rows
    .filter((r) => r.commitment.status !== "accepted")
    .sort((a, b) =>
      (b.commitment.attendanceMarkedAt ?? "").localeCompare(a.commitment.attendanceMarkedAt ?? ""),
    );
  return { waiting, confirmed };
}

/** True once a session has finished, so attendance can be confirmed. */
export function hasEnded(occurrence: Occurrence, now = new Date()): boolean {
  return new Date(occurrence.end) <= now;
}
