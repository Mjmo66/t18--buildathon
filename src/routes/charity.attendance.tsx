import { createFileRoute } from "@tanstack/react-router";
import { AttendanceScreen } from "@/features/charity/attendance-screen";
import { snapshotQuery } from "@/api/queries";
import { pageHead, RouteError, Missing } from "@/components/shared/common";
export const Route = createFileRoute("/charity/attendance")({
  head: () => pageHead("Attendance", "Confirm which volunteers came to each session."),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(snapshotQuery);
  },
  component: AttendanceScreen,
  errorComponent: RouteError,
  notFoundComponent: Missing,
});
