import { createFileRoute } from "@tanstack/react-router";
import { CreateRequestScreen } from "@/features/charity/create-request-screen";
import { snapshotQuery } from "@/api/queries";
import { pageHead, RouteError, Missing } from "@/components/shared/common";
export const Route = createFileRoute("/charity/create")({
  head: () => pageHead("Create a request", "Post a volunteering request for your charity."),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(snapshotQuery);
  },
  component: CreateRequestScreen,
  errorComponent: RouteError,
  notFoundComponent: Missing,
});
