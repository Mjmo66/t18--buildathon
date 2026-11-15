import { useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Check, ClipboardCheck, Loader2, UserX } from "lucide-react";
import { markAttendance } from "@/api/mock-api";
import { snapshotQuery } from "@/api/queries";
import type { Commitment } from "@/api/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  SUSPEND_AT_STRIKES,
  attendanceRows,
  standingFor,
  volunteerStanding,
  type AttendanceRow,
} from "@/lib/attendance";
import { NO_SHOW_PENALTY, POINTS_PER_HOUR } from "@/lib/rewards";
import { PageHeading } from "./screens";

const when = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});
const markedOn = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/London",
});

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p.charAt(0))
    .join("");

function StandingBadge({
  commitments,
  volunteerId,
}: {
  commitments: Commitment[];
  volunteerId: string;
}) {
  const { strikes, standing } = volunteerStanding(commitments, volunteerId);
  if (standing === "good")
    return <span className="standing-badge standing-badge-good">No strikes</span>;
  return (
    <span className={`standing-badge standing-badge-${standing}`}>
      {standing === "suspended"
        ? "Suspended"
        : `${strikes.length} of ${SUSPEND_AT_STRIKES} strikes`}
    </span>
  );
}

function VolunteerCell({ row, commitments }: { row: AttendanceRow; commitments: Commitment[] }) {
  return (
    <div className="table-person">
      <span className="avatar">{initials(row.volunteer.name)}</span>
      <div>
        <div className="table-title">{row.volunteer.name}</div>
        <StandingBadge commitments={commitments} volunteerId={row.volunteer.id} />
      </div>
    </div>
  );
}

function SessionCell({ row }: { row: AttendanceRow }) {
  return (
    <>
      <div className="table-title">{row.request.title}</div>
      <div className="table-sub">
        {when.format(new Date(row.occurrence.start))} · {row.request.location}
      </div>
    </>
  );
}

export function AttendanceScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const queryClient = useQueryClient();
  const { waiting, confirmed } = attendanceRows(data);
  // The row waiting for "Didn't come" to be confirmed in the dialog.
  const [noShowRow, setNoShowRow] = useState<AttendanceRow | null>(null);

  const mark = useMutation({
    mutationFn: ({ commitmentId, attended }: { commitmentId: string; attended: boolean }) =>
      markAttendance(commitmentId, attended),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: snapshotQuery.queryKey }),
  });
  const busyId = mark.isPending ? mark.variables?.commitmentId : undefined;

  // What a no-show would do to this volunteer, for the confirmation dialog.
  const nextStrikes = noShowRow
    ? volunteerStanding(data.commitments, noShowRow.volunteer.id).strikes.length + 1
    : 0;
  const nextStanding = standingFor(nextStrikes);

  return (
    <>
      <PageHeading
        title="Attendance"
        description={`Confirm who came to each session. Volunteers earn ${POINTS_PER_HOUR} points an hour when you confirm; no-shows get a strike and lose ${NO_SHOW_PENALTY} points.`}
      />

      {mark.isError && (
        <div className="pref-alert" role="alert">
          {mark.error instanceof Error
            ? mark.error.message
            : "Couldn’t save that. Please try again."}
        </div>
      )}

      <div className="desktop-section-heading">
        <h2>Waiting for you</h2>
        <span className="muted text-xs">{waiting.length} to confirm</span>
      </div>
      {waiting.length === 0 ? (
        <div className="table-wrap attendance-empty">
          <ClipboardCheck aria-hidden="true" />
          <p>All caught up. Sessions appear here once they’ve finished.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Volunteer</th>
                <th>Session</th>
                <th className="text-right">Did they come?</th>
              </tr>
            </thead>
            <tbody>
              {waiting.map((row) => (
                <tr key={row.commitment.id}>
                  <td>
                    <VolunteerCell row={row} commitments={data.commitments} />
                  </td>
                  <td>
                    <SessionCell row={row} />
                  </td>
                  <td>
                    <div className="attendance-actions">
                      <Button
                        size="sm"
                        disabled={busyId === row.commitment.id}
                        onClick={() =>
                          mark.mutate({ commitmentId: row.commitment.id, attended: true })
                        }
                        aria-label={`${row.volunteer.name} came`}
                      >
                        {busyId === row.commitment.id ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Check />
                        )}{" "}
                        Came
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === row.commitment.id}
                        onClick={() => setNoShowRow(row)}
                        aria-label={`${row.volunteer.name} didn’t come`}
                      >
                        <UserX /> Didn’t come
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="desktop-section-heading mt-8">
        <h2>Recently confirmed</h2>
        <span className="muted text-xs">You can change a mark if it was a mistake.</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Volunteer</th>
              <th>Session</th>
              <th>Outcome</th>
              <th className="text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            {confirmed.map((row) => {
              const came = row.commitment.status === "completed";
              return (
                <tr key={row.commitment.id}>
                  <td>
                    <VolunteerCell row={row} commitments={data.commitments} />
                  </td>
                  <td>
                    <SessionCell row={row} />
                  </td>
                  <td>
                    <span className={`outcome ${came ? "outcome-came" : "outcome-no-show"}`}>
                      {came ? "Came" : "No-show · strike"}
                    </span>
                    {row.commitment.attendanceMarkedAt && (
                      <div className="table-sub">
                        Marked {markedOn.format(new Date(row.commitment.attendanceMarkedAt))}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="attendance-actions">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === row.commitment.id}
                        onClick={() =>
                          came
                            ? setNoShowRow(row)
                            : mark.mutate({ commitmentId: row.commitment.id, attended: true })
                        }
                      >
                        {came ? "Mark as no-show" : "Mark as came"}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AlertDialog open={noShowRow !== null} onOpenChange={(open) => !open && setNoShowRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {noShowRow?.volunteer.name} as a no-show?</AlertDialogTitle>
            <AlertDialogDescription>
              This gives them strike {nextStrikes} of {SUSPEND_AT_STRIKES}.{" "}
              {nextStanding === "suspended"
                ? "That’s their third strike, so they won’t be able to accept new requests until a strike expires."
                : nextStanding === "final-warning"
                  ? "They’ll get a final warning."
                  : "They’ll get a warning."}{" "}
              They’ll also lose {NO_SHOW_PENALTY} points. Strikes expire after six months.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (noShowRow)
                  mark.mutate({ commitmentId: noShowRow.commitment.id, attended: false });
                setNoShowRow(null);
              }}
            >
              Yes, mark as no-show
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
