import { createFileRoute } from "@tanstack/react-router";
import { RequestsScreen } from "@/features/charity/requests-screen";
import { snapshotQuery } from "@/api/queries";
import { pageHead, RouteError, Missing } from "@/components/shared/common";
export const Route = createFileRoute("/charity/requests")({
  head: () => pageHead("Charity requests", "Search, sort and manage your volunteering requests."),
  // ?created=<id> / ?updated=<id> show a confirmation and highlight the request.
  validateSearch: (search: Record<string, unknown>): { created?: string; updated?: string } => ({
    ...(typeof search["created"] === "string" ? { created: search["created"] } : {}),
    ...(typeof search["updated"] === "string" ? { updated: search["updated"] } : {}),
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(snapshotQuery);
  },
  component: RequestsScreen,
  errorComponent: RouteError,
  notFoundComponent: Missing,
});
