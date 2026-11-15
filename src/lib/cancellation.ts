// Cancellation rules. Pure functions, so they can move to a backend later.

/** Cancelling at least this many hours before the start is always free. */
export const CANCELLATION_NOTICE_HOURS = 24;
/** Points lost for a late cancellation without an accepted reason. */
export const LATE_CANCEL_PENALTY = 10;

export interface CancelReason {
  id: string;
  label: string;
  /** Accepted reasons never cost points, even at short notice. */
  excused: boolean;
}

export const CANCEL_REASONS: CancelReason[] = [
  { id: "illness", label: "I’m ill or injured", excused: true },
  { id: "emergency", label: "Family or caring emergency", excused: true },
  { id: "bereavement", label: "Bereavement", excused: true },
  { id: "disruption", label: "Severe weather or transport disruption", excused: true },
  { id: "work", label: "Work or study clash", excused: false },
  { id: "other-plans", label: "Something else came up", excused: false },
  { id: "forgot", label: "I double-booked or forgot", excused: false },
];

export type CancelWindow = "free" | "late" | "started";

const HOUR_MS = 60 * 60 * 1000;

/** free = 24+ hours to go; late = less than 24 hours; started = too late to cancel. */
export function cancelWindow(occurrenceStart: string, now = new Date()): CancelWindow {
  const msToStart = new Date(occurrenceStart).getTime() - now.getTime();
  if (msToStart <= 0) return "started";
  return msToStart < CANCELLATION_NOTICE_HOURS * HOUR_MS ? "late" : "free";
}

/** When free cancellation ends for a session. */
export function freeCancellationEnds(occurrenceStart: string): Date {
  return new Date(new Date(occurrenceStart).getTime() - CANCELLATION_NOTICE_HOURS * HOUR_MS);
}

/** Whether a cancellation costs points: only late ones without an accepted reason. */
export function isPenalised(window: CancelWindow, reasonId?: string): boolean {
  if (window !== "late") return false;
  const reason = CANCEL_REASONS.find((r) => r.id === reasonId);
  return !reason?.excused;
}
