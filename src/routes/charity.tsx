import { createFileRoute } from '@tanstack/react-router';
import { DesktopShell } from '@/components/layouts/desktop-shell';
export const Route = createFileRoute('/charity')({ component: Layout });
function Layout() { return <DesktopShell role="charity"/>; }
