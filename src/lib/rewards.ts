// Points, rewards and badges. Pure functions over the snapshot, so they can move to a backend later.
import type { Snapshot } from "@/api/types";
import { LATE_CANCEL_PENALTY } from "@/lib/cancellation";

export const POINTS_PER_HOUR = 10;
/** Points lost for a no-show, on top of the strike. */
export const NO_SHOW_PENALTY = 20;

export interface Reward {
  id: string;
  name: string;
  description: string;
  points: number;
  brand: "costa" | "greggs";
  /** Prefix for the demo voucher code. */
  codePrefix: string;
}

export const REWARDS: Reward[] = [
  {
    id: "costa-drink",
    name: "Costa Coffee drink",
    description: "Any regular hot or cold drink.",
    points: 60,
    brand: "costa",
    codePrefix: "COSTA",
  },
  {
    id: "greggs-5",
    name: "£5 Greggs gift card",
    description: "Spend it on whatever you fancy.",
    points: 100,
    brand: "greggs",
    codePrefix: "GREGGS",
  },
  {
    id: "costa-10",
    name: "£10 Costa gift card",
    description: "Treat yourself and a friend.",
    points: 180,
    brand: "costa",
    codePrefix: "COSTA",
  },
];

export const hoursForPoints = (points: number) => points / POINTS_PER_HOUR;

export interface PointsEntry {
  id: string;
  kind: "earned" | "penalty" | "redeemed";
  label: string;
  /** Positive for earned, negative for penalties and redemptions. */
  points: number;
  date: string;
}

interface Session {
  title: string;
  taskType: string;
  start: string;
  hours: number;
  status: "completed" | "no-show";
  markedAt: string;
}

/** Sessions the charity has confirmed for this volunteer, newest first. */
function confirmedSessions(data: Snapshot, volunteerId: string): Session[] {
  const sessions: Session[] = [];
  for (const c of data.commitments) {
    if (c.volunteerId !== volunteerId || (c.status !== "completed" && c.status !== "no-show"))
      continue;
    const occurrence = data.occurrences.find((o) => o.id === c.occurrenceId);
    const request = occurrence && data.requests.find((r) => r.id === occurrence.requestId);
    if (!occurrence || !request) continue;
    const hours =
      (new Date(occurrence.end).getTime() - new Date(occurrence.start).getTime()) / 3_600_000;
    sessions.push({
      title: request.title,
      taskType: request.taskType,
      start: occurrence.start,
      hours,
      status: c.status,
      markedAt: c.attendanceMarkedAt ?? occurrence.end,
    });
  }
  return sessions.sort((a, b) => b.start.localeCompare(a.start));
}

/** Every points change for a volunteer, newest first. */
export function pointsLedger(data: Snapshot, volunteerId: string): PointsEntry[] {
  const entries: PointsEntry[] = confirmedSessions(data, volunteerId).map((s, i) =>
    s.status === "completed"
      ? {
          id: `s${i}`,
          kind: "earned",
          label: s.title,
          points: Math.round(s.hours * POINTS_PER_HOUR),
          date: s.start,
        }
      : {
          id: `s${i}`,
          kind: "penalty",
          label: `Missed: ${s.title}`,
          points: -NO_SHOW_PENALTY,
          date: s.markedAt,
        },
  );
  for (const c of data.commitments) {
    if (c.volunteerId !== volunteerId || !c.cancellation?.penalised) continue;
    const occurrence = data.occurrences.find((o) => o.id === c.occurrenceId);
    const request = occurrence && data.requests.find((r) => r.id === occurrence.requestId);
    entries.push({
      id: `${c.id}-late`,
      kind: "penalty",
      label: `Late cancellation: ${request?.title ?? "a session"}`,
      points: -LATE_CANCEL_PENALTY,
      date: c.cancellation.cancelledAt,
    });
  }
  for (const r of data.redemptions.filter((x) => x.volunteerId === volunteerId)) {
    const reward = REWARDS.find((w) => w.id === r.rewardId);
    entries.push({
      id: r.id,
      kind: "redeemed",
      label: `Redeemed: ${reward?.name ?? "Reward"}`,
      points: -r.points,
      date: r.redeemedAt,
    });
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

/** Current balance. Penalties can take it below zero. */
export function pointsBalance(data: Snapshot, volunteerId: string): number {
  return pointsLedger(data, volunteerId).reduce((sum, e) => sum + e.points, 0);
}

export function hoursVolunteered(data: Snapshot, volunteerId: string): number {
  return confirmedSessions(data, volunteerId)
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + s.hours, 0);
}

/** The cheapest reward the volunteer can't afford yet, and how many points they need. */
export function nextReward(balance: number) {
  const reward = [...REWARDS].sort((a, b) => a.points - b.points).find((r) => r.points > balance);
  return reward ? { reward, pointsNeeded: reward.points - Math.max(0, balance) } : null;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: "hand" | "five" | "clock" | "trophy" | "shield" | "car" | "sparkles";
  earned: boolean;
  progress: { current: number; target: number };
}

export function badgesFor(data: Snapshot, volunteerId: string): Badge[] {
  const sessions = confirmedSessions(data, volunteerId);
  const attended = sessions.filter((s) => s.status === "completed");
  const hours = attended.reduce((sum, s) => sum + s.hours, 0);
  // Sessions attended in a row, counting back from the most recent.
  const streakEnd = sessions.findIndex((s) => s.status === "no-show");
  const streak = streakEnd === -1 ? sessions.length : streakEnd;
  const taskTypes = new Set(attended.map((s) => s.taskType)).size;
  const drove = attended.some((s) => s.taskType === "Driving") ? 1 : 0;

  const badge = (
    id: string,
    name: string,
    description: string,
    icon: Badge["icon"],
    current: number,
    target: number,
  ): Badge => ({
    id,
    name,
    description,
    icon,
    earned: current >= target,
    progress: { current: Math.min(current, target), target },
  });

  return [
    badge("first", "First helping hand", "Attend your first session", "hand", attended.length, 1),
    badge("five", "High five", "Attend 5 sessions", "five", attended.length, 5),
    badge("reliable", "Reliable", "Attend 5 sessions in a row", "shield", streak, 5),
    badge("ten-hours", "10 hours", "Volunteer for 10 hours", "clock", hours, 10),
    badge("driver", "On the road", "Help with a driving task", "car", drove, 1),
    badge(
      "all-rounder",
      "All-rounder",
      "Help with 3 different kinds of task",
      "sparkles",
      taskTypes,
      3,
    ),
    badge("twenty-five-hours", "25 hours", "Volunteer for 25 hours", "trophy", hours, 25),
  ];
}
