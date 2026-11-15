import { Compass } from 'lucide-react';
import { Button, EmptyState } from '../components/ui/index.js';

export default function NotFound() {
  return (
    <EmptyState icon={<Compass size={22} strokeWidth={1.75} />} title="Page not found" action={<Button to="/">Go home</Button>} />
  );
}
