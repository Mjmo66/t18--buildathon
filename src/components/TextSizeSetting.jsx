import { useState } from 'react';
import { TEXT_SIZES, getTextSize, setTextSize } from '../lib/textSize.js';

/** Account setting: four text sizes, each shown at its real size. The whole app follows at once. */
export default function TextSizeSetting({ className = '' }) {
  const [size, setSize] = useState(getTextSize);
  const choose = (id) => { setTextSize(id); setSize(id); };
  return (
    <fieldset className={`text-size ${className}`}>
      <legend>Text size</legend>
      <div className="text-size-options">
        {TEXT_SIZES.map((s) => (
          <label key={s.id} className={`text-size-option${size === s.id ? ' is-active' : ''}`}>
            <input type="radio" name="text-size" value={s.id} checked={size === s.id} onChange={() => choose(s.id)} />
            <span className="text-size-sample" style={{ fontSize: `${s.px}px` }} aria-hidden="true">Aa</span>
            <span className="text-size-label">{s.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
