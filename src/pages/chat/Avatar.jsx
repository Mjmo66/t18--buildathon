import { hueOf, initials } from './util.js';

export default function Avatar({ name, size = 44 }) {
  return (
    <span
      className="chat-avatar"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.38, '--avatar-hue': hueOf(name) }}
    >
      {initials(name)}
    </span>
  );
}
