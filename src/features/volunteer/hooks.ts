import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  acceptRequest,
  cancelCommitment,
  redeemReward,
  setAvailable,
  submitCredential,
  updatePreferences,
} from "@/api/mock-api";
import { DEMO_VOLUNTEER_ID, snapshotQuery } from "@/api/queries";
import type { VolunteerPreferences } from "@/api/types";

/** The signed-in demo volunteer plus the full snapshot. */
export function useVolunteer() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const volunteer = data.volunteers.find((v) => v.id === DEMO_VOLUNTEER_ID);
  if (!volunteer) throw new Error("Demo volunteer is missing from the mock data");
  return { data, volunteer };
}

// Both mutations wait for the refreshed snapshot before finishing,
// so the screen never flashes the old value.
export function useSetAvailable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (available: boolean) => setAvailable(DEMO_VOLUNTEER_ID, available),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: snapshotQuery.queryKey }),
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: VolunteerPreferences) =>
      updatePreferences(DEMO_VOLUNTEER_ID, preferences),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: snapshotQuery.queryKey }),
  });
}

export function useRedeemReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rewardId: string) => redeemReward(DEMO_VOLUNTEER_ID, rewardId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: snapshotQuery.queryKey }),
  });
}

export function useCancelCommitment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      commitmentId,
      reasonId,
      note,
    }: {
      commitmentId: string;
      reasonId?: string;
      note?: string;
    }) =>
      cancelCommitment(DEMO_VOLUNTEER_ID, commitmentId, {
        ...(reasonId ? { reasonId } : {}),
        ...(note ? { note } : {}),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: snapshotQuery.queryKey }),
  });
}

export function useSubmitCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof submitCredential>[1]) =>
      submitCredential(DEMO_VOLUNTEER_ID, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: snapshotQuery.queryKey }),
  });
}

export function useAcceptRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (occurrenceId: string) => acceptRequest(DEMO_VOLUNTEER_ID, occurrenceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: snapshotQuery.queryKey }),
  });
}
