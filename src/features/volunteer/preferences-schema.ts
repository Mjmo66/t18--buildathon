import { z } from "zod";
import { TASK_TYPES, type TaskType, type Volunteer, type VolunteerPreferences } from "@/api/types";
import { coordinatesForPostcode, normalisePostcode } from "@/lib/postcodes";
import { TIME_PATTERN, edinburghPostcode } from "@/lib/validation";

/** Days in UK order, Monday first. Numbers match JavaScript's getDay() (0 = Sunday). */
export const WEEK_DAYS = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 0, label: "Sunday" },
] as const;

export const MAX_DISTANCE_RANGE = { min: 1, max: 25 } as const;

const time = z.string().regex(TIME_PATTERN, "Use a time like 09:00");
const taskType = z.enum(TASK_TYPES as [TaskType, ...TaskType[]]);

export const preferencesSchema = z
  .object({
    postcode: edinburghPostcode("Enter your home postcode"),
    age: z
      .number({ invalid_type_error: "Enter your age" })
      .int("Enter your age as a whole number")
      .min(16, "You need to be 16 or over to volunteer")
      .max(110, "Enter a valid age"),
    dbs: z.boolean(),
    physicalWork: z.boolean(),
    maxDistanceMiles: z.number().min(MAX_DISTANCE_RANGE.min).max(MAX_DISTANCE_RANGE.max),
    hasCar: z.boolean(),
    willingToDrive: z.boolean(),
    canDo: z.array(taskType).min(1, "Choose at least one thing you can help with"),
    cannotDo: z.array(taskType),
    weekly: z
      .array(
        z.object({
          day: z.number().int().min(0).max(6),
          enabled: z.boolean(),
          start: time,
          end: time,
        }),
      )
      .length(7),
    blockedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  })
  .superRefine((values, ctx) => {
    values.weekly.forEach((slot, index) => {
      if (slot.enabled && slot.end <= slot.start) {
        ctx.addIssue({
          code: "custom",
          path: ["weekly", index, "end"],
          message: "End time must be after the start time",
        });
      }
    });
    if (!values.weekly.some((slot) => slot.enabled)) {
      ctx.addIssue({
        code: "custom",
        path: ["weekly"],
        message: "Choose at least one day you’re usually free",
      });
    }
    if (values.willingToDrive && !values.hasCar) {
      ctx.addIssue({
        code: "custom",
        path: ["willingToDrive"],
        message: "You need a car to offer driving",
      });
    }
    const both = values.canDo.filter((t) => values.cannotDo.includes(t));
    if (both.length) {
      ctx.addIssue({
        code: "custom",
        path: ["cannotDo"],
        message: `${both.join(", ")} can’t be in both lists`,
      });
    }
  });

export type PreferencesFormValues = z.infer<typeof preferencesSchema>;

/** Volunteer record → form values. Days without a time window start switched off at 9am–5pm. */
export function toFormValues(volunteer: Volunteer): PreferencesFormValues {
  return {
    postcode: volunteer.postcode,
    age: volunteer.age,
    dbs: volunteer.dbs,
    physicalWork: volunteer.physicalWork,
    maxDistanceMiles: volunteer.maxDistanceMiles,
    hasCar: volunteer.hasCar,
    willingToDrive: volunteer.willingToDrive,
    canDo: [...volunteer.canDo],
    cannotDo: [...volunteer.cannotDo],
    weekly: WEEK_DAYS.map(({ day }) => {
      const slot = volunteer.weeklyAvailability.find((w) => w.day === day);
      return {
        day,
        enabled: Boolean(slot),
        start: slot?.start ?? "09:00",
        end: slot?.end ?? "17:00",
      };
    }),
    blockedDates: [...volunteer.blockedDates].sort(),
  };
}

/** Valid form values → the fields the API saves. The postcode is tidied and mapped to coordinates. */
export function toPreferences(values: PreferencesFormValues): VolunteerPreferences {
  const postcode = normalisePostcode(values.postcode);
  const coordinates = coordinatesForPostcode(postcode);
  if (!coordinates) throw new Error("Postcode is outside the covered area");
  return {
    postcode,
    coordinates,
    age: values.age,
    dbs: values.dbs,
    physicalWork: values.physicalWork,
    maxDistanceMiles: values.maxDistanceMiles,
    hasCar: values.hasCar,
    willingToDrive: values.hasCar && values.willingToDrive,
    canDo: values.canDo,
    cannotDo: values.cannotDo,
    weeklyAvailability: values.weekly
      .filter((slot) => slot.enabled)
      .map(({ day, start, end }) => ({ day, start, end })),
    blockedDates: [...values.blockedDates].sort(),
  };
}
