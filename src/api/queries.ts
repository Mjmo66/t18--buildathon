import { queryOptions } from '@tanstack/react-query';
import { getSnapshot } from './mock-api';
export const snapshotQuery = queryOptions({ queryKey: ['mock', 'snapshot'], queryFn: getSnapshot, staleTime: Infinity });
