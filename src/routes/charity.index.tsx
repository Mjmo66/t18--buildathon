import { createFileRoute } from "@tanstack/react-router";
import { DashboardScreen } from "@/features/charity/dashboard-screen";
import { snapshotQuery } from "@/api/queries";
import { pageHead, RouteError, Missing } from "@/components/shared/common";
export const Route = createFileRoute("/charity/")({
  head: () => pageHead("Charity dashboard", "What needs doing, and your upcoming sessions."),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(snapshotQuery);
  },
  component: DashboardScreen,
  errorComponent: RouteError,
  notFoundComponent: Missing,
});
