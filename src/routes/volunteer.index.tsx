import { createFileRoute } from '@tanstack/react-router';
import { BoardScreen } from '@/features/volunteer/screens';
import { snapshotQuery } from '@/api/queries';
import { pageHead, RouteError, Missing } from '@/components/shared/common';
export const Route = createFileRoute('/volunteer/')({
 head: () => pageHead('Community board', 'Explore read-only volunteering opportunities in Edinburgh.'),
 loader: async ({ context }) => { await context.queryClient.ensureQueryData(snapshotQuery); },
 component: BoardScreen, errorComponent: RouteError, notFoundComponent: Missing,
});
