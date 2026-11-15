import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  cancelRequest,
  completeRequest,
  publishRequest,
  updateCharityDetails,
} from "@/api/mock-api";
import { snapshotQuery } from "@/api/queries";

/** Wraps a mock API call so the snapshot refreshes once it succeeds. */
function useSnapshotMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: snapshotQuery.queryKey }),
  });
}

export const usePublishRequest = () => useSnapshotMutation((id: string) => publishRequest(id));
export const useCompleteRequest = () => useSnapshotMutation((id: string) => completeRequest(id));
export const useCancelRequest = () =>
  useSnapshotMutation(
    ({ id, reasonId, message }: { id: string; reasonId: string; message?: string }) =>
      cancelRequest(id, { reasonId, ...(message ? { message } : {}) }),
  );
export const useUpdateCharityDetails = () => useSnapshotMutation(updateCharityDetails);
