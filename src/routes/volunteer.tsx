import { createFileRoute } from '@tanstack/react-router';
import { VolunteerShell } from '@/components/layouts/volunteer-shell';
export const Route = createFileRoute('/volunteer')({ component: Layout });
function Layout() { return <VolunteerShell/>; }
