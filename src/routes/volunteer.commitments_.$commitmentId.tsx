import { createFileRoute } from "@tanstack/react-router";
import { CommitmentDetailScreen } from "@/features/volunteer/commitment-screens";
import { snapshotQuery } from "@/api/queries";
import { pageHead, RouteError, Missing } from "@/components/shared/common";
export const Route = createFileRoute("/volunteer/commitments_/$commitmentId")({
  head: () => pageHead("Commitment", "Details of a volunteering session, and cancelling it."),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(snapshotQuery);
  },
  component: CommitmentDetail,
  errorComponent: RouteError,
  notFoundComponent: Missing,
});

function CommitmentDetail() {
  const { commitmentId } = Route.useParams();
  return <CommitmentDetailScreen commitmentId={commitmentId} />;
}
