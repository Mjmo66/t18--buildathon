// Requests are entered in UK local time and stored as UTC ISO strings.

const LONDON = "Europe/London";

function londonParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** "2026-11-17" + "10:00" in London → UTC ISO string (handles GMT/BST). */
export function londonToUtcIso(date: string, time: string): string {
  const [y = 0, mo = 1, d = 1] = date.split("-").map(Number);
  const [h = 0, mi = 0] = time.split(":").map(Number);
  const asIfUtc = Date.UTC(y, mo - 1, d, h, mi);
  const shown = londonParts(new Date(asIfUtc));
  const offset =
    Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute) - asIfUtc;
  return new Date(asIfUtc - offset).toISOString();
}

/** Today's date in London as "YYYY-MM-DD". */
export function londonToday(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: LONDON });
}

/** The current London time as "HH:mm". */
export function londonTimeNow(now = new Date()): string {
  const { hour, minute } = londonParts(now);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Add whole days to a "YYYY-MM-DD" date. */
export function addDays(date: string, days: number): string {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
