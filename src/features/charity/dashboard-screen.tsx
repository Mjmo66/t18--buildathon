import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FilePen,
  HeartHandshake,
  Plus,
  UsersRound,
} from "lucide-react";
import { snapshotQuery } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { charityTodos, upcomingSessions } from "@/lib/charity";
import { PageHeading, Stat } from "./screens";
import { MapLink } from "@/components/shared/map-link";

const when = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

function greeting(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Europe/London",
    }).format(now),
  );
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export function DashboardScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const todos = charityTodos(data);
  const sessions = upcomingSessions(data, 14);
  const open = data.requests.filter((r) => r.status === "open");
  const signedUp = sessions.reduce((sum, s) => sum + s.session.filled, 0);
  const spotsToFill = sessions.reduce(
    (sum, s) => sum + Math.max(0, s.session.needed - s.session.filled),
    0,
  );
  const firstName = data.charity.contactName.split(" ")[0];

  const items = [
    todos.attendance > 0 && {
      key: "attendance",
      icon: ClipboardCheck,
      tone: "warning",
      title: `Confirm who came (${todos.attendance})`,
      text: "Let us know who turned up, so volunteers get their points.",
      action: (
        <Button asChild size="sm">
          <Link to="/charity/attendance">Confirm attendance</Link>
        </Button>
      ),
    },
    todos.needVolunteers.length > 0 && {
      key: "volunteers",
      icon: UsersRound,
      tone: "primary",
      title: `${todos.needVolunteers.length} ${todos.needVolunteers.length === 1 ? "session still needs" : "sessions still need"} volunteers`,
      text: `The soonest is “${todos.needVolunteers[0]!.summary.request.title}”, ${when.format(new Date(todos.needVolunteers[0]!.session.occurrence.start))}.`,
      action: (
        <Button asChild size="sm" variant="outline">
          <Link to="/charity/requests">See requests</Link>
        </Button>
      ),
    },
    todos.drafts.length > 0 && {
      key: "drafts",
      icon: FilePen,
      tone: "muted",
      title: `${todos.drafts.length} ${todos.drafts.length === 1 ? "draft" : "drafts"} to publish`,
      text: "Volunteers can’t see drafts until you publish them.",
      action: (
        <Button asChild size="sm" variant="outline">
          <Link to="/charity/requests">Review drafts</Link>
        </Button>
      ),
    },
    todos.readyToComplete.length > 0 && {
      key: "complete",
      icon: CheckCircle2,
      tone: "success",
      title: `${todos.readyToComplete.length} ${todos.readyToComplete.length === 1 ? "request has" : "requests have"} finished`,
      text: "Mark them complete to tidy up your list.",
      action: (
        <Button asChild size="sm" variant="outline">
          <Link to="/charity/requests">Mark complete</Link>
        </Button>
      ),
    },
  ].filter(Boolean) as {
    key: string;
    icon: typeof ClipboardCheck;
    tone: string;
    title: string;
    text: string;
    action: React.ReactNode;
  }[];

  return (
    <>
      <PageHeading
        title={`${greeting()}, ${firstName}`}
        description={`Here’s what’s happening at ${data.charity.name}.`}
      >
        <Button asChild>
          <Link to="/charity/create">
            <Plus /> Create request
          </Link>
        </Button>
      </PageHeading>

      <section className="todo-section" aria-labelledby="todo-heading">
        <h2 id="todo-heading">What needs doing</h2>
        {items.length === 0 ? (
          <p className="todo-done">
            <CheckCircle2 aria-hidden="true" /> You’re all caught up. Nice work!
          </p>
        ) : (
          <ul className="todo-list">
            {items.map(({ key, icon: Icon, tone, title, text, action }) => (
              <li key={key} className={`todo todo-${tone}`}>
                <span className="todo-icon" aria-hidden="true">
                  <Icon />
                </span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
                {action}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="stats-grid">
        <Stat
          label="Open requests"
          value={open.length}
          foot="Live for volunteers right now"
          icon={HeartHandshake}
        />
        <Stat
          label="Signed up (next 2 weeks)"
          value={signedUp}
          foot="Volunteers coming to your sessions"
          icon={UsersRound}
        />
        <Stat
          label="Spots still to fill"
          value={spotsToFill}
          foot="Across sessions in the next 2 weeks"
          icon={CalendarDays}
        />
      </div>

      <div className="desktop-section-heading">
        <h2>Coming up in the next 2 weeks</h2>
        <Button asChild variant="ghost" size="sm">
          <Link to="/charity/requests">
            All requests <ArrowRight />
          </Link>
        </Button>
      </div>
      {sessions.length === 0 ? (
        <div className="table-wrap attendance-empty">
          <CalendarDays aria-hidden="true" />
          <p>Nothing planned. Create a request to get volunteers on board.</p>
        </div>
      ) : (
        <ul className="upcoming-list">
          {sessions.map(({ request, session }) => {
            const full = session.filled >= session.needed;
            return (
              <li key={session.occurrence.id}>
                <div className="upcoming-when">
                  <CalendarDays aria-hidden="true" />
                  {when.format(new Date(session.occurrence.start))}
                </div>
                <div className="upcoming-what">
                  <strong>{request.title}</strong>
                  <span>
                    <MapLink location={request.location} postcode={request.postcode} />
                  </span>
                </div>
                <div className="upcoming-who">
                  {session.volunteers.length
                    ? session.volunteers.map((v) => v.volunteer.name.split(" ")[0]).join(", ")
                    : "No one yet"}
                </div>
                <span className={`upcoming-count ${full ? "full" : ""}`}>
                  {session.filled} of {session.needed}
                  {full ? " · full" : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
