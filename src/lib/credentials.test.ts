import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixtures } from "@/api/fixtures";
import {
  getSnapshot,
  resetMockData,
  signIn,
  submitCredential,
  DEMO_PASSWORD,
} from "@/api/mock-api";
import type { Snapshot } from "@/api/types";
import {
  credentialState,
  latestCredential,
  requiredCredentials,
  verificationProgress,
} from "./credentials";
import { checkEligibility } from "./eligibility";

const NOW = new Date("2026-11-15T12:00:00Z");
const clone = (): Snapshot => structuredClone(fixtures);
const state = (data: Snapshot, type: Parameters<typeof latestCredential>[2]) =>
  credentialState(latestCredential(data, "v1", type), NOW);

function blockersFor(data: Snapshot, requestId: string) {
  const request = data.requests.find((r) => r.id === requestId)!;
  const occurrence = data.occurrences.find((o) => o.id === request.occurrenceIds[0])!;
  const isla = data.volunteers.find((v) => v.id === "v1")!;
  return checkEligibility(data, isla, request, occurrence, NOW).blockers.map((b) => b.code);
}

describe("credential state", () => {
  it("reads Isla's checks", () => {
    const data = clone();
    expect(state(data, "identity")).toBe("verified");
    expect(state(data, "car-insurance")).toBe("expired"); // ran out on 1 Nov 2026
    expect(state(data, "manual-handling")).toBe("missing");
  });

  it("treats pending and rejected documents as not verified", () => {
    const base = fixtures.credentials[0]!;
    expect(credentialState({ ...base, status: "pending" }, NOW)).toBe("pending");
    expect(credentialState({ ...base, status: "rejected" }, NOW)).toBe("rejected");
  });

  it("uses the newest submission", () => {
    const data = clone();
    data.credentials.push({
      id: "new",
      volunteerId: "v1",
      type: "car-insurance",
      status: "pending",
      submittedAt: "2026-11-14T10:00:00Z",
      reference: "Policy ending 9001",
    });
    expect(state(data, "car-insurance")).toBe("pending");
  });

  it("counts progress on core checks plus ones Isla's tasks need", () => {
    // Core 3 + food hygiene, driving licence, car insurance, DBS = 7; 6 verified, insurance expired
    expect(verificationProgress(clone(), "v1", fixtures.volunteers[0]!.canDo, NOW)).toEqual({
      done: 6,
      total: 7,
      needsAttention: 1,
    });
  });
});

describe("certificates needed for tasks", () => {
  it("maps task types to certificates", () => {
    const data = clone();
    const byId = (id: string) => requiredCredentials(data.requests.find((r) => r.id === id)!);
    expect(byId("r1")).toEqual(["food-hygiene"]);
    expect(byId("r2")).toEqual(["driving-licence", "car-insurance"]);
    expect(byId("r3")).toEqual(["dbs"]);
    expect(byId("r5")).toEqual([]); // admin
  });

  it("blocks driving while Isla's insurance has expired", () => {
    expect(blockersFor(clone(), "r2")).toContain("credential-car-insurance");
  });

  it("allows food bank and befriending with verified certificates", () => {
    expect(blockersFor(clone(), "r1")).toEqual([]);
    expect(blockersFor(clone(), "r3")).toEqual([]);
  });

  it("adds DBS when the charity asks for it, whatever the task", () => {
    const data = clone();
    const r5 = data.requests.find((r) => r.id === "r5")!;
    r5.requirements.dbs = true;
    expect(requiredCredentials(r5)).toEqual(["dbs"]);
  });
});

describe("mock API", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    resetMockData();
  });

  it("stores a new document as pending", async () => {
    const credential = await submitCredential("v1", {
      type: "car-insurance",
      reference: "Policy ending 9001",
      expiresAt: "2027-11-01",
      fileName: "new-policy.pdf",
    });
    expect(credential.status).toBe("pending");
    expect(state(await getSnapshot(), "car-insurance")).toBe("pending");
  });

  it("signs in with the demo password only", async () => {
    expect((await signIn(" ISLA@example.test ", DEMO_PASSWORD)).id).toBe("v1");
    await expect(signIn("isla@example.test", "wrong-password")).rejects.toThrow("don’t match");
    await expect(signIn("nobody@example.test", DEMO_PASSWORD)).rejects.toThrow("don’t match");
  });
});
