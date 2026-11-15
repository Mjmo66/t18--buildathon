import { createFileRoute } from "@tanstack/react-router";
import { OpportunityScreen } from "@/features/volunteer/opportunity-screen";
import { snapshotQuery } from "@/api/queries";
import { pageHead, RouteError, Missing } from "@/components/shared/common";
export const Route = createFileRoute("/volunteer/opportunities/$requestId")({
  head: () => pageHead("Opportunity", "Details of a volunteering opportunity, and accepting it."),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(snapshotQuery);
  },
  component: Opportunity,
  errorComponent: RouteError,
  notFoundComponent: Missing,
});

function Opportunity() {
  const { requestId } = Route.useParams();
  // key: reset the chosen session when moving between opportunities.
  return <OpportunityScreen key={requestId} requestId={requestId} />;
}
