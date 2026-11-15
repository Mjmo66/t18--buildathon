import { createFileRoute } from '@tanstack/react-router';
import { DesktopShell } from '@/components/layouts/desktop-shell';
export const Route = createFileRoute('/admin')({ component: Layout });
function Layout() { return <DesktopShell role="admin"/>; }
