import 'server-only';

import { AccessToken } from 'livekit-server-sdk';

import { serverEnv } from '@/lib/env';

const HOUR = 60 * 60;

/** Token for a human participant in the browser. */
export async function createJoinToken(opts: {
  room: string;
  identity: string;
  name?: string;
  canPublish?: boolean;
}): Promise<string> {
  const { apiKey, apiSecret } = serverEnv.livekit();
  const at = new AccessToken(apiKey, apiSecret, {
    identity: opts.identity,
    name: opts.name ?? opts.identity,
    ttl: 2 * HOUR,
  });
  at.addGrant({
    room: opts.room,
    roomJoin: true,
    canPublish: opts.canPublish ?? true,
    canPublishData: true,
    canSubscribe: true,
  });
  return at.toJwt();
}

/**
 * Subscribe-only token for an AVFlow `livekit` source. AVFlow reads the room
 * from the JWT, so the grant must name it.
 */
export async function createSubscribeToken(room: string, identity: string): Promise<string> {
  const { apiKey, apiSecret } = serverEnv.livekit();
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: identity,
    ttl: 24 * HOUR,
  });
  at.addGrant({
    room,
    roomJoin: true,
    canPublish: false,
    canPublishData: false,
    canSubscribe: true,
  });
  return at.toJwt();
}

/** Publish token for an AVFlow `livekit` sink that pushes media back into a room. */
export async function createPublishToken(room: string, identity: string): Promise<string> {
  const { apiKey, apiSecret } = serverEnv.livekit();
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: identity,
    ttl: 24 * HOUR,
  });
  at.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    // A publish-only participant does not need to subscribe, and not
    // subscribing keeps it from echoing room audio back into the room.
    canSubscribe: false,
  });
  return at.toJwt();
}
