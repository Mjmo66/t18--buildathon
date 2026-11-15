/**
 * Chat data API (E2E encrypted). The server stores only ciphertext + nonce; see lib/crypto.
 *
 * Call `ensurePublicKeyPublished(userId)` once after sign-in (it is also called lazily
 * before sending). A peer who has never opened the app has no public key, so nobody
 * can write to them yet (`PeerHasNoKeyError`).
 *
 * UI note: `sendMessage` returns the sent message and Realtime also delivers it to the
 * sender's own subscription. De-duplicate by `id`.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { decryptFrom, encryptFor, getOrCreateKeyPair, publicKeyFingerprint } from '../crypto';

export { publicKeyFingerprint };

export interface ChatMessage {
  id: string;
  senderId: string;
  /** Decrypted text; empty string when `undecryptable` is true. */
  text: string;
  createdAt: string;
  mine: boolean;
  /** Could not be decrypted (key changed on either side, or data tampered with). */
  undecryptable: boolean;
}

export interface ConversationSummary {
  id: string;
  requestId: string | null;
  requestTitle: string | null;
  charityId: string;
  volunteerId: string;
  peerId: string;
  peerName: string;
  /** Whether the peer has a public key yet (false: you can't message them yet). */
  peerHasKey: boolean;
  createdAt: string;
  /** Time of the newest message, or null if there are none. */
  lastMessageAt: string | null;
}

export const NO_PEER_KEY_MESSAGE = 'You can message once they have opened Kindred.';

export class PeerHasNoKeyError extends Error {
  constructor() {
    super(NO_PEER_KEY_MESSAGE);
    this.name = 'PeerHasNoKeyError';
  }
}

export const MAX_MESSAGE_LENGTH = 4000;

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  ciphertext: string;
  nonce: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

const published = new Map<string, string>(); // userId -> public key known to be on the server

/** Create this user's key pair if missing and make sure `profiles.public_key` matches it.
 *  Returns the user's public key (base64). */
export async function ensurePublicKeyPublished(userId: string): Promise<string> {
  const { publicKey } = await getOrCreateKeyPair(userId);
  if (published.get(userId) === publicKey) return publicKey;

  const { data, error } = await supabase
    .from('profiles')
    .select('public_key')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`Could not read your profile: ${error.message}`);
  if (!data) throw new Error('Your profile does not exist yet');

  if (data.public_key !== publicKey) {
    // A different key on the server means this is a new device / cleared storage:
    // replace it (older messages become undecryptable; documented limit).
    const { error: upErr } = await supabase
      .from('profiles')
      .update({ public_key: publicKey })
      .eq('id', userId);
    if (upErr) throw new Error(`Could not publish your encryption key: ${upErr.message}`);
  }
  published.set(userId, publicKey);
  return publicKey;
}

const peerKeys = new Map<string, string | null>(); // profileId -> public key

async function fetchPublicKey(profileId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('public_key')
    .eq('id', profileId)
    .maybeSingle();
  if (error) throw new Error(`Could not load the other person's key: ${error.message}`);
  const key = (data?.public_key as string | null | undefined) ?? null;
  peerKeys.set(profileId, key);
  return key;
}

async function peerKey(profileId: string, fresh = false): Promise<string | null> {
  if (!fresh && peerKeys.has(profileId)) return peerKeys.get(profileId) ?? null;
  return fetchPublicKey(profileId);
}

const conversationPeers = new Map<string, string>(); // `${conversationId}:${me}` -> peerId

