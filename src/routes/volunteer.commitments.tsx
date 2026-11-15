import { createFileRoute } from '@tanstack/react-router';
import { CommitmentsScreen } from '@/features/volunteer/screens';
import { snapshotQuery } from '@/api/queries';
import { pageHead, RouteError, Missing } from '@/components/shared/common';
export const Route = createFileRoute('/volunteer/commitments')({
 head: () => pageHead('My commitments', 'See Isla’s upcoming mock volunteering commitments.'),
 loader: async ({ context }) => { await context.queryClient.ensureQueryData(snapshotQuery); },
 component: CommitmentsScreen, errorComponent: RouteError, notFoundComponent: Missing,
});
