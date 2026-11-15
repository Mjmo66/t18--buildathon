// Can a volunteer accept a session? Pure function, so the rules can move to a backend later.
import type { Occurrence, Request, Snapshot, Volunteer } from "@/api/types";
import { volunteerStanding } from "@/lib/attendance";
import {
  credentialProblem,
  credentialState,
  latestCredential,
  requiredCredentials,
} from "@/lib/credentials";
import { milesBetween } from "@/lib/postcodes";

export interface Reason {
  code: string;
  message: string;
}

export interface Eligibility {
  /** Hard rules: any of these stops the volunteer accepting. */
  blockers: Reason[];
  /** Soft warnings about their own preferences: shown, but they can still accept. */
  notes: Reason[];
  canAccept: boolean;
  spotsLeft: number;
  distanceMiles: number;
  alreadyGoing: boolean;
}

const londonParts = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    weekday,
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
};

/** Does the session sit inside one of the volunteer's weekly time windows (UK time)? */
export function fitsWeeklyAvailability(volunteer: Volunteer, occurrence: Occurrence): boolean {
  const start = londonParts(occurrence.start);
  const end = londonParts(occurrence.end);
  if (start.date !== end.date) return false;
  return volunteer.weeklyAvailability.some(
    (w) => w.day === start.weekday && w.start <= start.time && end.time <= w.end,
  );
}

export function spotsLeft(data: Snapshot, request: Request, occurrenceId: string): number {
  const taken = data.commitments.filter(
    (c) => c.occurrenceId === occurrenceId && c.status === "accepted",
  ).length;
  return Math.max(0, request.volunteersNeeded - taken);
}

/** Sessions of a request that haven't started yet, soonest first. */
export function upcomingOccurrences(
  data: Snapshot,
  request: Request,
  now = new Date(),
): Occurrence[] {
  return data.occurrences
    .filter((o) => o.requestId === request.id && new Date(o.start) > now)
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function checkEligibility(
  data: Snapshot,
  volunteer: Volunteer,
  request: Request,
  occurrence: Occurrence,
  now = new Date(),
): Eligibility {
  const blockers: Reason[] = [];
  const notes: Reason[] = [];
  const block = (code: string, message: string) => blockers.push({ code, message });
  const note = (code: string, message: string) => notes.push({ code, message });

  const mine = data.commitments.filter(
    (c) => c.volunteerId === volunteer.id && c.status === "accepted",
  );
  const alreadyGoing = mine.some((c) => c.occurrenceId === occurrence.id);
  const left = spotsLeft(data, request, occurrence.id);
  const distanceMiles =
    Math.round(milesBetween(volunteer.coordinates, request.coordinates) * 10) / 10;

  if (alreadyGoing) block("already-going", "You’ve already accepted this session.");
  if (request.status !== "open") block("not-open", "This request isn’t open any more.");
  if (new Date(occurrence.start) <= now) block("started", "This session has already started.");
  if (volunteer.verification !== "verified")
    block("not-verified", "You need to be verified before you can accept requests.");
  if (!volunteer.available)
    block("switched-off", "You’re switched OFF. Switch ON to accept requests.");
  if (volunteerStanding(data.commitments, volunteer.id, now).standing === "suspended") {
    block("suspended", "You have 3 strikes, so you can’t accept new requests right now.");
  }
  if (!alreadyGoing && left === 0) block("full", "All the spots for this session have been taken.");

  const clash = mine.some((c) => {
    if (c.occurrenceId === occurrence.id) return false;
    const other = data.occurrences.find((o) => o.id === c.occurrenceId);
    return other && other.start < occurrence.end && occurrence.start < other.end;
  });
  if (clash) block("clash", "This overlaps with something you’ve already accepted.");

  if (request.carNeeded && !(volunteer.hasCar && volunteer.willingToDrive)) {
    block("needs-car", "This needs a car, and your preferences say you can’t drive for tasks.");
  }
  // Certificates Kindred has checked (DBS, driving licence, food hygiene and so on).
  for (const type of requiredCredentials(request)) {
    const problem = credentialProblem(
      type,
      credentialState(latestCredential(data, volunteer.id, type), now),
    );
    if (problem) block(`credential-${type}`, problem);
  }
  if (volunteer.age < request.requirements.minimumAge) {
    block("too-young", `Volunteers need to be ${request.requirements.minimumAge} or over.`);
  }
  if (request.requirements.physicalWork && !volunteer.physicalWork) {
    block("physical", "This involves physical work, which you’ve said you’d rather not do.");
  }
  if (volunteer.cannotDo.includes(request.taskType)) {
    block("task-excluded", `You’ve said you can’t do ${request.taskType.toLowerCase()} tasks.`);
  }

  if (distanceMiles > volunteer.maxDistanceMiles) {
    note(
      "too-far",
      `It’s ${distanceMiles} miles away, further than your ${volunteer.maxDistanceMiles}-mile limit.`,
    );
  }
  const { date } = londonParts(occurrence.start);
  if (volunteer.blockedDates.includes(date)) note("blocked-date", "You’ve blocked out this date.");
  else if (!fitsWeeklyAvailability(volunteer, occurrence))
    note("outside-availability", "This is outside your usual weekly availability.");

  return {
    blockers,
    notes,
    canAccept: blockers.length === 0,
    spotsLeft: left,
    distanceMiles,
    alreadyGoing,
  };
}
