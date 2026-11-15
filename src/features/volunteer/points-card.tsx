import { Link } from "@tanstack/react-router";
import { Award, ChevronRight } from "lucide-react";
import type { Snapshot } from "@/api/types";
import { badgesFor, nextReward, pointsBalance } from "@/lib/rewards";

/** Compact points summary that links to the Rewards screen. */
export function PointsCard({ data, volunteerId }: { data: Snapshot; volunteerId: string }) {
  const balance = pointsBalance(data, volunteerId);
  const badges = badgesFor(data, volunteerId).filter((b) => b.earned).length;
  const next = nextReward(balance);
  // How far along the bar is towards the next reward (full once every reward is affordable).
  const percent = next ? Math.max(0, Math.min(100, (balance / next.reward.points) * 100)) : 100;
  return (
    <Link to="/volunteer/rewards" className="points-card">
      <span className="points-card-icon" aria-hidden="true">
        <Award />
      </span>
      <span className="points-card-text">
        <strong>
          {balance} points · {badges} {badges === 1 ? "badge" : "badges"}
        </strong>
        <span>
          {next
            ? `${next.pointsNeeded} more for a ${next.reward.name}`
            : "You can redeem any reward"}
        </span>
        <span
          className="points-card-bar"
          role="progressbar"
          aria-label={next ? `Progress towards a ${next.reward.name}` : "Points progress"}
          aria-valuemin={0}
          aria-valuemax={next?.reward.points ?? Math.max(balance, 1)}
          aria-valuenow={Math.max(0, balance)}
        >
          <span style={{ width: `${percent}%` }} />
        </span>
      </span>
      <ChevronRight aria-hidden="true" />
    </Link>
  );
}
