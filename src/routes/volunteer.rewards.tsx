import { createFileRoute } from "@tanstack/react-router";
import { RewardsScreen } from "@/features/volunteer/rewards-screen";
import { snapshotQuery } from "@/api/queries";
import { pageHead, RouteError, Missing } from "@/components/shared/common";
export const Route = createFileRoute("/volunteer/rewards")({
  head: () => pageHead("Rewards", "Your points, rewards and badges."),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(snapshotQuery);
  },
  component: RewardsScreen,
  errorComponent: RouteError,
  notFoundComponent: Missing,
});
