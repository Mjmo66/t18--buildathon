import { fixtures } from "./fixtures";
import type { NewRequest, VolunteerPreferences } from "./types";
import { milesBetween } from "@/lib/postcodes";
import { REWARDS, pointsBalance } from "@/lib/rewards";
import { CANCEL_REASONS, cancelWindow, isPenalised } from "@/lib/cancellation";
import { checkEligibility } from "@/lib/eligibility";

// In-memory mock database. Changes last until the page reloads, then reset to the fixtures.
let db = structuredClone(fixtures);

const copy = <T>(value: T): T => structuredClone(value);
// Small delay on writes so saving states are visible, like a real network call.
const pause = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

function findVolunteer(id: string) {
  const volunteer = db.volunteers.find((v) => v.id === id);
  if (!volunteer) throw new Error(`Volunteer ${id} not found`);
  return volunteer;
}

/** Test helper: put the mock data back to the original fixtures. */
export function resetMockData() {
  db = structuredClone(fixtures);
}

export async function getSnapshot() {
  return copy(db);
}
export async function getRequests() {
  return copy(db.requests);
}
export async function getVolunteer(id = "v1") {
  return copy(db.volunteers.find((v) => v.id === id) ?? null);
}
export async function getCharity() {
  return copy(db.charity);
}
export async function getCommitments() {
  return copy(db.commitments);
}
export async function getVerifications() {
  return copy(db.verifications);
}

export async function updatePreferences(id: string, preferences: VolunteerPreferences) {
  await pause();
  Object.assign(findVolunteer(id), copy(preferences));
  return copy(findVolunteer(id));
}

/** The volunteer's ON/OFF switch. */
export async function setAvailable(id: string, available: boolean) {
  await pause(150);
  findVolunteer(id).available = available;
  return copy(findVolunteer(id));
}

/** Next free id with a prefix, e.g. r7 when r1–r6 exist. */
function nextId(prefix: string, ids: string[]) {
  const numbers = ids.map((id) => Number(id.slice(prefix.length))).filter(Number.isFinite);
  return `${prefix}${Math.max(0, ...numbers) + 1}`;
}

/** A charity publishes (or saves a draft of) a request. New requests go to the top of the list. */
export async function createRequest(input: NewRequest) {
  await pause();
  if (!input.occurrences.length) throw new Error("A request needs at least one session");
  const requestId = nextId(
    "r",
    db.requests.map((r) => r.id),
  );
  const firstOccurrence = Number(
    nextId(
      "o",
      db.occurrences.map((o) => o.id),
    ).slice(1),
  );
  const occurrences = input.occurrences.map((o, i) => ({
    id: `o${firstOccurrence + i}`,
    requestId,
    start: o.start,
    end: o.end,
  }));
  // Shown on the volunteer board as "X miles away". Until per-volunteer matching
  // arrives in step 3, it's measured from the demo volunteer's home.
  const volunteer = db.volunteers.find((v) => v.id === "v1");
  const distanceMiles = volunteer
    ? Math.round(milesBetween(volunteer.coordinates, input.coordinates) * 10) / 10
    : 0;
  const { occurrences: _sessions, ...fields } = input;
  const request = {
    ...copy(fields),
    id: requestId,
    charityId: db.charity.id,
    occurrenceIds: occurrences.map((o) => o.id),
    distanceMiles,
  };
  db.requests.unshift(request);
  db.occurrences.push(...occurrences);
  return copy(request);
}

/**
 * The charity confirms whether a volunteer came to a finished session.
 * attended = false records a no-show, which counts as a strike. Can be changed later.
 */
export async function markAttendance(commitmentId: string, attended: boolean) {
  await pause(200);
  const commitment = db.commitments.find((c) => c.id === commitmentId);
  if (!commitment) throw new Error(`Commitment ${commitmentId} not found`);
  if (commitment.status === "cancelled")
    throw new Error("This volunteer cancelled, so there's nothing to confirm");
  const occurrence = db.occurrences.find((o) => o.id === commitment.occurrenceId);
  if (!occurrence || new Date(occurrence.end) > new Date()) {
    throw new Error("You can confirm attendance once the session has finished");
  }
  commitment.status = attended ? "completed" : "no-show";
  commitment.attendanceMarkedAt = new Date().toISOString();
  return copy(commitment);
}

/** Demo voucher code, e.g. COSTA-7F3K. Not a real voucher. */
function voucherCode(prefix: string) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const random = Array.from(
    { length: 4 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
  return `${prefix}-${random}`;
}

/** Swap points for a reward. Fails if the volunteer doesn't have enough points. */
export async function redeemReward(volunteerId: string, rewardId: string) {
  await pause();
  findVolunteer(volunteerId);
  const reward = REWARDS.find((r) => r.id === rewardId);
  if (!reward) throw new Error("That reward isn't available");
  const balance = pointsBalance(db, volunteerId);
  if (balance < reward.points) {
    throw new Error(`You need ${reward.points - Math.max(0, balance)} more points for this reward`);
  }
  const redemption = {
    id: nextId(
      "x",
      db.redemptions.map((r) => r.id),
    ),
    volunteerId,
    rewardId,
    points: reward.points,
    code: voucherCode(reward.codePrefix),
    redeemedAt: new Date().toISOString(),
  };
  db.redemptions.push(redemption);
  return copy(redemption);
}

/**
 * A volunteer cancels a commitment. Free with 24+ hours' notice. Later than that
 * needs a reason, and costs points unless the reason is an accepted one.
 */
export async function cancelCommitment(
  volunteerId: string,
  commitmentId: string,
  details: { reasonId?: string; note?: string } = {},
) {
  await pause();
  const commitment = db.commitments.find(
    (c) => c.id === commitmentId && c.volunteerId === volunteerId,
  );
  if (!commitment) throw new Error("Commitment not found");
  if (commitment.status !== "accepted") throw new Error("This commitment can’t be cancelled");
  const occurrence = db.occurrences.find((o) => o.id === commitment.occurrenceId);
  if (!occurrence) throw new Error("Session not found");

  const window = cancelWindow(occurrence.start);
  if (window === "started")
    throw new Error("This session has already started. Please contact the charity.");
  if (window === "late" && !CANCEL_REASONS.some((r) => r.id === details.reasonId)) {
    throw new Error("Please tell us why you need to cancel");
  }
  const note = details.note?.trim();
  commitment.status = "cancelled";
  commitment.cancellation = {
    cancelledAt: new Date().toISOString(),
    late: window === "late",
    penalised: isPenalised(window, details.reasonId),
    ...(details.reasonId ? { reasonId: details.reasonId } : {}),
    ...(note ? { note } : {}),
  };
  return copy(commitment);
}

/** A volunteer accepts one session of a request. Re-checks every rule, as a real server would. */
export async function acceptRequest(volunteerId: string, occurrenceId: string) {
  await pause();
  const volunteer = findVolunteer(volunteerId);
  const occurrence = db.occurrences.find((o) => o.id === occurrenceId);
  const request = occurrence && db.requests.find((r) => r.id === occurrence.requestId);
  if (!occurrence || !request) throw new Error("That session no longer exists");
  const eligibility = checkEligibility(db, volunteer, request, occurrence);
  const firstBlocker = eligibility.blockers[0];
  if (firstBlocker) throw new Error(firstBlocker.message);
  const commitment = {
    id: nextId(
      "k",
      db.commitments.map((c) => c.id),
    ),
    volunteerId,
    occurrenceId,
    status: "accepted" as const,
  };
  db.commitments.push(commitment);
  return copy(commitment);
}
