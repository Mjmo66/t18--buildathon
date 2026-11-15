import { afterEach, describe, expect, it } from "vitest";
import { fixtures } from "./fixtures";
import {
  getCharity,
  getSnapshot,
  getVolunteer,
  resetMockData,
  setAvailable,
  updatePreferences,
} from "./mock-api";

afterEach(() => resetMockData());

describe("mock dataset rules", () => {
  it("contains exactly one fictional Edinburgh charity for all requests", async () => {
    const data = await getSnapshot();
    expect(new Set(data.requests.map((r) => r.charityId))).toEqual(new Set([data.charity.id]));
    expect((await getCharity()).address).toContain("Edinburgh");
  });
  it("returns independent copies so screen changes cannot mutate the fixtures", async () => {
    const first = await getSnapshot();
    first.charity.name = "Changed";
    expect((await getSnapshot()).charity.name).toBe("Thistle Community Care");
  });
});

describe("volunteer updates", () => {
  it("switches a volunteer ON and OFF", async () => {
    await setAvailable("v1", false);
    expect((await getVolunteer("v1"))?.available).toBe(false);
    await setAvailable("v1", true);
    expect((await getVolunteer("v1"))?.available).toBe(true);
  });

  it("saves preferences without touching other volunteers or the fixtures", async () => {
    const before = (await getVolunteer("v1"))!;
    await updatePreferences("v1", {
      ...before,
      maxDistanceMiles: 3,
      canDo: ["Admin"],
      cannotDo: ["Driving"],
    });
    const after = await getVolunteer("v1");
    expect(after?.maxDistanceMiles).toBe(3);
    expect(after?.canDo).toEqual(["Admin"]);
    expect((await getVolunteer("v6"))?.maxDistanceMiles).toBe(10);
    expect(fixtures.volunteers[0]?.maxDistanceMiles).toBe(10);
  });

  it("rejects an unknown volunteer", async () => {
    await expect(setAvailable("nobody", true)).rejects.toThrow("not found");
  });
});
