import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixtures } from "@/api/fixtures";
import { getSnapshot, markAttendance, resetMockData } from "@/api/mock-api";
import type { Commitment } from "@/api/types";
import { activeStrikes, attendanceRows, standingFor, volunteerStanding } from "./attendance";

const NOW = new Date("2026-11-15T12:00:00Z");

const noShow = (id: string, markedAt: string): Commitment => ({
  id,
  volunteerId: "v1",
  occurrenceId: "o1",
  status: "no-show",
  attendanceMarkedAt: markedAt,
});

describe("strikes", () => {
  it("moves through warning, final warning and suspended", () => {
    expect(standingFor(0)).toBe("good");
    expect(standingFor(1)).toBe("warning");
    expect(standingFor(2)).toBe("final-warning");
    expect(standingFor(3)).toBe("suspended");
    expect(standingFor(5)).toBe("suspended");
  });

  it("only counts no-shows from the last six months", () => {
    const commitments = [
      noShow("recent", "2026-11-01T10:00:00Z"),
      noShow("old", "2026-04-01T10:00:00Z"), // more than 180 days before NOW
      { ...noShow("came", "2026-11-02T10:00:00Z"), status: "completed" as const },
      { ...noShow("someone-else", "2026-11-03T10:00:00Z"), volunteerId: "v2" },
    ];
    expect(activeStrikes(commitments, "v1", NOW).map((c) => c.id)).toEqual(["recent"]);
  });

  it("gives Callum two strikes in the mock data, and Isla none", () => {
    expect(volunteerStanding(fixtures.commitments, "v6", NOW).standing).toBe("final-warning");
    const isla = volunteerStanding(fixtures.commitments, "v1", NOW);
    expect(isla.standing).toBe("good");
    expect(isla.attended).toBe(6);
  });
});

describe("attendance rows", () => {
  it("lists finished sessions waiting for confirmation and ones already confirmed", () => {
    const { waiting, confirmed } = attendanceRows(fixtures, NOW);
    expect(waiting.map((r) => r.commitment.id).sort()).toEqual(["k7", "k8"]);
    expect(confirmed.slice(0, 4).map((r) => r.commitment.id)).toEqual(["k5", "k4", "k6", "k9"]);
  });

  it("leaves out sessions that haven't finished yet", () => {
    const { waiting } = attendanceRows(fixtures, NOW);
    expect(waiting.some((r) => r.occurrence.id === "o1")).toBe(false);
  });
});

describe("markAttendance (mock API)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    resetMockData();
  });

  it("records that a volunteer came", async () => {
    const updated = await markAttendance("k7", true);
    expect(updated.status).toBe("completed");
    expect(updated.attendanceMarkedAt).toBe(NOW.toISOString());
  });

  it("a third no-show suspends Callum", async () => {
    await markAttendance("k8", false);
    const data = await getSnapshot();
    expect(volunteerStanding(data.commitments, "v6", NOW).standing).toBe("suspended");
  });

  it("changing a no-show to 'came' removes the strike", async () => {
    await markAttendance("k5", true);
    const data = await getSnapshot();
    expect(volunteerStanding(data.commitments, "v6", NOW).strikes).toHaveLength(1);
  });

  it("refuses sessions that haven't finished", async () => {
    await expect(markAttendance("k1", true)).rejects.toThrow("once the session has finished");
  });
});
