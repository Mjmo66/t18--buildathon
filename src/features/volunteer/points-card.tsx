import { Link } from "@tanstack/react-router";
import { Award, ChevronRight } from "lucide-react";
import type { Snapshot } from "@/api/types";
import { badgesFor, nextReward, pointsBalance } from "@/lib/rewards";

/** Compact points summary that links to the Rewards screen. */
export function PointsCard({ data, volunteerId }: { data: Snapshot; volunteerId: string }) {
  const balance = pointsBalance(data, volunteerId);
  const badges = badgesFor(data, volunteerId).filter((b) => b.earned).length;
  const next = nextReward(balance);
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
      </span>
      <ChevronRight aria-hidden="true" />
    </Link>
  );
}
