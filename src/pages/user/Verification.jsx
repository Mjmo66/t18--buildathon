import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, BadgeCheck, Car, ChefHat, Clock3, FileCheck2, House, IdCard, Package, Plus, ShieldCheck, Users,
} from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import './verification.css';

// The checks Kindred does on volunteers. Only ID is backed by data (profile.verified); the rest are a demo.
const CHECKS = [
  { key: 'id', label: 'ID', note: 'Passport or photocard driving licence.', Icon: IdCard },
  { key: 'address', label: 'Address', note: 'A bill or bank statement from the last 3 months.', Icon: House },
  { key: 'references', label: 'References', note: 'Two people who have known you for 2+ years, not family.', Icon: Users },
  { key: 'dbs', label: 'DBS check', note: 'Enhanced check for work with children or vulnerable adults.', Icon: ShieldCheck },
  { key: 'driving', label: 'Driving licence', note: 'Full UK licence.', Icon: Car },
  { key: 'insurance', label: 'Insurance', note: 'Car insurance that covers volunteering.', Icon: FileCheck2 },
  { key: 'food', label: 'Food hygiene', note: 'Level 2 Food Safety and Hygiene.', Icon: ChefHat },
  { key: 'handling', label: 'Manual handling', note: 'Safe lifting and carrying.', Icon: Package },
];

const STATE = {
  verified: { label: 'Verified', Icon: BadgeCheck },
  pending: { label: 'Pending review', Icon: Clock3 },
  missing: { label: 'Not added', Icon: Plus },
};

export default function Verification() {
  const { profile } = useAuth();
  const [pending, setPending] = useState(() => new Set());

  const stateOf = (key) => {
    if (key === 'id') return profile?.verified ? 'verified' : 'missing';
    return pending.has(key) ? 'pending' : 'missing';
  };
  const done = CHECKS.filter((c) => stateOf(c.key) === 'verified').length;

  return (
    <div className="lv">
      <div className="phone-padding lv-verify">
        <Link to="/user/profile" className="verify-back"><ArrowLeft size={16} aria-hidden="true" /> Profile</Link>
        <p className="readonly-note verify-demo">Demo: uploads aren’t stored yet.</p>

        <section className="cred-hero">
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong>{done} of {CHECKS.length} checks verified</strong>
            <p>Some shifts need a DBS check or food hygiene certificate.</p>
          </div>
        </section>

        <ul className="cred-list">
          {CHECKS.map(({ key, label, note, Icon }) => {
            const state = stateOf(key);
            const S = STATE[state];
            return (
              <li key={key} className="cred-row">
                <span className="cred-icon" aria-hidden="true"><Icon /></span>
                <div className="cred-main">
                  <div className="cred-title">
                    <strong>{label}</strong>
                    <span className={`cred-badge cred-${state}`}><S.Icon aria-hidden="true" /> {S.label}</span>
                  </div>
                  <p className="cred-desc">{note}</p>
                </div>
                {state === 'missing' && key !== 'id' && (
                  <button
                    type="button"
                    className="cred-add"
                    onClick={() => setPending((p) => new Set(p).add(key))}
                    aria-label={`Add ${label}`}
                  >
                    Add
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
