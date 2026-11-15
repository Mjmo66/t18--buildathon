import { createFileRoute } from '@tanstack/react-router';
import { VerificationsScreen } from '@/features/admin/screens';
import { snapshotQuery } from '@/api/queries';
import { pageHead, RouteError, Missing } from '@/components/shared/common';
export const Route = createFileRoute('/admin/')({
 head: () => pageHead('Pending verifications', 'Review mock volunteer and charity verification applications.'),
 loader: async ({ context }) => { await context.queryClient.ensureQueryData(snapshotQuery); },
 component: VerificationsScreen, errorComponent: RouteError, notFoundComponent: Missing,
});
