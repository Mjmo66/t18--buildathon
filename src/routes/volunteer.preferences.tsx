import { createFileRoute } from "@tanstack/react-router";
import { PreferencesScreen } from "@/features/volunteer/preferences-screen";
import { snapshotQuery } from "@/api/queries";
import { pageHead, RouteError, Missing } from "@/components/shared/common";
export const Route = createFileRoute("/volunteer/preferences")({
  head: () =>
    pageHead(
      "Your preferences",
      "Set your travel distance, tasks, availability and blocked dates.",
    ),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(snapshotQuery);
  },
  component: PreferencesScreen,
  errorComponent: RouteError,
  notFoundComponent: Missing,
});
