import { afterEach, describe, expect, it } from "vitest";
import { getSnapshot, createRequest, resetMockData } from "@/api/mock-api";
import { fixtures } from "@/api/fixtures";
import { londonToUtcIso } from "@/lib/london-time";
import {
  createRequestSchema,
  emptyRequestForm,
  sessionDates,
  toNewRequest,
  type RequestFormValues,
} from "./request-schema";

const NOW = new Date("2026-11-15T12:00:00Z"); // Sunday 15 Nov 2026, 12:00 in London
const schema = createRequestSchema(NOW);

const valid = (overrides: Partial<RequestFormValues> = {}): RequestFormValues => ({
  ...emptyRequestForm("EH6 5AB"),
  title: "Pack winter food parcels",
  taskType: "Food bank",
  description: "Sort donations and pack parcels for families across Leith.",
  date: "2026-11-17",
  location: "Leith Community Hall",
  ...overrides,
});

const errorAt = (values: RequestFormValues, path: string) => {
  const result = schema.safeParse(values);
  return result.success
    ? undefined
    : result.error.issues.find((i) => i.path.join(".") === path)?.message;
};

afterEach(() => resetMockData());

describe("create request validation", () => {
  it("accepts a complete one-off request", () => {
    expect(schema.safeParse(valid()).success).toBe(true);
  });

  it("needs the basics", () => {
    const empty = emptyRequestForm("EH6 5AB");
    expect(errorAt(empty, "title")).toBe("Give the request a title of at least 5 characters");
    expect(errorAt(empty, "taskType")).toBe("Choose a task type");
    expect(errorAt(empty, "description")).toBe(
      "Tell volunteers a bit more (at least 20 characters)",
    );
    expect(errorAt(empty, "date")).toBe("Choose a date");
    expect(errorAt(empty, "location")).toBe("Say where volunteers should go");
  });

  it("checks numbers", () => {
    expect(errorAt(valid({ volunteersNeeded: 0 }), "volunteersNeeded")).toBe(
      "You need at least 1 volunteer",
    );
    expect(errorAt(valid({ volunteersNeeded: Number.NaN }), "volunteersNeeded")).toBe(
      "Enter how many volunteers you need",
    );
    expect(errorAt(valid({ durationHours: 1.25 }), "durationHours")).toBe(
      "Use half-hour steps, like 1.5",
    );
    expect(errorAt(valid({ minimumAge: 14 }), "minimumAge")).toBe("Volunteers must be at least 16");
  });

  it("needs a covered Edinburgh postcode", () => {
    expect(errorAt(valid({ postcode: "G1 1AA" }), "postcode")).toMatch(/only covers Edinburgh/);
  });

  it("does not allow past dates or earlier times today", () => {
    expect(errorAt(valid({ date: "2026-11-14" }), "date")).toBe("Choose today or a later date");
    expect(errorAt(valid({ date: "2026-11-15", startTime: "11:00" }), "startTime")).toBe(
      "Choose a time later today",
    );
    expect(schema.safeParse(valid({ date: "2026-11-15", startTime: "15:00" })).success).toBe(true);
  });

  it("must finish by midnight", () => {
    expect(errorAt(valid({ startTime: "20:00", durationHours: 5 }), "durationHours")).toBe(
      "It needs to finish by midnight",
    );
  });

  it("checks the end date of weekly requests", () => {
    const weekly = (repeatUntil: string) => valid({ schedule: "weekly", repeatUntil });
    expect(errorAt(weekly(""), "repeatUntil")).toBe("Choose when the weekly sessions end");
    expect(errorAt(weekly("2026-11-20"), "repeatUntil")).toBe(
      "Choose a date at least a week after the first session",
    );
    expect(errorAt(weekly("2027-12-01"), "repeatUntil")).toBe(
      "Weekly requests can run for up to six months",
    );
    expect(schema.safeParse(weekly("2026-12-08")).success).toBe(true);
  });
});

describe("sessions", () => {
  it("is one session for a one-off request", () => {
    expect(sessionDates(valid())).toEqual(["2026-11-17"]);
  });

  it("repeats every 7 days up to and including the end date", () => {
    expect(sessionDates(valid({ schedule: "weekly", repeatUntil: "2026-12-08" }))).toEqual([
      "2026-11-17",
      "2026-11-24",
      "2026-12-01",
      "2026-12-08",
    ]);
  });

  it("converts UK local time to UTC, including summer time", () => {
    expect(londonToUtcIso("2026-11-17", "10:00")).toBe("2026-11-17T10:00:00.000Z");
    expect(londonToUtcIso("2027-06-01", "10:00")).toBe("2027-06-01T09:00:00.000Z");
  });

  it("builds the API payload", () => {
    const request = toNewRequest(
      valid({ postcode: "eh15 2ba", durationHours: 1.5, dbs: true }),
      "open",
    );
    expect(request.postcode).toBe("EH15 2BA");
    expect(request.coordinates).toEqual({ lat: 55.95, lng: -3.11 });
    expect(request.requirements).toEqual({ dbs: true, minimumAge: 18, physicalWork: false });
    expect(request.occurrences).toEqual([
      { start: "2026-11-17T10:00:00.000Z", end: "2026-11-17T11:30:00.000Z" },
    ]);
  });
});

describe("createRequest (mock API)", () => {
  it("adds the request and one occurrence per session", async () => {
    const created = await createRequest(
      toNewRequest(valid({ schedule: "weekly", repeatUntil: "2026-12-01" }), "open"),
    );
    const data = await getSnapshot();
    expect(created.id).toBe(`r${fixtures.requests.length + 1}`);
    expect(created.occurrenceIds).toHaveLength(3);
    expect(new Set(created.occurrenceIds).size).toBe(3);
    expect(data.requests[0]?.id).toBe(created.id);
    expect(data.occurrences.filter((o) => o.requestId === created.id)).toHaveLength(3);
    expect(created.charityId).toBe(data.charity.id);
    expect(created.distanceMiles).toBe(0); // same district as the demo volunteer
  });

  it("saves drafts with draft status and leaves the fixtures alone", async () => {
    const created = await createRequest(toNewRequest(valid(), "draft"));
    expect(created.status).toBe("draft");
    expect(fixtures.requests.some((r) => r.id === created.id)).toBe(false);
  });
});
