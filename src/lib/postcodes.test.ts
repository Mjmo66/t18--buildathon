import { describe, expect, it } from "vitest";
import {
  coordinatesForPostcode,
  isCoveredPostcode,
  isValidPostcode,
  normalisePostcode,
} from "./postcodes";

describe("postcodes", () => {
  it("normalises case and spacing", () => {
    expect(normalisePostcode("eh65ab")).toBe("EH6 5AB");
    expect(normalisePostcode("  EH15   2BA ")).toBe("EH15 2BA");
  });

  it("accepts full UK postcodes and rejects partial ones", () => {
    expect(isValidPostcode("EH6 5AB")).toBe(true);
    expect(isValidPostcode("SW1A 1AA")).toBe(true);
    expect(isValidPostcode("EH6")).toBe(false);
    expect(isValidPostcode("hello")).toBe(false);
  });

  it("only covers Edinburgh districts", () => {
    expect(isCoveredPostcode("EH6 5AB")).toBe(true);
    expect(isCoveredPostcode("EH17 8AA")).toBe(true);
    expect(isCoveredPostcode("G1 1AA")).toBe(false);
    expect(isCoveredPostcode("EH99 1SP")).toBe(false);
  });

  it("returns the district centre point", () => {
    expect(coordinatesForPostcode("eh6 5ab")).toEqual({ lat: 55.973, lng: -3.175 });
    expect(coordinatesForPostcode("G1 1AA")).toBeNull();
  });
});
