// Charity-side views over the snapshot. Pure functions, so they can move to a backend later.
import type {
  Commitment,
  Occurrence,
  Request,
  RequestStatus,
  Snapshot,
  TaskType,
  Volunteer,
} from "@/api/types";
import { attendanceRows } from "@/lib/attendance";

export const CHARITY_CANCEL_REASONS = [
  { id: "not-enough-volunteers", label: "Not enough volunteers" },
  { id: "event-cancelled", label: "The event or activity is cancelled" },
  { id: "venue", label: "Venue no longer available" },
  { id: "weather", label: "Bad weather" },
  { id: "mistake", label: "Posted by mistake" },
  { id: "other", label: "Something else" },
] as const;

export const cancelReasonLabel = (id: string) =>
  CHARITY_CANCEL_REASONS.find((r) => r.id === id)?.label ?? "Cancelled";

export interface SessionSummary {
  occurrence: Occurrence;
  volunteers: { volunteer: Volunteer; commitment: Commitment }[];
  filled: number;
  needed: number;
  past: boolean;
}

export interface RequestSummary {
  request: Request;
  sessions: SessionSummary[];
  upcoming: SessionSummary[];
  next?: SessionSummary;
  /** Volunteers signed up to sessions that haven't happened yet. */
  upcomingSignUps: number;
  /** Every session has finished, so it can be marked complete. */
  allEnded: boolean;
}

export function summariseRequest(
  data: Snapshot,
  request: Request,
  now = new Date(),
): RequestSummary {
  const sessions = data.occurrences
    .filter((o) => o.requestId === request.id)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((occurrence) => {
      const volunteers = data.commitments
        .filter((c) => c.occurrenceId === occurrence.id && c.status !== "cancelled")
        .flatMap((commitment) => {
          const volunteer = data.volunteers.find((v) => v.id === commitment.volunteerId);
          return volunteer ? [{ volunteer, commitment }] : [];
        });
      return {
        occurrence,
        volunteers,
        filled: volunteers.length,
        needed: request.volunteersNeeded,
        past: new Date(occurrence.end) <= now,
      };
    });
  const upcoming = sessions.filter((s) => !s.past);
  return {
    request,
    sessions,
    upcoming,
    ...(upcoming[0] ? { next: upcoming[0] } : {}),
    upcomingSignUps: upcoming.reduce((sum, s) => sum + s.filled, 0),
    allEnded: sessions.length > 0 && upcoming.length === 0,
  };
}

export interface RequestFilters {
  query: string;
  status: RequestStatus | "all";
  taskType: TaskType | "all";
}

export function filterRequests(
  summaries: RequestSummary[],
  filters: RequestFilters,
): RequestSummary[] {
  const q = filters.query.trim().toLowerCase();
  return summaries.filter(({ request: r }) => {
    if (filters.status !== "all" && r.status !== filters.status) return false;
    if (filters.taskType !== "all" && r.taskType !== filters.taskType) return false;
    if (
      q &&
      ![r.title, r.location, r.taskType, r.postcode].some((t) => t.toLowerCase().includes(q))
    )
      return false;
    return true;
  });
}

export type SortKey = "title" | "date" | "spots" | "status";

export function sortRequests(
  summaries: RequestSummary[],
  key: SortKey,
  direction: "asc" | "desc",
): RequestSummary[] {
  const value = (s: RequestSummary): string | number => {
    switch (key) {
      case "title":
        return s.request.title.toLowerCase();
      case "date":
        return (s.next ?? s.sessions.at(-1))?.occurrence.start ?? "";
      case "spots":
        return s.next ? s.next.filled / s.next.needed : 2;
      case "status":
        return s.request.status;
    }
  };
  const sorted = [...summaries].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
  return direction === "asc" ? sorted : sorted.reverse();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The charity's to-do list for the Dashboard. */
export function charityTodos(data: Snapshot, now = new Date()) {
  const summaries = data.requests.map((r) => summariseRequest(data, r, now));
  const soon = new Date(now.getTime() + 14 * DAY_MS);
  const needVolunteers = summaries
    .filter((s) => s.request.status === "open")
    .flatMap((s) =>
      s.upcoming
        .filter((u) => new Date(u.occurrence.start) <= soon && u.filled < u.needed)
        .map((u) => ({ summary: s, session: u })),
    )
    .sort((a, b) => a.session.occurrence.start.localeCompare(b.session.occurrence.start));
  return {
    attendance: attendanceRows(data, now).waiting.length,
    drafts: summaries.filter((s) => s.request.status === "draft"),
    needVolunteers,
    readyToComplete: summaries.filter((s) => s.request.status === "open" && s.allEnded),
  };
}

/** Upcoming sessions of open requests in the next `days` days, soonest first. */
export function upcomingSessions(data: Snapshot, days = 14, now = new Date()) {
  const until = new Date(now.getTime() + days * DAY_MS);
  return data.requests
    .filter((r) => r.status === "open")
    .flatMap((r) =>
      summariseRequest(data, r, now).upcoming.map((session) => ({ request: r, session })),
    )
    .filter(({ session }) => new Date(session.occurrence.start) <= until)
    .sort((a, b) => a.session.occurrence.start.localeCompare(b.session.occurrence.start));
}
