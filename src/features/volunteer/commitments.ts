import type { Commitment, Occurrence, Request, Snapshot } from "@/api/types";

export interface CommitmentItem {
  commitment: Commitment;
  occurrence: Occurrence;
  request: Request;
}

/** A volunteer's upcoming sessions (soonest first) and recent cancellations (newest first). */
export function myCommitments(data: Snapshot, volunteerId: string, now = new Date()) {
  const items: CommitmentItem[] = [];
  for (const commitment of data.commitments.filter((c) => c.volunteerId === volunteerId)) {
    const occurrence = data.occurrences.find((o) => o.id === commitment.occurrenceId);
    const request = occurrence && data.requests.find((r) => r.id === occurrence.requestId);
    if (occurrence && request) items.push({ commitment, occurrence, request });
  }
  const upcoming = items
    .filter((i) => i.commitment.status === "accepted" && new Date(i.occurrence.end) > now)
    .sort((a, b) => a.occurrence.start.localeCompare(b.occurrence.start));
  const cancelled = items
    .filter((i) => i.commitment.status === "cancelled")
    .sort((a, b) =>
      (b.commitment.cancellation?.cancelledAt ?? "").localeCompare(
        a.commitment.cancellation?.cancelledAt ?? "",
      ),
    );
  return { upcoming, cancelled };
}

export function findCommitment(
  data: Snapshot,
  volunteerId: string,
  commitmentId: string,
): CommitmentItem | null {
  const commitment = data.commitments.find(
    (c) => c.id === commitmentId && c.volunteerId === volunteerId,
  );
  const occurrence = commitment && data.occurrences.find((o) => o.id === commitment.occurrenceId);
  const request = occurrence && data.requests.find((r) => r.id === occurrence.requestId);
  return commitment && occurrence && request ? { commitment, occurrence, request } : null;
}

const dateTime = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});
const time = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

export const formatDateTime = (iso: string | Date) => dateTime.format(new Date(iso));
export const formatSession = (o: Occurrence) =>
  `${dateTime.format(new Date(o.start))} – ${time.format(new Date(o.end))}`;
