import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cancelCommitment, getSnapshot, resetMockData } from "@/api/mock-api";
import { cancelWindow, isPenalised } from "./cancellation";
import { pointsBalance, pointsLedger } from "./rewards";

const NOW = new Date("2026-11-15T12:00:00Z");

describe("cancel window", () => {
  it("is free with 24 hours or more to go", () => {
    expect(cancelWindow("2026-11-16T12:00:00Z", NOW)).toBe("free");
    expect(cancelWindow("2026-11-21T10:00:00Z", NOW)).toBe("free");
  });

  it("is late with less than 24 hours to go", () => {
    expect(cancelWindow("2026-11-16T11:59:00Z", NOW)).toBe("late");
    expect(cancelWindow("2026-11-15T12:01:00Z", NOW)).toBe("late");
  });

  it("is closed once the session has started", () => {
    expect(cancelWindow("2026-11-15T12:00:00Z", NOW)).toBe("started");
    expect(cancelWindow("2026-11-15T09:00:00Z", NOW)).toBe("started");
  });
});

describe("penalties", () => {
  it("never penalises free cancellations", () => {
    expect(isPenalised("free")).toBe(false);
    expect(isPenalised("free", "forgot")).toBe(false);
  });

  it("excuses accepted reasons when late", () => {
    for (const reason of ["illness", "emergency", "bereavement", "disruption"]) {
      expect(isPenalised("late", reason)).toBe(false);
    }
  });

  it("penalises other reasons when late", () => {
    for (const reason of ["work", "other-plans", "forgot", undefined]) {
      expect(isPenalised("late", reason)).toBe(true);
    }
  });
});

describe("cancelCommitment (mock API)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    resetMockData();
  });

  it("cancels a session next week for free", async () => {
    const cancelled = await cancelCommitment("v1", "k1"); // Sat 21 Nov
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancellation).toMatchObject({ late: false, penalised: false });
    expect(pointsBalance(await getSnapshot(), "v1")).toBe(100);
  });

  it("needs a reason to cancel tomorrow's session", async () => {
    await expect(cancelCommitment("v1", "k14")).rejects.toThrow("Please tell us why");
  });

  it("doesn't penalise a late cancellation for illness", async () => {
    const cancelled = await cancelCommitment("v1", "k14", { reasonId: "illness", note: "  Flu  " });
    expect(cancelled.cancellation).toMatchObject({
      late: true,
      penalised: false,
      reasonId: "illness",
      note: "Flu",
    });
    expect(pointsBalance(await getSnapshot(), "v1")).toBe(100);
  });

  it("takes 10 points for a late cancellation because something else came up", async () => {
    await cancelCommitment("v1", "k14", { reasonId: "other-plans" });
    const data = await getSnapshot();
    expect(pointsBalance(data, "v1")).toBe(90);
    expect(pointsLedger(data, "v1")[0]).toMatchObject({ kind: "penalty", points: -10 });
  });

  it("frees the spot for someone else", async () => {
    await cancelCommitment("v1", "k1");
    const data = await getSnapshot();
    expect(
      data.commitments.filter((c) => c.occurrenceId === "o4" && c.status === "accepted"),
    ).toHaveLength(0);
  });

  it("refuses sessions that have started, and other people's commitments", async () => {
    await expect(cancelCommitment("v1", "k7")).rejects.toThrow("already started");
    await expect(cancelCommitment("v1", "k2")).rejects.toThrow("not found");
  });
});
