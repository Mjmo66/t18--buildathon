import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isToday } from 'date-fns';
import { MessagesSquare } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { listConversations } from '../../lib/chat';
import { Button, EmptyState } from '../../components/ui/index.js';
import { formatDay, formatTime } from '../../components/format.js';
import Avatar from './Avatar.jsx';
import './chat.css';

function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
}

/** "2:30pm" today, otherwise "Yesterday" / "Thursday 19 November". */
function lastLabel(date) {
  return isToday(date) ? formatTime(date) : formatDay(date);
}

export default function ConversationList() {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState(null);
  const [error, setError] = useState(null);
  useMinuteTick();

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      setConversations(await listConversations(user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh when the user comes back to the tab (new messages may have arrived).
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  if (authLoading) return <div className="chat-page"><p className="chat-muted">Loading…</p></div>;
  if (!user) {
    return (
      <div className="chat-page">
        <h1 className="chat-title">Messages</h1>
        <Button to="/login">Sign in</Button>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <h1 className="chat-title">Messages</h1>

      {error && (
        <div className="chat-alert" role="alert">
          <span>{error}</span>
          <Button variant="secondary" onClick={load}>Try again</Button>
        </div>
      )}

      {!conversations && !error && <p className="chat-muted">Loading…</p>}

      {conversations && conversations.length === 0 && (
        <EmptyState icon={<MessagesSquare size={22} strokeWidth={1.75} />} title="No messages yet." />
      )}

      {conversations && conversations.length > 0 && (
        <ul className="chat-list">
          {conversations.map((c) => {
            const last = c.lastMessageAt ?? c.createdAt;
            return (
              <li key={c.id}>
                <Link className="chat-list-item" to={`/chat/${c.id}`}>
                  <Avatar name={c.peerName} />
                  <span className="chat-list-main">
                    <span className="chat-list-row">
                      <span className="chat-list-name">{c.peerName}</span>
                      <time className="chat-list-time" dateTime={last}>
                        {c.lastMessageAt ? lastLabel(new Date(last)) : 'New'}
                      </time>
                    </span>
                    <span className="chat-list-sub">
                      {c.requestTitle ?? 'General'}
                      {!c.peerHasKey && <span className="chat-pill">Hasn't opened Kindred yet</span>}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
