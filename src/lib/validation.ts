import { z } from "zod";
import { isCoveredPostcode, isValidPostcode } from "@/lib/postcodes";

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** An Edinburgh postcode, with one message at a time: empty → badly formed → outside the area. */
export function edinburghPostcode(emptyMessage: string) {
  return z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      const message = !value
        ? emptyMessage
        : !isValidPostcode(value)
          ? "Enter a full postcode, like EH6 5AB"
          : !isCoveredPostcode(value)
            ? "Kindred only covers Edinburgh (EH1 to EH17) for now"
            : null;
      if (message) ctx.addIssue({ code: "custom", message });
    });
}
