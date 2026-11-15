import { createFileRoute } from '@tanstack/react-router';
import { ProfileScreen } from '@/features/volunteer/screens';
import { snapshotQuery } from '@/api/queries';
import { pageHead, RouteError, Missing } from '@/components/shared/common';
export const Route = createFileRoute('/volunteer/profile')({
 head: () => pageHead('Volunteer profile', 'View your verified volunteer profile and sample preferences.'),
 loader: async ({ context }) => { await context.queryClient.ensureQueryData(snapshotQuery); },
 component: ProfileScreen, errorComponent: RouteError, notFoundComponent: Missing,
});
