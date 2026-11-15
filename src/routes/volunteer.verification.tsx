import { createFileRoute } from "@tanstack/react-router";
import { VerificationScreen } from "@/features/volunteer/verification-screen";
import { snapshotQuery } from "@/api/queries";
import { pageHead, RouteError, Missing } from "@/components/shared/common";
export const Route = createFileRoute("/volunteer/verification")({
  head: () => pageHead("Verification", "Your checks and certificates, verified by Kindred."),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(snapshotQuery);
  },
  component: VerificationScreen,
  errorComponent: RouteError,
  notFoundComponent: Missing,
});
