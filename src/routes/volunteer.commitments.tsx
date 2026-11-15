import { createFileRoute } from "@tanstack/react-router";
import { CommitmentsScreen } from "@/features/volunteer/commitment-screens";
import { snapshotQuery } from "@/api/queries";
import { pageHead, RouteError, Missing } from "@/components/shared/common";
export const Route = createFileRoute("/volunteer/commitments")({
  head: () => pageHead("My commitments", "Your upcoming volunteering sessions."),
  // ?accepted=<id> / ?cancelled=<id> show what just happened.
  validateSearch: (search: Record<string, unknown>): { accepted?: string; cancelled?: string } => ({
    ...(typeof search["accepted"] === "string" ? { accepted: search["accepted"] } : {}),
    ...(typeof search["cancelled"] === "string" ? { cancelled: search["cancelled"] } : {}),
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(snapshotQuery);
  },
  component: CommitmentsScreen,
  errorComponent: RouteError,
  notFoundComponent: Missing,
});
