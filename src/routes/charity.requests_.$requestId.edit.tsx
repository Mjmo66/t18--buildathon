import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { RequestFormScreen } from "@/features/charity/create-request-screen";
import { snapshotQuery } from "@/api/queries";
import { pageHead, RouteError, Missing } from "@/components/shared/common";
export const Route = createFileRoute("/charity/requests_/$requestId/edit")({
  head: () => pageHead("Edit request", "Change the details of a volunteering request."),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(snapshotQuery);
  },
  component: EditRequest,
  errorComponent: RouteError,
  notFoundComponent: Missing,
});

function EditRequest() {
  const { requestId } = Route.useParams();
  const { data } = useSuspenseQuery(snapshotQuery);
  const request = data.requests.find((r) => r.id === requestId);
  if (!request || request.status === "cancelled" || request.status === "completed")
    return <Missing />;
  return <RequestFormScreen key={requestId} request={request} />;
}
