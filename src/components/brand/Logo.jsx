import { HeartHandshake } from 'lucide-react';

/** Kindred app icon: rounded square in the logo blue with a white heart-handshake. */
export function LogoIcon({ size = 32, className = '' }) {
  return (
    <span className={`logo-icon ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <HeartHandshake size={Math.round(size * 0.62)} strokeWidth={2} />
    </span>
  );
}

/**
 * Kindred logo. variant: 'full' (icon + wordmark, default) | 'icon'.
 * size: icon edge in px; the wordmark scales with it.
 */
export default function Logo({ variant = 'full', size = 32, className = '' }) {
  if (variant === 'icon') {
    return (
      <span className={`logo ${className}`} role="img" aria-label="Kindred">
        <LogoIcon size={size} />
      </span>
    );
  }
  return (
    <span className={`logo ${className}`} role="img" aria-label="Kindred">
      <LogoIcon size={size} />
      <span className="logo-word" style={{ fontSize: Math.round(size * 0.78) }} aria-hidden="true">
        kindred<span className="logo-dot">.</span>
      </span>
    </span>
  );
}
