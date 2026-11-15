import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, isSameDay } from 'date-fns';
import { ChevronLeft, Hourglass, Lock, SendHorizontal, TriangleAlert } from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext.jsx';
import { supabase } from '../../lib/supabase';
import {
  MAX_MESSAGE_LENGTH,
  NO_PEER_KEY_MESSAGE,
  PeerHasNoKeyError,
  ensurePublicKeyPublished,
  fetchMessages,
  sendMessage,
  subscribeToMessages,
} from '../../lib/chat';
import Avatar from './Avatar.jsx';
import KeySheet from './KeySheet.jsx';
import { dayLabel, mergeMessages } from './util.js';
import './chat.css';

const PEER_KEY_RECHECK_MS = 10_000;
const UNDECRYPTABLE_TEXT = "This message can't be decrypted on this device";

function errorText(e) {
  return e instanceof Error ? e.message : String(e);
}

/** Load the conversation row with both profiles; returns the peer's details. */
async function loadConversation(conversationId, me) {
  const { data, error } = await supabase
    .from('conversations')
    .select(
      `id, charity_id, volunteer_id,
       request:requests(title),
       charity:profiles!conversations_charity_id_fkey(display_name, public_key),
       volunteer:profiles!conversations_volunteer_id_fkey(display_name, public_key)`,
    )
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw new Error(`Could not load the conversation: ${error.message}`);
  if (!data) throw new Error('Conversation not found');
  const iAmCharity = data.charity_id === me;
  const peer = iAmCharity ? data.volunteer : data.charity;
  const mine = iAmCharity ? data.charity : data.volunteer;
  return {
    peerId: iAmCharity ? data.volunteer_id : data.charity_id,
    peerName: peer?.display_name ?? 'Unknown',
    peerKey: peer?.public_key ?? null,
    myName: mine?.display_name ?? 'You',
    requestTitle: data.request?.title ?? null,
  };
}

async function loadPeerKey(peerId) {
  const { data, error } = await supabase.from('profiles').select('public_key').eq('id', peerId).maybeSingle();
  if (error) throw error;
  return data?.public_key ?? null;
}

/** Keep the chat sized to the visible viewport, so the input stays above the on-screen keyboard. */
function useVisualViewport(ref) {
  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return undefined;
    const update = () => {
      el.style.setProperty('--chat-vh', `${vv.height}px`);
      el.style.setProperty('--chat-top', `${vv.offsetTop}px`);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [ref]);
}

