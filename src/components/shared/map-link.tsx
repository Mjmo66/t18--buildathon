import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { googleMapsUrl } from "@/lib/maps";

/** A location that opens in Google Maps in a new tab. */
export function MapLink({
  location,
  postcode,
  children,
}: {
  location: string;
  postcode?: string;
  children?: ReactNode;
}) {
  const label = postcode ? `${location}, ${postcode}` : location;
  return (
    <a
      href={googleMapsUrl(location, postcode)}
      target="_blank"
      rel="noopener noreferrer"
      className="map-link"
      aria-label={`${label}: open in Google Maps (new tab)`}
      onClick={(e) => e.stopPropagation()}
    >
      {children ?? label}
      <ExternalLink aria-hidden="true" />
    </a>
  );
}
