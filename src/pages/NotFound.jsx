import { Button, EmptyState } from '../components/ui/index.js';

export default function NotFound() {
  return (
    <EmptyState icon="🧭" title="Page not found" action={<Button to="/">Go home</Button>} />
  );
}