export default function Conversation() {
  const { conversationId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const me = user?.id ?? null;

  const [conv, setConv] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [myKey, setMyKey] = useState(null);
  const [peerKey, setPeerKey] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const screenRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const stickToBottom = useRef(true);
  useVisualViewport(screenRef);

  const noPeerKey = conv !== null && !peerKey;

  // My key: publish on mount (the auth context does it too; harmless).
  useEffect(() => {
    if (!me) return;
    let alive = true;
    ensurePublicKeyPublished(me)
      .then((k) => alive && setMyKey(k))
      .catch((e) => console.warn('[chat] key publish failed', e));
    return () => {
      alive = false;
    };
  }, [me]);

  // Conversation row, messages and live updates.
  useEffect(() => {
    if (!me || !conversationId) return;
    let alive = true;
    setConv(null);
    setLoadError(null);
    setMessages([]);
    setMessagesLoaded(false);
    stickToBottom.current = true;

    // Subscribe first so nothing sent while loading is missed; merge de-duplicates.
    const unsubscribe = subscribeToMessages(conversationId, me, (m) => {
      if (alive) setMessages((cur) => mergeMessages(cur, [m]));
    });

    (async () => {
      try {
        const c = await loadConversation(conversationId, me);
        if (!alive) return;
        setConv(c);
        setPeerKey(c.peerKey);
        const list = await fetchMessages(conversationId, me);
        if (!alive) return;
        setMessages((cur) => mergeMessages(cur, list));
        setMessagesLoaded(true);
      } catch (e) {
        if (alive) setLoadError(errorText(e));
      }
    })();

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [conversationId, me]);

  // Peer key: re-check on focus and every 10 s while missing. Refresh when the sheet opens.
  const refreshPeerKey = useCallback(async () => {
    if (!conv) return;
    try {
      const k = await loadPeerKey(conv.peerId);
      setPeerKey(k);
      if (k) setSendError((err) => (err === NO_PEER_KEY_MESSAGE ? null : err));
    } catch (e) {
      console.warn('[chat] peer key check failed', e);
    }
  }, [conv]);

  useEffect(() => {
    if (!noPeerKey) return undefined;
    const id = setInterval(refreshPeerKey, PEER_KEY_RECHECK_MS);
    const onFocus = () => refreshPeerKey();
    const onVisible = () => document.visibilityState === 'visible' && refreshPeerKey();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [noPeerKey, refreshPeerKey]);

  const openSheet = () => {
    setSheetOpen(true);
    refreshPeerKey();
    if (me) ensurePublicKeyPublished(me).then(setMyKey).catch(() => {});
  };
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  // Auto-scroll: follow new messages unless the user scrolled up to read older ones.
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, messagesLoaded]);
  useEffect(() => {
    // Keyboard opening shrinks the viewport: keep the newest message visible.
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const onResize = () => {
      const el = scrollRef.current;
      if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  // Grow the textarea with its content (up to the CSS max-height).
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending || !conv || !me || noPeerKey) return;
    setSending(true);
    setSendError(null);
    try {
      const m = await sendMessage(conversationId, me, conv.peerId, body);
      stickToBottom.current = true;
      setMessages((cur) => mergeMessages(cur, [m]));
      setText('');
    } catch (e) {
      if (e instanceof PeerHasNoKeyError) {
        setPeerKey(null);
        setSendError(NO_PEER_KEY_MESSAGE);
      } else {
        setSendError(errorText(e));
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  if (authLoading) return <div className="chat-page"><p className="chat-muted">Loading…</p></div>;
  if (!user) {
    return (
      <div className="chat-page">
        <p className="chat-muted">Sign in to see this chat.</p>
        <Link className="button" to="/">Sign in</Link>
      </div>
    );
  }

  const remaining = MAX_MESSAGE_LENGTH - text.length;
  const canSend = !!text.trim() && !sending && !!conv && !noPeerKey;

  return (
    <div className="chat-screen" ref={screenRef}>
      <header className="chat-header">
        <Link to="/chat" className="chat-back" aria-label="Back to chats"><ChevronLeft size={24} strokeWidth={2} /></Link>
        {conv ? (
          <>
            <Avatar name={conv.peerName} size={38} />
            <div className="chat-header-text">
              <span className="chat-header-name">{conv.peerName}</span>
              {conv.requestTitle && <span className="chat-header-sub">{conv.requestTitle}</span>}
            </div>
          </>
        ) : (
          <div className="chat-header-text"><span className="chat-header-name">{loadError ? 'Chat' : 'Loading…'}</span></div>
        )}
        <button
          type="button"
          className="e2e-chip"
          onClick={openSheet}
          disabled={!conv}
          aria-haspopup="dialog"
          title="End-to-end encrypted: compare keys"
        >
          <Lock size={14} strokeWidth={2} aria-hidden="true" />
          <span>Encrypted</span>
        </button>
      </header>

      <div className="chat-scroll" ref={scrollRef} onScroll={onScroll} role="log">
        {loadError && (
          <div className="chat-alert" role="alert">
            <span>{loadError}</span>
            <Link className="chat-link-button" to="/chat">Back to chats</Link>
          </div>
        )}
        {!loadError && !messagesLoaded && <p className="chat-muted chat-center">Loading messages…</p>}
        {messagesLoaded && messages.length === 0 && !noPeerKey && (
          <p className="chat-muted chat-center">No messages yet.</p>
        )}
        {messages.map((m, i) => {
          const date = new Date(m.createdAt);
          const prev = messages[i - 1];
          const newDay = !prev || !isSameDay(new Date(prev.createdAt), date);
          return (
            <Fragment key={m.id}>
              {newDay && <div className="chat-day"><span>{dayLabel(date)}</span></div>}
              <div className={`bubble-row ${m.mine ? 'mine' : 'theirs'}`}>
                <div className={`bubble ${m.undecryptable ? 'bubble-broken' : ''}`}>
                  {m.undecryptable ? (
                    <span className="bubble-text"><TriangleAlert size={14} strokeWidth={2} aria-hidden="true" className="bubble-warn" /> {UNDECRYPTABLE_TEXT}</span>
                  ) : (
                    <span className="bubble-text">{m.text}</span>
                  )}
                  <time className="bubble-time" dateTime={m.createdAt}>{format(date, 'HH:mm')}</time>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      {noPeerKey && (
        <div className="chat-notice" role="status">
          <Hourglass size={18} strokeWidth={1.75} aria-hidden="true" />
          <span>{NO_PEER_KEY_MESSAGE}</span>
        </div>
      )}
      {sendError && sendError !== NO_PEER_KEY_MESSAGE && (
        <div className="chat-alert chat-alert-inline" role="alert">
          <span>{sendError}</span>
          <button type="button" className="chat-link-button" onClick={() => setSendError(null)}>Dismiss</button>
        </div>
      )}

      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="chat-input-wrap">
          <textarea
            ref={inputRef}
            className="chat-input"
            rows={1}
            value={text}
            maxLength={MAX_MESSAGE_LENGTH}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => noPeerKey && refreshPeerKey()}
            placeholder={noPeerKey ? 'Waiting for their key…' : 'Message'}
            disabled={noPeerKey || !conv}
            enterKeyHint="send"
            aria-label="Message"
          />
          {remaining < 500 && <span className="chat-counter">{remaining}</span>}
        </div>
        <button type="submit" className="chat-send" disabled={!canSend} aria-label="Send">
          <SendHorizontal size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </form>

      {conv && (
        <KeySheet
          open={sheetOpen}
          onClose={closeSheet}
          myName={conv.myName}
          myKey={myKey}
          peerName={conv.peerName}
          peerKey={peerKey}
        />
      )}
    </div>
  );
}
