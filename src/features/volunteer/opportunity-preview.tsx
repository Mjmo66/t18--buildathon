import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Ban,
  CalendarDays,
  Car,
  Check,
  Clock3,
  HeartHandshake,
  Loader2,
  MapPin,
  UsersRound,
} from "lucide-react";
import type { Request, Snapshot, Volunteer } from "@/api/types";
import { Button } from "@/components/ui/button";
import { CANCELLATION_NOTICE_HOURS } from "@/lib/cancellation";
import { checkEligibility, spotsLeft, upcomingOccurrences } from "@/lib/eligibility";
import { formatSession } from "./commitments";
import { useAcceptRequest } from "./hooks";
import { TaskTag } from "./screens";
import { Sheet } from "./sheet";
import { MapLink } from "@/components/shared/map-link";

const hours = (start: string, end: string) => {
  const h = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} ${h === 1 ? "hour" : "hours"}`;
};

/** Quick look at an opportunity from the Board: accept the next session here, or open the full details. */
export function OpportunityPreview({
  request,
  data,
  volunteer,
  onClose,
}: {
  request: Request | null;
  data: Snapshot;
  volunteer: Volunteer;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const accept = useAcceptRequest();
  const sessions = request ? upcomingOccurrences(data, request) : [];
  // The session this pop-up accepts: the soonest one that still has room.
  const next = (request && sessions.find((o) => spotsLeft(data, request, o.id) > 0)) ?? sessions[0];
  const eligibility = request && next ? checkEligibility(data, volunteer, request, next) : null;
  const goingCommitment = next
    ? data.commitments.find(
        (c) =>
          c.volunteerId === volunteer.id && c.occurrenceId === next.id && c.status === "accepted",
      )
    : undefined;

  return (
    <Sheet open={request !== null} onClose={onClose} title={request?.title ?? ""}>
      {request && (
        <div className="preview">
          <div className="preview-top">
            <TaskTag task={request.taskType} />
            {eligibility?.alreadyGoing && <span className="going-chip">You’re going</span>}
          </div>
          <p className="charity-line">
            <HeartHandshake /> {data.charity.name}
          </p>
          <p className="preview-description">{request.description}</p>

          <ul className="preview-facts">
            {next ? (
              <>
                <li>
                  <CalendarDays aria-hidden="true" />
                  {formatSession(next)}
                  {sessions.length > 1 && (
                    <span className="muted"> · +{sessions.length - 1} more dates</span>
                  )}
                </li>
                <li>
                  <Clock3 aria-hidden="true" />
                  {hours(next.start, next.end)}
                </li>
              </>
            ) : (
              <li>
                <CalendarDays aria-hidden="true" />
                No upcoming sessions
              </li>
            )}
            <li>
              <MapPin aria-hidden="true" />
              <span>
                <MapLink location={request.location} postcode={request.postcode} />
                {eligibility && ` · ${eligibility.distanceMiles} miles from home`}
              </span>
            </li>
            {eligibility && (
              <li>
                <UsersRound aria-hidden="true" />
                {eligibility.spotsLeft} of {request.volunteersNeeded} spots left
              </li>
            )}
            {request.carNeeded && (
              <li>
                <Car aria-hidden="true" />
                Car needed
              </li>
            )}
          </ul>

          {eligibility && eligibility.notes.length > 0 && !goingCommitment && (
            <p className="preview-note">
              <AlertTriangle aria-hidden="true" /> {eligibility.notes[0]?.message}
            </p>
          )}
          {eligibility && !eligibility.canAccept && !goingCommitment && (
            <p className="preview-blocked">
              <Ban aria-hidden="true" /> {eligibility.blockers[0]?.message}
            </p>
          )}
          {accept.isError && <p className="pref-error">{accept.error.message}</p>}

          <div className="sheet-actions">
            {goingCommitment ? (
              <Button asChild size="lg" className="w-full">
                <Link
                  to="/volunteer/commitments/$commitmentId"
                  params={{ commitmentId: goingCommitment.id }}
                >
                  <Check /> You’re going · manage
                </Link>
              </Button>
            ) : (
              eligibility?.canAccept &&
              next && (
                <>
                  <Button
                    size="lg"
                    className="w-full"
                    disabled={accept.isPending}
                    onClick={() =>
                      accept.mutate(next.id, {
                        onSuccess: (commitment) =>
                          navigate({
                            to: "/volunteer/commitments",
                            search: { accepted: commitment.id },
                          }),
                      })
                    }
                  >
                    {accept.isPending ? <Loader2 className="animate-spin" /> : <Check />} Accept
                    this opportunity
                  </Button>
                  <p className="accept-hint">
                    {sessions.length > 1 ? `This accepts ${formatSession(next)}. ` : ""}Free
                    cancellation up to {CANCELLATION_NOTICE_HOURS} hours before.
                  </p>
                </>
              )
            )}
            <Button asChild variant="outline" className="w-full">
              <Link to="/volunteer/opportunities/$requestId" params={{ requestId: request.id }}>
                {sessions.length > 1 ? "See all dates and details" : "See full details"}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
