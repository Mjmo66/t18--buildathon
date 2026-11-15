import { describe, expect, it } from "vitest";
import { fixtures } from "@/api/fixtures";
import { describeCar, formatLongDate, formatTime, formatWeekly, initials } from "./format";
import {
  preferencesSchema,
  toFormValues,
  toPreferences,
  type PreferencesFormValues,
} from "./preferences-schema";

const isla = fixtures.volunteers[0]!;
const valid = (): PreferencesFormValues => toFormValues(isla);
/** The first validation message at a field path like 'postcode' or 'weekly.1.end', or undefined. */
const errorAt = (values: PreferencesFormValues, path: string) => {
  const result = preferencesSchema.safeParse(values);
  return result.success
    ? undefined
    : result.error.issues.find((i) => i.path.join(".") === path)?.message;
};
const isValid = (values: PreferencesFormValues) => preferencesSchema.safeParse(values).success;

describe("preferences form values", () => {
  it("round-trips the fixture volunteer without changes", () => {
    const saved = toPreferences(preferencesSchema.parse(valid()));
    expect(saved.weeklyAvailability).toEqual(isla.weeklyAvailability);
    expect(saved.postcode).toBe(isla.postcode);
    expect(saved.coordinates).toEqual(isla.coordinates);
    expect(saved.canDo).toEqual(isla.canDo);
  });

  it("lists all seven days, Monday first, with only Isla’s days switched on", () => {
    const weekly = valid().weekly;
    expect(weekly.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(weekly.filter((d) => d.enabled).map((d) => d.day)).toEqual([2, 4, 6]);
  });

  it("tidies the postcode and updates the coordinates", () => {
    const saved = toPreferences(preferencesSchema.parse({ ...valid(), postcode: "eh152ba" }));
    expect(saved.postcode).toBe("EH15 2BA");
    expect(saved.coordinates).toEqual({ lat: 55.95, lng: -3.11 });
  });

  it('drops "willing to drive" when there is no car', () => {
    const values = preferencesSchema.parse({ ...valid(), hasCar: false, willingToDrive: false });
    expect(toPreferences(values).willingToDrive).toBe(false);
  });
});

describe("preferences validation", () => {
  it("accepts the fixture volunteer", () => {
    expect(isValid(valid())).toBe(true);
  });

  it("needs a covered Edinburgh postcode", () => {
    expect(errorAt({ ...valid(), postcode: "" }, "postcode")).toBe("Enter your home postcode");
    expect(errorAt({ ...valid(), postcode: "EH6" }, "postcode")).toBe(
      "Enter a full postcode, like EH6 5AB",
    );
    expect(errorAt({ ...valid(), postcode: "G1 1AA" }, "postcode")).toMatch(
      /only covers Edinburgh/,
    );
  });

  it("checks age", () => {
    expect(errorAt({ ...valid(), age: 15 }, "age")).toBe("You need to be 16 or over to volunteer");
    expect(errorAt({ ...valid(), age: Number.NaN }, "age")).toBe("Enter your age");
  });

  it('needs at least one task in "can do"', () => {
    expect(errorAt({ ...valid(), canDo: [] }, "canDo")).toBe(
      "Choose at least one thing you can help with",
    );
  });

  it("does not allow a task in both lists", () => {
    expect(errorAt({ ...valid(), canDo: ["Driving"], cannotDo: ["Driving"] }, "cannotDo")).toBe(
      "Driving can’t be in both lists",
    );
  });

  it("needs end times after start times", () => {
    const weekly = valid().weekly.map((d) =>
      d.day === 2 ? { ...d, start: "17:00", end: "09:00" } : d,
    );
    expect(errorAt({ ...valid(), weekly }, "weekly.1.end")).toBe(
      "End time must be after the start time",
    );
  });

  it("needs at least one available day", () => {
    const weekly = valid().weekly.map((d) => ({ ...d, enabled: false }));
    expect(errorAt({ ...valid(), weekly }, "weekly")).toBe(
      "Choose at least one day you’re usually free",
    );
  });

  it("needs a car to be willing to drive", () => {
    expect(errorAt({ ...valid(), hasCar: false, willingToDrive: true }, "willingToDrive")).toBe(
      "You need a car to offer driving",
    );
  });
});

describe("profile formatting", () => {
  it("formats times", () => {
    expect(formatTime("09:00")).toBe("9am");
    expect(formatTime("17:30")).toBe("5:30pm");
    expect(formatTime("12:00")).toBe("12pm");
    expect(formatTime("00:00")).toBe("12am");
  });

  it("groups days with the same hours", () => {
    expect(formatWeekly(isla.weeklyAvailability)).toEqual([
      "Tuesday & Thursday, 9am–5pm",
      "Saturday, 9am–6pm",
    ]);
  });

  it("formats dates, car and initials", () => {
    expect(formatLongDate("2026-11-28")).toBe("28 November 2026");
    expect(describeCar({ hasCar: true, willingToDrive: false })).toBe(
      "Has a car, prefers not to drive",
    );
    expect(initials("Isla Campbell")).toBe("IC");
  });
});
