import { Link } from "@tanstack/react-router";
import { Ban, CalendarDays, Car, Clock3, HeartHandshake, MapPin, UsersRound } from "lucide-react";
import type { Request, Snapshot, Volunteer } from "@/api/types";
import { Button } from "@/components/ui/button";
import { checkEligibility, upcomingOccurrences } from "@/lib/eligibility";
import { formatSession } from "./commitments";
import { TaskTag } from "./screens";
import { Sheet } from "./sheet";

const hours = (start: string, end: string) => {
  const h = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} ${h === 1 ? "hour" : "hours"}`;
};

/** Quick look at an opportunity from the Board, with a button to the full details. */
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
  const sessions = request ? upcomingOccurrences(data, request) : [];
  const next = sessions[0];
  const eligibility = request && next ? checkEligibility(data, volunteer, request, next) : null;

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
              {request.location}
              {eligibility && ` · ${eligibility.distanceMiles} miles from home`}
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

          {eligibility && !eligibility.canAccept && !eligibility.alreadyGoing && (
            <p className="preview-blocked">
              <Ban aria-hidden="true" /> {eligibility.blockers[0]?.message}
            </p>
          )}

          <div className="sheet-actions">
            <Button asChild size="lg" className="w-full">
              <Link to="/volunteer/opportunities/$requestId" params={{ requestId: request.id }}>
                View opportunity
              </Link>
            </Button>
            <Button variant="ghost" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
