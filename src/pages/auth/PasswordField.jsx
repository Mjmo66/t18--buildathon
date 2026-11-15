import { useState } from 'react';
import { Field } from '../../components/ui/index.js';

// Password field with a visible "Show" / "Hide" button in the bottom-right corner.
export default function PasswordField(props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-row">
      <Field {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        aria-pressed={visible}
        aria-label="Show password"
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
