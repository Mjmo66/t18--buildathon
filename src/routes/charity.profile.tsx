import { createFileRoute } from '@tanstack/react-router';
import { CharityProfileScreen } from '@/features/charity/screens';
import { snapshotQuery } from '@/api/queries';
import { pageHead, RouteError, Missing } from '@/components/shared/common';
export const Route = createFileRoute('/charity/profile')({
 head: () => pageHead('Charity profile', 'View the fictional Thistle Community Care charity profile.'),
 loader: async ({ context }) => { await context.queryClient.ensureQueryData(snapshotQuery); },
 component: CharityProfileScreen, errorComponent: RouteError, notFoundComponent: Missing,
});
