import { z } from "zod";
import { TASK_TYPES, type NewRequest, type TaskType } from "@/api/types";
import { addDays, londonTimeNow, londonToUtcIso, londonToday } from "@/lib/london-time";
import { coordinatesForPostcode, normalisePostcode } from "@/lib/postcodes";
import { TIME_PATTERN, edinburghPostcode } from "@/lib/validation";

/** Weekly requests can run for up to 26 weeks (about six months). */
export const MAX_WEEKLY_SESSIONS = 26;

/** Built from a function so tests can fix "now". Dates and times are UK local time. */
export function createRequestSchema(now = new Date()) {
  return z
    .object({
      title: z
        .string()
        .trim()
        .min(5, "Give the request a title of at least 5 characters")
        .max(80, "Keep the title under 80 characters"),
      taskType: z
        .string()
        .refine((v): v is TaskType => (TASK_TYPES as string[]).includes(v), "Choose a task type"),
      volunteersNeeded: z
        .number({ invalid_type_error: "Enter how many volunteers you need" })
        .int("Use a whole number")
        .min(1, "You need at least 1 volunteer")
        .max(50, "Up to 50 volunteers per request"),
      description: z
        .string()
        .trim()
        .min(20, "Tell volunteers a bit more (at least 20 characters)")
        .max(600, "Keep the description under 600 characters"),
      date: z.string().min(1, "Choose a date"),
      startTime: z.string().regex(TIME_PATTERN, "Choose a start time"),
      durationHours: z
        .number({ invalid_type_error: "Enter how long it lasts" })
        .min(0.5, "It needs to last at least 30 minutes")
        .max(12, "It can last up to 12 hours")
        .refine((v) => Number.isInteger(v * 2), "Use half-hour steps, like 1.5"),
      schedule: z.enum(["one-off", "weekly"]),
      repeatUntil: z.string(),
      location: z
        .string()
        .trim()
        .min(3, "Say where volunteers should go")
        .max(80, "Keep the location under 80 characters"),
      postcode: edinburghPostcode("Enter the postcode volunteers should go to"),
      carNeeded: z.boolean(),
      dbs: z.boolean(),
      physicalWork: z.boolean(),
      minimumAge: z
        .number({ invalid_type_error: "Enter a minimum age" })
        .int("Use a whole number")
        .min(16, "Volunteers must be at least 16")
        .max(100, "Enter a valid age"),
    })
    .superRefine((v, ctx) => {
      const today = londonToday(now);
      if (v.date && v.date < today) {
        ctx.addIssue({ code: "custom", path: ["date"], message: "Choose today or a later date" });
      } else if (
        v.date === today &&
        TIME_PATTERN.test(v.startTime) &&
        v.startTime <= londonTimeNow(now)
      ) {
        ctx.addIssue({ code: "custom", path: ["startTime"], message: "Choose a time later today" });
      }

      if (TIME_PATTERN.test(v.startTime) && Number.isFinite(v.durationHours)) {
        const [h = 0, m = 0] = v.startTime.split(":").map(Number);
        if (h * 60 + m + v.durationHours * 60 > 24 * 60) {
          ctx.addIssue({
            code: "custom",
            path: ["durationHours"],
            message: "It needs to finish by midnight",
          });
        }
      }

      if (v.schedule === "weekly" && v.date) {
        if (!v.repeatUntil) {
          ctx.addIssue({
            code: "custom",
            path: ["repeatUntil"],
            message: "Choose when the weekly sessions end",
          });
        } else if (v.repeatUntil < addDays(v.date, 7)) {
          ctx.addIssue({
            code: "custom",
            path: ["repeatUntil"],
            message: "Choose a date at least a week after the first session",
          });
        } else if (v.repeatUntil > addDays(v.date, 7 * (MAX_WEEKLY_SESSIONS - 1))) {
          ctx.addIssue({
            code: "custom",
            path: ["repeatUntil"],
            message: "Weekly requests can run for up to six months",
          });
        }
      }
    });
}

export type RequestFormValues = z.input<ReturnType<typeof createRequestSchema>>;

export function emptyRequestForm(charityPostcode: string): RequestFormValues {
  return {
    title: "",
    taskType: "",
    volunteersNeeded: 2,
    description: "",
    date: "",
    startTime: "10:00",
    durationHours: 2,
    schedule: "one-off",
    repeatUntil: "",
    location: "",
    postcode: charityPostcode,
    carNeeded: false,
    dbs: false,
    physicalWork: false,
    minimumAge: 18,
  };
}

/** Session dates: just the first date, or every 7 days up to and including "repeat until". */
export function sessionDates(
  v: Pick<RequestFormValues, "date" | "schedule" | "repeatUntil">,
): string[] {
  if (!v.date) return [];
  if (v.schedule === "one-off" || !v.repeatUntil || v.repeatUntil < v.date) return [v.date];
  const dates: string[] = [];
  for (let d = v.date; d <= v.repeatUntil && dates.length < MAX_WEEKLY_SESSIONS; d = addDays(d, 7))
    dates.push(d);
  return dates;
}

/** Valid form values → what the API stores. Each session becomes its own occurrence. */
export function toNewRequest(v: RequestFormValues, status: NewRequest["status"]): NewRequest {
  const postcode = normalisePostcode(v.postcode);
  const coordinates = coordinatesForPostcode(postcode);
  if (!coordinates) throw new Error("Postcode is outside the covered area");
  const durationMs = v.durationHours * 60 * 60 * 1000;
  return {
    title: v.title.trim(),
    description: v.description.trim(),
    taskType: v.taskType as TaskType,
    postcode,
    location: v.location.trim(),
    coordinates,
    carNeeded: v.carNeeded,
    requirements: { dbs: v.dbs, minimumAge: v.minimumAge, physicalWork: v.physicalWork },
    volunteersNeeded: v.volunteersNeeded,
    status,
    schedule: v.schedule,
    occurrences: sessionDates(v).map((date) => {
      const start = londonToUtcIso(date, v.startTime);
      return { start, end: new Date(new Date(start).getTime() + durationMs).toISOString() };
    }),
  };
}
