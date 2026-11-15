import { useState } from "react";
import {
  Award,
  Car,
  Clock3,
  Coffee,
  Gift,
  HandHeart,
  Hand,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NO_SHOW_PENALTY,
  POINTS_PER_HOUR,
  REWARDS,
  badgesFor,
  hoursForPoints,
  hoursVolunteered,
  nextReward,
  pointsBalance,
  pointsLedger,
  type Badge,
  type Reward,
} from "@/lib/rewards";
import { useRedeemReward, useVolunteer } from "./hooks";

const BADGE_ICONS: Record<Badge["icon"], typeof Award> = {
  hand: HandHeart,
  five: Hand,
  clock: Clock3,
  trophy: Trophy,
  shield: ShieldCheck,
  car: Car,
  sparkles: Sparkles,
};

const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/London",
});
const formatHours = (h: number) => (Number.isInteger(h) ? `${h}` : h.toFixed(1));

function RewardCard({ reward, balance }: { reward: Reward; balance: number }) {
  const redeem = useRedeemReward();
  const [confirming, setConfirming] = useState(false);
  const affordable = balance >= reward.points;
  const short = reward.points - Math.max(0, balance);
  const Icon = reward.brand === "costa" ? Coffee : Gift;

  return (
    <article className={`reward-card reward-${reward.brand}`}>
      <div className="reward-top">
        <span className="reward-icon" aria-hidden="true">
          <Icon />
        </span>
        <div className="reward-text">
          <h3>{reward.name}</h3>
          <p>{reward.description}</p>
        </div>
        <span className="reward-cost">
          <strong>{reward.points}</strong> pts
          <span>{hoursForPoints(reward.points)} hrs</span>
        </span>
      </div>

      {redeem.isSuccess ? (
        <div className="voucher" role="status">
          <Ticket aria-hidden="true" />
          <div>
            <span>Your code</span>
            <strong>{redeem.data.code}</strong>
          </div>
        </div>
      ) : confirming ? (
        <div className="reward-confirm">
          <p>
            Swap <strong>{reward.points} points</strong> for this? You’ll have{" "}
            {balance - reward.points} left.
          </p>
          <div className="reward-confirm-actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
              disabled={redeem.isPending}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={() => redeem.mutate(reward.id)} disabled={redeem.isPending}>
              {redeem.isPending && <Loader2 className="animate-spin" />} Confirm
            </Button>
          </div>
        </div>
      ) : (
        <Button
          className="w-full"
          variant={affordable ? "default" : "outline"}
          disabled={!affordable}
          onClick={() => setConfirming(true)}
        >
          {affordable ? "Redeem" : `${short} more points needed`}
        </Button>
      )}
      {redeem.isError && <p className="pref-error mt-2">{redeem.error.message}</p>}
    </article>
  );
}

export function RewardsScreen() {
  const { data, volunteer } = useVolunteer();
  const balance = pointsBalance(data, volunteer.id);
  const hours = hoursVolunteered(data, volunteer.id);
  const ledger = pointsLedger(data, volunteer.id);
  const badges = badgesFor(data, volunteer.id);
  const earnedCount = badges.filter((b) => b.earned).length;
  const next = nextReward(balance);
  const vouchers = data.redemptions
    .filter((r) => r.volunteerId === volunteer.id)
    .sort((a, b) => b.redeemedAt.localeCompare(a.redeemedAt));

  return (
    <div className="phone-padding">
      <section className="points-hero" aria-label="Your points">
        <span className="eyebrow">Your points</span>
        <div className="points-number">
          <strong className={balance < 0 ? "negative" : ""}>{balance}</strong> points
        </div>
        <p>
          {formatHours(hours)} hours volunteered · {POINTS_PER_HOUR} points per hour
        </p>
        {next && (
          <div className="points-progress">
            <div className="points-track" aria-hidden="true">
              <span
                style={{
                  width: `${Math.max(0, Math.min(100, (balance / next.reward.points) * 100))}%`,
                }}
              />
            </div>
            <p>
              {next.pointsNeeded} more points for a {next.reward.name}
            </p>
          </div>
        )}
      </section>

      <div className="section-heading">
        <h2>Rewards</h2>
        <span>Thank you from our partners</span>
      </div>
      {REWARDS.map((reward) => (
        <RewardCard key={reward.id} reward={reward} balance={balance} />
      ))}

      {vouchers.length > 0 && (
        <>
          <div className="section-heading mt-6">
            <h2>Your vouchers</h2>
          </div>
          <ul className="voucher-list">
            {vouchers.map((v) => (
              <li key={v.id}>
                <Ticket aria-hidden="true" />
                <span>
                  <strong>{REWARDS.find((r) => r.id === v.rewardId)?.name}</strong>
                  {shortDate.format(new Date(v.redeemedAt))}
                </span>
                <code>{v.code}</code>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="section-heading mt-6">
        <h2>Badges</h2>
        <span>
          {earnedCount} of {badges.length} earned
        </span>
      </div>
      <ul className="badge-grid">
        {badges.map((badge) => {
          const Icon = BADGE_ICONS[badge.icon];
          return (
            <li key={badge.id} className={badge.earned ? "badge-earned" : "badge-locked"}>
              <span className="badge-icon" aria-hidden="true">
                {badge.earned ? <Icon /> : <Lock />}
              </span>
              <strong>{badge.name}</strong>
              <span className="badge-desc">{badge.description}</span>
              {!badge.earned && (
                <span className="badge-progress">
                  {formatHours(badge.progress.current)} / {badge.progress.target}
                </span>
              )}
              <span className="sr-only">{badge.earned ? "Earned" : "Not earned yet"}</span>
            </li>
          );
        })}
      </ul>

      <div className="section-heading mt-6">
        <h2>Points history</h2>
      </div>
      {ledger.length === 0 ? (
        <p className="muted text-xs">Points appear here once a charity confirms you came.</p>
      ) : (
        <ul className="ledger">
          {ledger.map((entry) => (
            <li key={entry.id}>
              <span>
                <strong>{entry.label}</strong>
                {shortDate.format(new Date(entry.date))}
              </span>
              <span className={`ledger-points ledger-${entry.kind}`}>
                {entry.points > 0 ? `+${entry.points}` : entry.points}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="rewards-rules">
        <h3>How it works</h3>
        <p>
          Earn {POINTS_PER_HOUR} points for every hour you volunteer, once the charity confirms you
          came. Missing a session without cancelling costs {NO_SHOW_PENALTY} points and a strike.
        </p>
        <p className="muted text-xs mt-2">Prototype: voucher codes are for demonstration only.</p>
      </div>
    </div>
  );
}
