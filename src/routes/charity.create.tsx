import { createFileRoute } from '@tanstack/react-router';
import { CreateRequestScreen } from '@/features/charity/screens';
import { snapshotQuery } from '@/api/queries';
import { pageHead, RouteError, Missing } from '@/components/shared/common';
export const Route = createFileRoute('/charity/create')({
 head: () => pageHead('Create a request', 'Preview a charity volunteering request form.'),
 loader: async ({ context }) => { await context.queryClient.ensureQueryData(snapshotQuery); },
 component: CreateRequestScreen, errorComponent: RouteError, notFoundComponent: Missing,
});
