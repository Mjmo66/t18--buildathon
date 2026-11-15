import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixtures } from "@/api/fixtures";
import {
  cancelRequest,
  completeRequest,
  createRequest,
  getSnapshot,
  publishRequest,
  resetMockData,
  updateCharityDetails,
  updateRequest,
} from "@/api/mock-api";
import {
  charityTodos,
  filterRequests,
  sortRequests,
  summariseRequest,
  upcomingSessions,
} from "./charity";
import { pointsBalance } from "./rewards";

const NOW = new Date("2026-11-15T12:00:00Z");
const summaries = () => fixtures.requests.map((r) => summariseRequest(fixtures, r, NOW));
const all = { query: "", status: "all" as const, taskType: "all" as const };

describe("request summaries", () => {
  it("lists who's coming to each session", () => {
    const r1 = summariseRequest(
      fixtures,
      fixtures.requests.find((r) => r.id === "r1")!,
      NOW,
    );
    expect(r1.sessions).toHaveLength(1);
    expect(r1.next?.volunteers.map((v) => v.volunteer.name)).toEqual(["Callum Ross"]);
    expect(r1.next?.filled).toBe(1);
    expect(r1.allEnded).toBe(false);
  });

  it("knows when every session has finished", () => {
    const r7 = summariseRequest(
      fixtures,
      fixtures.requests.find((r) => r.id === "r7")!,
      NOW,
    );
    expect(r7.allEnded).toBe(true);
    expect(r7.upcomingSignUps).toBe(0);
  });
});

describe("filtering and sorting", () => {
  it("searches title, location and task type", () => {
    expect(
      filterRequests(summaries(), { ...all, query: "stockbridge" }).map((s) => s.request.id),
    ).toEqual(["r3", "r9"]);
    expect(
      filterRequests(summaries(), { ...all, query: "DRIVING" }).map((s) => s.request.id),
    ).toEqual(["r2", "r8"]);
  });

  it("filters by status and task type", () => {
    expect(
      filterRequests(summaries(), { ...all, status: "completed" }).map((s) => s.request.id),
    ).toEqual(["r7", "r8", "r9"]);
    expect(
      filterRequests(summaries(), { ...all, taskType: "Admin" }).map((s) => s.request.id),
    ).toEqual(["r5"]);
  });

  it("sorts by title both ways", () => {
    const asc = sortRequests(summaries(), "title", "asc").map((s) => s.request.title);
    expect(asc).toEqual([...asc].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
    expect(sortRequests(summaries(), "title", "desc").map((s) => s.request.title)).toEqual(
      [...asc].reverse(),
    );
  });
});

describe("dashboard", () => {
  it("builds the to-do list", () => {
    const todos = charityTodos(fixtures, NOW);
    expect(todos.attendance).toBe(2);
    expect(todos.drafts).toHaveLength(0);
    expect(todos.needVolunteers.length).toBeGreaterThan(0);
    expect(todos.needVolunteers.every((t) => t.session.filled < t.session.needed)).toBe(true);
  });

  it("lists upcoming sessions soonest first", () => {
    const starts = upcomingSessions(fixtures, 14, NOW).map((s) => s.session.occurrence.start);
    expect(starts).toEqual([...starts].sort());
    expect(starts[0]).toBe("2026-11-16T09:00:00Z");
  });
});

describe("charity actions (mock API)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    resetMockData();
  });

  const draft = () =>
    createRequest({
      title: "Help at the coffee morning",
      description: "Serve tea and coffee and chat with visitors.",
      taskType: "Events",
      postcode: "EH6 5AB",
      location: "Leith Community Hall",
      coordinates: { lat: 55.973, lng: -3.175 },
      carNeeded: false,
      requirements: { dbs: false, minimumAge: 18, physicalWork: false },
      volunteersNeeded: 2,
      status: "draft",
      schedule: "one-off",
      occurrences: [{ start: "2026-11-25T10:00:00Z", end: "2026-11-25T12:00:00Z" }],
    });

  it("publishes a draft", async () => {
    const created = await draft();
    expect((await publishRequest(created.id)).status).toBe("open");
    await expect(publishRequest(created.id)).rejects.toThrow("Only drafts");
  });

  it("cancels a request, releasing volunteers with no penalty", async () => {
    const before = pointsBalance(await getSnapshot(), "v1");
    const cancelled = await cancelRequest("r4", { reasonId: "venue", message: " Hall flooded " });
    expect(cancelled).toMatchObject({
      status: "cancelled",
      cancellation: { reasonId: "venue", message: "Hall flooded" },
    });
    const data = await getSnapshot();
    const k1 = data.commitments.find((c) => c.id === "k1");
    expect(k1).toMatchObject({
      status: "cancelled",
      cancellation: { byCharity: true, penalised: false },
    });
    expect(pointsBalance(data, "v1")).toBe(before);
  });

  it("only completes requests whose sessions have all finished", async () => {
    await expect(completeRequest("r1")).rejects.toThrow("haven’t happened yet");
    const r = await createRequest({
      ...(await draftInput()),
      occurrences: [{ start: "2026-11-01T10:00:00Z", end: "2026-11-01T12:00:00Z" }],
    });
    expect((await completeRequest(r.id)).status).toBe("completed");
  });

  it("edits details but protects sessions people have signed up to", async () => {
    const r1 = (await getSnapshot()).requests.find((r) => r.id === "r1")!;
    const input = {
      ...(await draftInput()),
      title: "Pack winter parcels",
      status: "open" as const,
    };
    expect((await updateRequest("r1", input, { replaceSessions: false })).title).toBe(
      "Pack winter parcels",
    );
    await expect(updateRequest("r1", input, { replaceSessions: true })).rejects.toThrow(
      "dates can’t be changed",
    );
    await expect(
      updateRequest("r1", { ...input, volunteersNeeded: 0 }, { replaceSessions: false }),
    ).rejects.toThrow("at least 1");
    expect(r1.occurrenceIds).toEqual(["o1"]);
  });

  it("moves sessions when nobody has signed up", async () => {
    const created = await draft();
    const moved = await updateRequest(
      created.id,
      {
        ...(await draftInput()),
        occurrences: [{ start: "2026-11-26T10:00:00Z", end: "2026-11-26T12:00:00Z" }],
      },
      { replaceSessions: true },
    );
    const data = await getSnapshot();
    expect(data.occurrences.filter((o) => o.requestId === moved.id).map((o) => o.start)).toEqual([
      "2026-11-26T10:00:00Z",
    ]);
  });

  it("updates the charity's contact details", async () => {
    const charity = await updateCharityDetails({
      ...fixtures.charity,
      contactName: "Morag Campbell",
      phone: "0131 496 0000",
    });
    expect(charity).toMatchObject({ contactName: "Morag Campbell", phone: "0131 496 0000" });
  });

  async function draftInput() {
    return {
      title: "Help at the coffee morning",
      description: "Serve tea and coffee and chat with visitors.",
      taskType: "Events" as const,
      postcode: "EH6 5AB",
      location: "Leith Community Hall",
      coordinates: { lat: 55.973, lng: -3.175 },
      carNeeded: false,
      requirements: { dbs: false, minimumAge: 18, physicalWork: false },
      volunteersNeeded: 2,
      status: "draft" as const,
      schedule: "one-off" as const,
      occurrences: [{ start: "2026-11-25T10:00:00Z", end: "2026-11-25T12:00:00Z" }],
    };
  }
});
