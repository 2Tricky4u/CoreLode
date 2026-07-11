/**
 * Lockstep wire protocol (pure data — transports live in src/platform/net).
 * Star topology: guests send `in` to the host; the host sequences everything
 * into authoritative `bundle`s that every peer (host included) executes.
 */
import type { Command } from '../commands';
import type { IntentFrame } from '../intents';
import type { ModeConfig } from '../sim/state';

export const PROTO_VERSION = 1;
/** Local inputs are scheduled for tick T+D — latency headroom (~71 ms @ 42 Hz). */
export const INPUT_DELAY_TICKS = 3;
/** Hash sentinel cadence (once per second of sim time). */
export const HASH_EVERY_TICKS = 42;

export type NetMessage =
  /** Version handshake — first message both ways on a fresh channel. */
  | { m: 'hi'; proto: number; saveV: number }
  /** Host → guest: your seat and the session size. */
  | { m: 'join'; player: number; players: number }
  /** Host → all: fresh run parameters (both sides call createRun identically). */
  | { m: 'start'; seed: number; mode: ModeConfig; level: number }
  /** Host → all: a chunked CLD1 save-code follows (resume). */
  | { m: 'resume'; chunks: number }
  | { m: 'chunk'; i: number; n: number; data: string }
  /** Guest → host: my input (and queued commands) for tick t. */
  | { m: 'in'; t: number; frame: IntentFrame; cmds: Command[] }
  /** Host → all: the authoritative inputs for tick t (index = player). */
  | { m: 'bundle'; t: number; frames: IntentFrame[]; cmds: Command[][] }
  /** Desync sentinel — guests report, the host compares. */
  | { m: 'hash'; t: number; h: number }
  /** Synchronized pause/resume, effective at a tick boundary. */
  | { m: 'pause'; on: boolean }
  /** A player dropped (host notice) — their future frames read EMPTY. */
  | { m: 'dropped'; player: number }
  | { m: 'bye' };

export const encodeMsg = (msg: NetMessage): string => JSON.stringify(msg);

export function decodeMsg(text: string): NetMessage | null {
  try {
    const v = JSON.parse(text) as NetMessage;
    return typeof v === 'object' && v !== null && typeof v.m === 'string' ? v : null;
  } catch {
    return null;
  }
}
