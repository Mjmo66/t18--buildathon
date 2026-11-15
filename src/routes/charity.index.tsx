import { createFileRoute } from '@tanstack/react-router';
import { DashboardScreen } from '@/features/charity/screens';
import { snapshotQuery } from '@/api/queries';
import { pageHead, RouteError, Missing } from '@/components/shared/common';
export const Route = createFileRoute('/charity/')({
 head: () => pageHead('Charity dashboard', 'An overview of Thistle Community Care’s requests and volunteers.'),
 loader: async ({ context }) => { await context.queryClient.ensureQueryData(snapshotQuery); },
 component: DashboardScreen, errorComponent: RouteError, notFoundComponent: Missing,
});