async function peerOf(conversationId: string, me: string): Promise<string> {
  const cacheKey = `${conversationId}:${me}`;
  const cached = conversationPeers.get(cacheKey);
  if (cached) return cached;
  const { data, error } = await supabase
    .from('conversations')
    .select('charity_id, volunteer_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw new Error(`Could not load the conversation: ${error.message}`);
  if (!data) throw new Error('Conversation not found');
  const peer = data.charity_id === me ? data.volunteer_id : data.charity_id;
  conversationPeers.set(cacheKey, peer);
  return peer;
}

function decryptRow(row: MessageRow, me: string, peerPub: string | null, mySecret: Uint8Array): ChatMessage {
  // Both directions use the same shared key: (peer public key, my secret key).
  const text = peerPub
    ? decryptFrom(peerPub, { ciphertext: row.ciphertext, nonce: row.nonce }, mySecret)
    : null;
  return {
    id: row.id,
    senderId: row.sender_id,
    text: text ?? '',
    createdAt: row.created_at,
    mine: row.sender_id === me,
    undecryptable: text === null,
  };
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export interface ConversationKey {
  requestId?: string | null;
  charityId: string;
  volunteerId: string;
}

/** Find the conversation for (request, charity, volunteer) or create it. Returns its id. */
export async function getOrCreateConversation({
  requestId = null,
  charityId,
  volunteerId,
}: ConversationKey): Promise<string> {
  const find = async (): Promise<string | null> => {
    let q = supabase
      .from('conversations')
      .select('id')
      .eq('charity_id', charityId)
      .eq('volunteer_id', volunteerId);
    q = requestId ? q.eq('request_id', requestId) : q.is('request_id', null);
    const { data, error } = await q.maybeSingle();
    if (error) throw new Error(`Could not load the conversation: ${error.message}`);
    return (data?.id as string | undefined) ?? null;
  };

  const existing = await find();
  if (existing) return existing;

  const { data, error } = await supabase
    .from('conversations')
    .insert({ request_id: requestId, charity_id: charityId, volunteer_id: volunteerId })
    .select('id')
    .single();
  if (!error && data) return data.id as string;
  if (error?.code === '23505') {
    // Lost the race against the other party creating it at the same time.
    const id = await find();
    if (id) return id;
  }
  throw new Error(`Could not start the conversation: ${error?.message ?? 'unknown error'}`);
}

type ProfileEmbed = { display_name: string; public_key: string | null } | null;

/** Conversations the user is part of, newest activity first. */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(
      `id, request_id, charity_id, volunteer_id, created_at,
       request:requests(title),
       charity:profiles!conversations_charity_id_fkey(display_name, public_key),
       volunteer:profiles!conversations_volunteer_id_fkey(display_name, public_key),
       messages(created_at)`,
    )
    .or(`charity_id.eq.${userId},volunteer_id.eq.${userId}`)
    .order('created_at', { referencedTable: 'messages', ascending: false })
    .limit(1, { referencedTable: 'messages' });
  if (error) throw new Error(`Could not load conversations: ${error.message}`);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    request_id: string | null;
    charity_id: string;
    volunteer_id: string;
    created_at: string;
    request: { title: string } | null;
    charity: ProfileEmbed;
    volunteer: ProfileEmbed;
    messages: Array<{ created_at: string }> | null;
  }>;

  return rows
    .map((r) => {
      const iAmCharity = r.charity_id === userId;
      const peer = iAmCharity ? r.volunteer : r.charity;
      const peerId = iAmCharity ? r.volunteer_id : r.charity_id;
      conversationPeers.set(`${r.id}:${userId}`, peerId);
      if (peer) peerKeys.set(peerId, peer.public_key);
      return {
        id: r.id,
        requestId: r.request_id,
        requestTitle: r.request?.title ?? null,
        charityId: r.charity_id,
        volunteerId: r.volunteer_id,
        peerId,
        peerName: peer?.display_name ?? 'Unknown',
        peerHasKey: !!peer?.public_key,
        createdAt: r.created_at,
        lastMessageAt: r.messages?.[0]?.created_at ?? null,
      };
    })
    .sort((a, b) => (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt));
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** All messages of a conversation, oldest first, decrypted. */
export async function fetchMessages(conversationId: string, me: string): Promise<ChatMessage[]> {
  const peerId = await peerOf(conversationId, me);
  const [{ secretKey }, peerPub, res] = await Promise.all([
    getOrCreateKeyPair(me),
    peerKey(peerId, true),
    supabase
      .from('messages')
      .select('id, conversation_id, sender_id, ciphertext, nonce, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
  ]);
  if (res.error) throw new Error(`Could not load messages: ${res.error.message}`);
  return ((res.data ?? []) as MessageRow[]).map((row) => decryptRow(row, me, peerPub, secretKey));
}

/** Encrypt `text` to the peer and store it. Throws `PeerHasNoKeyError` if the peer
 *  has no public key yet. Returns the sent message. */
export async function sendMessage(
  conversationId: string,
  me: string,
  peerId: string,
  text: string,
): Promise<ChatMessage> {
  const body = text.trim();
  if (!body) throw new Error('Message is empty');
  if (body.length > MAX_MESSAGE_LENGTH) throw new Error(`Message is longer than ${MAX_MESSAGE_LENGTH} characters`);

  // Make sure the peer can decrypt with the key we use (new device -> new key).
  await ensurePublicKeyPublished(me);
  const { secretKey } = await getOrCreateKeyPair(me);
  const peerPub = await peerKey(peerId, true); // fresh: the peer may have rotated their key
  if (!peerPub) throw new PeerHasNoKeyError();

  const { ciphertext, nonce } = encryptFor(peerPub, body, secretKey);
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: me, ciphertext, nonce })
    .select('id, created_at')
    .single();
  if (error || !data) throw new Error(`Could not send the message: ${error?.message ?? 'unknown error'}`);

  return {
    id: data.id as string,
    senderId: me,
    text: body,
    createdAt: data.created_at as string,
    mine: true,
    undecryptable: false,
  };
}

/** Live new messages of a conversation, decrypted, in arrival order.
 *  Returns an unsubscribe function. */
export function subscribeToMessages(
  conversationId: string,
  me: string,
  onMessage: (message: ChatMessage) => void,
): () => void {
  let active = true;
  let queue: Promise<void> = Promise.resolve();

  const handle = async (row: MessageRow) => {
    const { secretKey } = await getOrCreateKeyPair(me);
    const peerId = await peerOf(conversationId, me);
    let msg = decryptRow(row, me, await peerKey(peerId), secretKey);
    if (msg.undecryptable) {
      // The peer may have just rotated keys; retry once with a fresh key.
      msg = decryptRow(row, me, await peerKey(peerId, true), secretKey);
    }
    if (active) onMessage(msg);
  };

  const channel: RealtimeChannel = supabase
    .channel(`messages:${conversationId}:${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        const row = payload.new as MessageRow;
        // Serialise so messages arrive in order even though decryption is async.
        queue = queue.then(() => handle(row)).catch((e) => console.warn('[chat] realtime message failed', e));
      },
    )
    .subscribe();

  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}
