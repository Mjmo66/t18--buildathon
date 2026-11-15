import { describe, expect, it } from "vitest";
import { googleMapsUrl } from "./maps";

describe("googleMapsUrl", () => {
  it("searches Google Maps for the place and postcode", () => {
    expect(googleMapsUrl("Leith Community Hall", "EH6 5AB")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Leith%20Community%20Hall%2C%20EH6%205AB%2C%20UK",
    );
  });

  it("encodes characters like &", () => {
    expect(googleMapsUrl("Leith & Newhaven")).toContain("query=Leith%20%26%20Newhaven%2C%20UK");
  });
});
