import { createFileRoute } from '@tanstack/react-router';
import { RequestsScreen } from '@/features/charity/screens';
import { snapshotQuery } from '@/api/queries';
import { pageHead, RouteError, Missing } from '@/components/shared/common';
export const Route = createFileRoute('/charity/requests')({
 head: () => pageHead('Charity requests', 'View community requests, capacity and accepted volunteers.'),
 loader: async ({ context }) => { await context.queryClient.ensureQueryData(snapshotQuery); },
 component: RequestsScreen, errorComponent: RouteError, notFoundComponent: Missing,
});
