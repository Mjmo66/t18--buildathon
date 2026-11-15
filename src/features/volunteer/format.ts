import type { Volunteer } from "@/api/types";
import { WEEK_DAYS } from "./preferences-schema";

/** "09:00" → "9am", "17:30" → "5:30pm" */
export function formatTime(value: string): string {
  const [h = 0, m = 0] = value.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, "0")}${suffix}` : `${hour}${suffix}`;
}

function joinWords(words: string[]): string {
  return words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} & ${words.at(-1)}`;
}

/** Weekly windows grouped by time, e.g. ["Tuesday & Thursday, 9am–5pm", "Saturday, 9am–6pm"]. */
export function formatWeekly(weekly: Volunteer["weeklyAvailability"]): string[] {
  const groups = new Map<string, string[]>();
  for (const { day, label } of WEEK_DAYS) {
    for (const slot of weekly.filter((w) => w.day === day)) {
      const key = `${formatTime(slot.start)}–${formatTime(slot.end)}`;
      groups.set(key, [...(groups.get(key) ?? []), label]);
    }
  }
  return [...groups].map(([times, days]) => `${joinWords(days)}, ${times}`);
}

/** "2026-11-28" → "28 November 2026" */
export function formatLongDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

export function describeCar(v: Pick<Volunteer, "hasCar" | "willingToDrive">): string {
  if (!v.hasCar) return "No car";
  return v.willingToDrive ? "Available & willing to drive" : "Has a car, prefers not to drive";
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}
