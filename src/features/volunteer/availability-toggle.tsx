import { Power } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useSetAvailable } from "./hooks";

/** The volunteer's big ON/OFF switch. Shows the new state straight away while it saves. */
export function AvailabilityToggle({ available }: { available: boolean }) {
  const toggle = useSetAvailable();
  const on = toggle.isPending ? Boolean(toggle.variables) : available;
  return (
    <div className={`availability-card ${on ? "is-on" : "is-off"}`}>
      <span className="availability-icon" aria-hidden="true">
        <Power />
      </span>
      <div className="availability-text">
        <strong>{on ? "You’re ON" : "You’re OFF"}</strong>
        <p>
          {on
            ? "You’ll see new requests that fit you."
            : "You won’t see new requests until you switch on."}
        </p>
        {toggle.isError && <p className="pref-error">Couldn’t update. Please try again.</p>}
      </div>
      <Switch
        className="availability-switch"
        checked={on}
        onCheckedChange={(next) => toggle.mutate(next)}
        disabled={toggle.isPending}
        aria-label="Available for new requests"
      />
    </div>
  );
}
