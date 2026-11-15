import { createFileRoute } from '@tanstack/react-router';
import { UnfilledScreen } from '@/features/admin/screens';
import { snapshotQuery } from '@/api/queries';
import { pageHead, RouteError, Missing } from '@/components/shared/common';
export const Route = createFileRoute('/admin/unfilled')({
 head: () => pageHead('Unfilled requests', 'See open charity requests awaiting their first volunteer.'),
 loader: async ({ context }) => { await context.queryClient.ensureQueryData(snapshotQuery); },
 component: UnfilledScreen, errorComponent: RouteError, notFoundComponent: Missing,
});
