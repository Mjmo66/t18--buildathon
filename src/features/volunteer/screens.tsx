import { useCallback, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import {
  Sparkles,
  CalendarDays,
  Clock3,
  MapPin,
  Car,
  Check,
  LockKeyhole,
  HeartHandshake,
  CalendarCheck2,
  Moon,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import { DEMO_VOLUNTEER_ID, snapshotQuery } from "@/api/queries";
import type { Snapshot, Request } from "@/api/types";
import { Status, filledSpots, requestDate } from "@/components/shared/common";
import { Button } from "@/components/ui/button";
import communityImage from "@/assets/community-volunteers.jpg";
import { AvailabilityToggle } from "./availability-toggle";
import { describeCar, formatLongDate, formatWeekly, initials } from "./format";
import { useVolunteer } from "./hooks";
import { ReliabilitySection, StandingBanner } from "./reliability";
import { PointsCard } from "./points-card";
import { OpportunityPreview } from "./opportunity-preview";
export function TaskTag({ task }: { task: string }) {
  return (
    <span className={`task-tag task-tag-${task.toLowerCase().replace(" ", "-")}`}>{task}</span>
  );
}
function Opportunity({
  request,
  data,
  commitment = false,
  going = false,
}: {
  request: Request;
  data: Snapshot;
  commitment?: boolean;
  going?: boolean;
}) {
  const when = requestDate(data, request);
  const left = request.volunteersNeeded - filledSpots(data, request);
  return (
    <article className="opportunity">
      <div className="opportunity-top">
        <TaskTag task={request.taskType} />
        {commitment ? (
          <Status status="verified" />
        ) : going ? (
          <span className="going-chip">You’re going</span>
        ) : (
          <span className="spots">
            {left} {left === 1 ? "spot" : "spots"} left
          </span>
        )}
      </div>
      <h3>{request.title}</h3>
      <p className="charity-line">
        <HeartHandshake /> {data.charity.name}
      </p>
      <div className="opportunity-details">
        <span>
          <CalendarDays />
          {when.date}
        </span>
        <span>
          <Clock3 />
          {when.duration}
        </span>
        <span>
          <MapPin />
          {request.distanceMiles} miles away
        </span>
        <span>
          {request.carNeeded ? <Car /> : <Clock3 />}
          {request.carNeeded ? "Car needed" : when.time}
        </span>
      </div>
      {commitment && (
        <>
          <p className="opportunity-description">
            {request.location}
            <br />
            {request.description}
          </p>
          <Button disabled variant="outline" className="w-full" size="sm">
            Cancel commitment
          </Button>
          <p className="readonly-note mt-2">
            <LockKeyhole /> Read-only in this step
          </p>
        </>
      )}
    </article>
  );
}
export function BoardScreen() {
  const { data, volunteer } = useVolunteer();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const closePreview = useCallback(() => setPreviewId(null), []);
  const firstName = volunteer.name.split(" ")[0];
  const opportunities = data.requests.filter(
    (r) => r.status === "open" && filledSpots(data, r) < r.volunteersNeeded,
  );
  return (
    <div className="phone-padding">
      <div className="phone-intro">
        <div>
          <span className="eyebrow">Your community, your time</span>
          <h2>
            Hello, {firstName} <span aria-hidden="true">☀</span>
          </h2>
          <p>A little kindness starts right here.</p>
        </div>
        <Sparkles className="welcome-spark" strokeWidth={1.3} />
      </div>
      <AvailabilityToggle available={volunteer.available} />
      <StandingBanner data={data} volunteer={volunteer} />
      <PointsCard data={data} volunteerId={volunteer.id} />
      {volunteer.available ? (
        <>
          <div className="community-photo">
            <img
              src={communityImage}
              alt="Food bank volunteers packing parcels"
              width={1536}
              height={1024}
            />
            <div className="community-photo-text">
              <span>Edinburgh, Scotland</span>
              <h3>Small acts. Stronger communities.</h3>
              <p>Thistle Community Care</p>
            </div>
          </div>
          <div className="section-heading">
            <h2>Community opportunities</h2>
            <span>{opportunities.length} open</span>
          </div>
          <p className="readonly-note mb-3">
            <LockKeyhole /> Tap an opportunity to see details and accept · personalised matching
            comes next
          </p>
          {opportunities.map((r) => (
            // A div with button behaviour, because a real <button> can't contain the card's headings.
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              className="opportunity-link"
              aria-label={`${r.title}, show details`}
              onClick={() => setPreviewId(r.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPreviewId(r.id);
                }
              }}
            >
              <Opportunity
                request={r}
                data={data}
                going={data.commitments.some(
                  (c) =>
                    c.volunteerId === volunteer.id &&
                    c.status === "accepted" &&
                    r.occurrenceIds.includes(c.occurrenceId),
                )}
              />
            </div>
          ))}
          <p className="readonly-note mt-4">More good things are just around the corner.</p>
        </>
      ) : (
        <div className="empty-state board-off">
          <Moon className="text-primary" aria-hidden="true" />
          <h3>You’re switched off</h3>
          <p className="muted text-xs">
            Taking a break is fine. Switch on when you’re ready and requests that fit you will
            appear here.
          </p>
        </div>
      )}
      <OpportunityPreview
        request={data.requests.find((r) => r.id === previewId) ?? null}
        data={data}
        volunteer={volunteer}
        onClose={closePreview}
      />
    </div>
  );
}
export function ProfileScreen() {
  const { data, volunteer: v } = useVolunteer();
  const { saved } = useSearch({ from: "/volunteer/profile" });
  const weekly = formatWeekly(v.weeklyAvailability);
  return (
    <div className="phone-padding">
      {saved && (
        <p className="pref-saved" role="status">
          <CheckCircle2 aria-hidden="true" /> Preferences saved
        </p>
      )}
      <div className="profile-top">
        <span className="avatar avatar-large">{initials(v.name)}</span>
        <h2>{v.name}</h2>
        <p className="muted text-xs">Edinburgh · {v.postcode}</p>
        <Status status={v.verification} />
      </div>
      <AvailabilityToggle available={v.available} />
      <div className="profile-section">
        <h3>Your details</h3>
        <div className="detail-row">
          <span>Email</span>
          <span>{v.email}</span>
        </div>
        <div className="detail-row">
          <span>Age</span>
          <span>{v.age}</span>
        </div>
        <div className="detail-row">
          <span>DBS check</span>
          <span>
            {v.dbs ? (
              <span className="text-primary">
                <Check size={12} className="inline" /> Yes
              </span>
            ) : (
              "Not provided"
            )}
          </span>
        </div>
        <div className="detail-row">
          <span>Physical work</span>
          <span>{v.physicalWork ? "Comfortable" : "Prefers not to"}</span>
        </div>
      </div>
      <div className="profile-section">
        <h3>Your preferences</h3>
        <div className="detail-row">
          <span>Travel distance</span>
          <span>
            Up to {v.maxDistanceMiles} {v.maxDistanceMiles === 1 ? "mile" : "miles"}
          </span>
        </div>
        <div className="detail-row">
          <span>Car</span>
          <span>{describeCar(v)}</span>
        </div>
        <p className="muted text-xs mb-3">Happy to help with</p>
        <div className="tag-list">
          {v.canDo.map((t) => (
            <TaskTag key={t} task={t} />
          ))}
        </div>
        {v.cannotDo.length > 0 && (
          <>
            <p className="muted text-xs mt-4 mb-3">Won’t do</p>
            <div className="tag-list">
              {v.cannotDo.map((t) => (
                <span key={t} className="task-tag task-tag-no">
                  {t}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
      <PointsCard data={data} volunteerId={v.id} />
      <ReliabilitySection data={data} volunteer={v} />
      <div className="profile-section">
        <h3>Availability</h3>
        <div className="detail-row">
          <span>Weekly</span>
          <span>
            {weekly.length
              ? weekly.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))
              : "Not set"}
          </span>
        </div>
        <div className="detail-row">
          <span>Blocked dates</span>
          <span>
            {v.blockedDates.length
              ? v.blockedDates.map((d) => (
                  <span key={d} className="block">
                    {formatLongDate(d)}
                  </span>
                ))
              : "None"}
          </span>
        </div>
      </div>
      <Button asChild variant="outline" className="w-full">
        <Link to="/volunteer/preferences">
          <SlidersHorizontal /> Edit preferences
        </Link>
      </Button>
    </div>
  );
}
