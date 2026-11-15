import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixtures } from "@/api/fixtures";
import { getSnapshot, markAttendance, redeemReward, resetMockData } from "@/api/mock-api";
import {
  badgesFor,
  hoursVolunteered,
  nextReward,
  pointsBalance,
  pointsLedger,
  REWARDS,
} from "./rewards";

const NOW = new Date("2026-11-15T12:00:00Z");
const earned = (id: string) => badgesFor(fixtures, "v1").find((b) => b.id === id)?.earned;

describe("points", () => {
  it("gives Isla 10 points per hour for her 10 confirmed hours", () => {
    expect(hoursVolunteered(fixtures, "v1")).toBe(10);
    expect(pointsBalance(fixtures, "v1")).toBe(100);
  });

  it("takes 20 points off for each of Callum's no-shows", () => {
    // Callum has no attended sessions and two no-shows.
    expect(pointsBalance(fixtures, "v6")).toBe(-40);
    expect(
      pointsLedger(fixtures, "v6").every((e) => e.kind === "penalty" && e.points === -20),
    ).toBe(true);
  });

  it("lists the newest change first", () => {
    const ledger = pointsLedger(fixtures, "v1");
    expect(ledger[0]?.label).toBe("Sort donations at the warehouse");
    expect(ledger.map((e) => e.date)).toEqual([...ledger.map((e) => e.date)].sort().reverse());
  });

  it("points to the next reward to aim for", () => {
    expect(nextReward(40)).toEqual({ reward: REWARDS[0], pointsNeeded: 20 });
    expect(nextReward(-40)?.pointsNeeded).toBe(60);
    expect(nextReward(500)).toBeNull();
  });
});

describe("badges", () => {
  it("awards Isla the badges she has earned", () => {
    expect(earned("first")).toBe(true);
    expect(earned("five")).toBe(true); // 6 sessions
    expect(earned("reliable")).toBe(true); // no no-shows
    expect(earned("ten-hours")).toBe(true);
    expect(earned("driver")).toBe(true);
    expect(earned("all-rounder")).toBe(true); // food bank, driving, befriending
  });

  it("shows progress on badges still to earn", () => {
    const badge = badgesFor(fixtures, "v1").find((b) => b.id === "twenty-five-hours");
    expect(badge).toMatchObject({ earned: false, progress: { current: 10, target: 25 } });
  });

  it("resets the Reliable streak after a no-show", () => {
    expect(badgesFor(fixtures, "v6").find((b) => b.id === "reliable")?.progress.current).toBe(0);
  });
});

describe("redeeming rewards (mock API)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    resetMockData();
  });

  it("swaps points for a Costa drink and gives a voucher code", async () => {
    const redemption = await redeemReward("v1", "costa-drink");
    expect(redemption.code).toMatch(/^COSTA-[A-Z0-9]{4}$/);
    expect(pointsBalance(await getSnapshot(), "v1")).toBe(40);
  });

  it("refuses a reward the volunteer can't afford", async () => {
    await expect(redeemReward("v1", "costa-10")).rejects.toThrow("You need 80 more points");
    await expect(redeemReward("v6", "costa-drink")).rejects.toThrow("You need 60 more points");
  });

  it("a no-show costs points as well as a strike", async () => {
    await markAttendance("k7", false); // Isla misses the 11 Nov session
    expect(pointsBalance(await getSnapshot(), "v1")).toBe(80);
  });
});
