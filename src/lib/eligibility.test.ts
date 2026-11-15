import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixtures } from "@/api/fixtures";
import { acceptRequest, getSnapshot, markAttendance, resetMockData } from "@/api/mock-api";
import type { Snapshot, Volunteer } from "@/api/types";
import { checkEligibility, upcomingOccurrences } from "./eligibility";

const NOW = new Date("2026-11-15T12:00:00Z");
const clone = (): Snapshot => structuredClone(fixtures);
const isla = (data: Snapshot) => data.volunteers.find((v) => v.id === "v1")!;

function check(data: Snapshot, requestId: string, volunteer: Volunteer = isla(data)) {
  const request = data.requests.find((r) => r.id === requestId)!;
  const occurrence = data.occurrences.find((o) => o.id === request.occurrenceIds[0])!;
  return checkEligibility(data, volunteer, request, occurrence, NOW);
}
const codes = (reasons: { code: string }[]) => reasons.map((r) => r.code);

describe("checkEligibility", () => {
  it("lets Isla accept the Leith food bank session", () => {
    const result = check(clone(), "r1");
    expect(result.canAccept).toBe(true);
    expect(result.spotsLeft).toBe(3); // 4 needed, Callum has one
  });

  it("knows when she's already going", () => {
    const result = check(clone(), "r4"); // k1
    expect(result.alreadyGoing).toBe(true);
    expect(codes(result.blockers)).toEqual(["already-going"]);
  });

  it("blocks when switched off, not verified or suspended", () => {
    const data = clone();
    expect(codes(check(data, "r1", { ...isla(data), available: false }).blockers)).toContain(
      "switched-off",
    );
    expect(codes(check(data, "r1", { ...isla(data), verification: "pending" }).blockers)).toContain(
      "not-verified",
    );
    const callum = data.volunteers.find((v) => v.id === "v6")!;
    data.commitments.push({
      id: "x",
      volunteerId: "v6",
      occurrenceId: "o8",
      status: "no-show",
      attendanceMarkedAt: "2026-11-12T10:00:00Z",
    });
    expect(codes(check(data, "r2", callum).blockers)).toContain("suspended");
  });

  it("blocks requirements the volunteer doesn't meet", () => {
    const data = clone();
    const v = isla(data);
    expect(codes(check(data, "r2", { ...v, hasCar: false }).blockers)).toContain("needs-car");
    const noDbs = { ...data, credentials: data.credentials.filter((c) => c.type !== "dbs") };
    expect(codes(check(noDbs, "r3", v).blockers)).toContain("credential-dbs");
    expect(codes(check(data, "r1", { ...v, age: 17 }).blockers)).toContain("too-young");
    expect(codes(check(data, "r6", { ...v, physicalWork: false }).blockers)).toContain("physical");
    expect(codes(check(data, "r6", v).blockers)).toContain("task-excluded"); // heavy lifting
  });

  it("blocks a full session", () => {
    const data = clone();
    data.commitments.push({ id: "x1", volunteerId: "v2", occurrenceId: "o5", status: "accepted" }); // admin needs 1; Callum has it
    expect(codes(check(data, "r5").blockers)).toContain("full");
  });

  it("blocks sessions that overlap one she's accepted", () => {
    const data = clone();
    data.occurrences.push({
      id: "oX",
      requestId: "r2",
      start: "2026-11-21T10:30:00Z",
      end: "2026-11-21T11:30:00Z",
    });
    const request = data.requests.find((r) => r.id === "r2")!;
    const occurrence = data.occurrences.find((o) => o.id === "oX")!;
    // Overlaps r4 (Sat 21 Nov 10:00–13:00), which Isla has accepted.
    expect(codes(checkEligibility(data, isla(data), request, occurrence, NOW).blockers)).toContain(
      "clash",
    );
  });

  it("warns, but still allows, things that only go against her preferences", () => {
    const data = clone();
    // r3 (befriending) is about 0.6 miles from Isla's home.
    const result = check(data, "r3", { ...isla(data), maxDistanceMiles: 0.1 });
    expect(result.canAccept).toBe(true);
    expect(codes(result.notes)).toContain("too-far");
    // r2 is Thursday 19 Nov 13:00–15:00; Isla is free Tuesdays and Thursdays 9am–5pm.
    expect(codes(check(data, "r2").notes)).toEqual([]);
    expect(codes(check(data, "r1", { ...isla(data), weeklyAvailability: [] }).notes)).toContain(
      "outside-availability",
    );
    expect(
      codes(check(data, "r1", { ...isla(data), blockedDates: ["2026-11-17"] }).notes),
    ).toContain("blocked-date");
  });

  it("lists only sessions that haven't started", () => {
    const data = clone();
    const r7 = data.requests.find((r) => r.id === "r7")!;
    expect(upcomingOccurrences(data, r7, NOW)).toEqual([]);
  });
});

describe("acceptRequest (mock API)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    resetMockData();
  });

  it("adds an accepted commitment and takes a spot", async () => {
    const commitment = await acceptRequest("v1", "o1");
    expect(commitment).toMatchObject({ volunteerId: "v1", occurrenceId: "o1", status: "accepted" });
    const data = await getSnapshot();
    expect(
      data.commitments.filter((c) => c.occurrenceId === "o1" && c.status === "accepted"),
    ).toHaveLength(2);
  });

  it("refuses to accept the same session twice", async () => {
    await acceptRequest("v1", "o1");
    await expect(acceptRequest("v1", "o1")).rejects.toThrow("already accepted");
  });

  it("refuses a suspended volunteer", async () => {
    await markAttendance("k8", false); // Callum's third no-show
    await expect(acceptRequest("v6", "o2")).rejects.toThrow("3 strikes");
  });
});
