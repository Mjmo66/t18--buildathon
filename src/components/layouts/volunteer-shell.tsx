import { Outlet, Link, useLocation } from "@tanstack/react-router";
import {
  LayoutGrid,
  CalendarCheck2,
  UserRound,
  ArrowLeft,
  Signal,
  Wifi,
  BatteryFull,
  SlidersHorizontal,
} from "lucide-react";
import { Brand, BackToRoles, DemoLabel } from "@/components/shared/common";
import { Button } from "@/components/ui/button";
export function VolunteerShell() {
  const path = useLocation().pathname;
  const isCommitmentDetail = /^\/volunteer\/commitments\/[^/]+/.test(path);
  const isOpportunity = path.startsWith("/volunteer/opportunities/");
  const title = isOpportunity
    ? "Opportunity"
    : isCommitmentDetail
      ? "Commitment"
      : path.includes("commitments")
        ? "My commitments"
        : path.includes("preferences")
          ? "Preferences"
          : path.includes("rewards")
            ? "Rewards"
            : path.includes("profile")
              ? "Profile"
              : "Board";
  const backTo =
    title === "Preferences"
      ? "/volunteer/profile"
      : isCommitmentDetail
        ? "/volunteer/commitments"
        : "/volunteer";
  // Sub-screens of Profile keep the Profile tab highlighted.
  const activeTab =
    path.includes("preferences") || path.includes("rewards")
      ? "/volunteer/profile"
      : isCommitmentDetail
        ? "/volunteer/commitments"
        : isOpportunity
          ? "/volunteer"
          : path.replace(/\/$/, "");
  return (
    <main className="phone-stage">
      <div className="phone-exterior">
        <BackToRoles />
        <DemoLabel />
      </div>
      <div className="phone-frame">
        <div className="phone-statusbar" aria-hidden="true">
          <span>9:41</span>
          <span>
            <Signal />
            <Wifi />
            <BatteryFull />
          </span>
        </div>
        <header className="phone-header">
          <div className="phone-header-left">
            {title !== "Board" && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                aria-label={
                  title === "Preferences"
                    ? "Back to Profile"
                    : isCommitmentDetail
                      ? "Back to My commitments"
                      : "Back to Board"
                }
              >
                <Link to={backTo}>
                  <ArrowLeft />
                </Link>
              </Button>
            )}
            {title === "Board" ? <Brand compact /> : <h1>{title}</h1>}
          </div>
          <div className="phone-header-actions">
            <Button
              asChild
              variant="ghost"
              size="icon"
              aria-label="Preferences"
              title="Preferences"
            >
              <Link
                to="/volunteer/preferences"
                className={path.includes("preferences") ? "header-active" : undefined}
              >
                <SlidersHorizontal />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon" aria-label="Switch role">
              <Link to="/">
                <ArrowLeft />
              </Link>
            </Button>
          </div>
        </header>
        <div className="phone-body">
          <Outlet />
        </div>
        <nav className="phone-tabs" aria-label="Volunteer navigation">
          {(
            [
              { to: "/volunteer", label: "Board", icon: LayoutGrid },
              { to: "/volunteer/commitments", label: "My commitments", icon: CalendarCheck2 },
              { to: "/volunteer/profile", label: "Profile", icon: UserRound },
            ] as const
          ).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`phone-tab ${activeTab === item.to ? "active" : ""}`}
              aria-current={activeTab === item.to ? "page" : undefined}
            >
              <item.icon />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
