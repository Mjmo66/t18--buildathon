import { fixtures } from "./fixtures";
import type { CharityDetails, CredentialType, NewRequest, VolunteerPreferences } from "./types";
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

/** Demo password for the volunteer sign-in page. Not real authentication. */
export const DEMO_PASSWORD = "kindred123";

/** Mock sign-in: finds the volunteer by email and checks the demo password. */
export async function signIn(email: string, password: string) {
  await pause(400);
  const volunteer = db.volunteers.find((v) => v.email.toLowerCase() === email.trim().toLowerCase());
  if (!volunteer || password !== DEMO_PASSWORD)
    throw new Error("That email and password don’t match an account");
  return copy(volunteer);
}

/** A volunteer sends a document for Kindred to check. It starts as "pending". */
export async function submitCredential(
  volunteerId: string,
  input: { type: CredentialType; reference: string; expiresAt?: string; fileName?: string },
) {
  await pause();
  findVolunteer(volunteerId);
  const reference = input.reference.trim();
  if (reference.length < 3) throw new Error("Tell us a bit more about the document");
  const credential = {
    id: nextId(
      "cr",
      db.credentials.map((c) => c.id),
    ),
    volunteerId,
    type: input.type,
    status: "pending" as const,
    submittedAt: new Date().toISOString(),
    reference,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    ...(input.fileName ? { fileName: input.fileName } : {}),
  };
  db.credentials.push(credential);
  return copy(credential);
}

function findRequest(id: string) {
  const request = db.requests.find((r) => r.id === id);
  if (!request) throw new Error("Request not found");
  return request;
}

function acceptedOn(requestId: string) {
  const sessionIds = db.occurrences.filter((o) => o.requestId === requestId).map((o) => o.id);
  return db.commitments.filter(
    (c) => sessionIds.includes(c.occurrenceId) && c.status === "accepted",
  );
}

/**
 * The charity edits a request. Sessions are only replaced when nobody has signed up,
 * so volunteers' plans never change under them.
 */
export async function updateRequest(
  id: string,
  input: NewRequest,
  options: { replaceSessions: boolean },
) {
  await pause();
  const request = findRequest(id);
  if (request.status === "cancelled" || request.status === "completed")
    throw new Error("This request can’t be edited any more");
  const signedUp = acceptedOn(id);
  const perSession = new Map<string, number>();
  for (const c of signedUp)
    perSession.set(c.occurrenceId, (perSession.get(c.occurrenceId) ?? 0) + 1);
  const most = Math.max(0, ...perSession.values());
  if (input.volunteersNeeded < most)
    throw new Error(
      `${most} volunteers have already signed up to one session, so you need at least ${most}`,
    );

  const { occurrences, ...fields } = input;
  Object.assign(request, copy(fields));
  if (options.replaceSessions) {
    if (signedUp.length)
      throw new Error("Volunteers have signed up, so the dates can’t be changed");
    db.occurrences = db.occurrences.filter((o) => o.requestId !== id);
    const first = Number(
      nextId(
        "o",
        db.occurrences.map((o) => o.id),
      ).slice(1),
    );
    const fresh = occurrences.map((o, i) => ({
      id: `o${first + i}`,
      requestId: id,
      start: o.start,
      end: o.end,
    }));
    db.occurrences.push(...fresh);
    request.occurrenceIds = fresh.map((o) => o.id);
  }
  return copy(request);
}

/** A draft goes live for volunteers. */
export async function publishRequest(id: string) {
  await pause(200);
  const request = findRequest(id);
  if (request.status !== "draft") throw new Error("Only drafts can be published");
  request.status = "open";
  return copy(request);
}

/** Mark a request complete once every session has finished. */
export async function completeRequest(id: string) {
  await pause(200);
  const request = findRequest(id);
  const sessions = db.occurrences.filter((o) => o.requestId === id);
  if (sessions.some((o) => new Date(o.end) > new Date())) {
    throw new Error(
      "Some sessions haven’t happened yet. Cancel them, or wait until they’ve finished.",
    );
  }
  request.status = "completed";
  return copy(request);
}

/**
 * The charity cancels a whole request. Everyone signed up to an upcoming session is
 * released with no penalty, and sees the charity's reason.
 */
export async function cancelRequest(id: string, details: { reasonId: string; message?: string }) {
  await pause();
  const request = findRequest(id);
  if (request.status === "cancelled" || request.status === "completed")
    throw new Error("This request has already finished");
  const now = new Date();
  const message = details.message?.trim();
  request.status = "cancelled";
  request.cancellation = {
    cancelledAt: now.toISOString(),
    reasonId: details.reasonId,
    ...(message ? { message } : {}),
  };
  for (const commitment of acceptedOn(id)) {
    const session = db.occurrences.find((o) => o.id === commitment.occurrenceId);
    if (!session || new Date(session.start) <= now) continue;
    commitment.status = "cancelled";
    commitment.cancellation = {
      cancelledAt: now.toISOString(),
      late: false,
      penalised: false,
      byCharity: true,
    };
  }
  return copy(request);
}

/** The charity updates its contact details. */
export async function updateCharityDetails(details: CharityDetails) {
  await pause();
  Object.assign(db.charity, copy(details));
  return copy(db.charity);
}
