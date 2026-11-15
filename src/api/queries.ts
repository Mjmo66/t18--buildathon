import { queryOptions } from "@tanstack/react-query";
import { getSnapshot } from "./mock-api";

/** The volunteer the prototype is signed in as. */
export const DEMO_VOLUNTEER_ID = "v1";

export const snapshotQuery = queryOptions({
  queryKey: ["mock", "snapshot"],
  queryFn: getSnapshot,
  staleTime: Infinity,
});
