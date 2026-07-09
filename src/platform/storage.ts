import type { SaveFile } from '@core/index';
import type { SettingsValues } from '@core/index';
/** IndexedDB persistence via idb-keyval. Keys: save:manual:N, save:auto:N, settings, records. */
import { clear, del, get, keys, set } from 'idb-keyval';

export interface SlotMeta {
  key: string;
  updatedAt: number;
  depthFt: number;
  cash: number;
  level: number;
}

const SLOT_PREFIX = 'save:';

/**
 * Race a storage promise against a timeout. IndexedDB `open` can HANG (never
 * resolve or reject) on a corrupt profile or a stuck connection — a try/catch
 * can't save that, so every read on the boot path is time-bounded. On timeout
 * (or error) we return the fallback and carry on, so a wedged IDB never freezes
 * the app; it just means this session can't persist until storage recovers.
 */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(p).catch(() => fallback),
    new Promise<T>((res) => setTimeout(() => res(fallback), ms)),
  ]);
}

export async function writeSave(slot: string, save: SaveFile): Promise<void> {
  // Dual-write: keep the previous copy for corruption recovery.
  const key = `${SLOT_PREFIX}${slot}`;
  const prev = await get(key);
  if (prev) await set(`${key}:prev`, prev);
  await set(key, save);
}

export async function readSave(slot: string): Promise<unknown> {
  return await get(`${SLOT_PREFIX}${slot}`);
}

export async function readSaveBackup(slot: string): Promise<unknown> {
  return await get(`${SLOT_PREFIX}${slot}:prev`);
}

export async function deleteSave(slot: string): Promise<void> {
  await del(`${SLOT_PREFIX}${slot}`);
  await del(`${SLOT_PREFIX}${slot}:prev`);
}

export function listSaves(): Promise<SlotMeta[]> {
  // Never let a storage hiccup, one malformed slot, or a hung IDB blank the title.
  const inner = async (): Promise<SlotMeta[]> => {
    const all = (await keys()) as string[];
    const out: SlotMeta[] = [];
    for (const k of all) {
      if (typeof k !== 'string' || !k.startsWith(SLOT_PREFIX) || k.endsWith(':prev')) continue;
      try {
        const raw = (await get(k)) as SaveFile | undefined;
        if (!raw) continue;
        out.push({
          key: k.slice(SLOT_PREFIX.length),
          updatedAt: raw.updatedAt ?? 0,
          depthFt: raw.story?.maxDepthFt ?? 0,
          cash: raw.pod?.cash ?? 0,
          level: raw.level ?? 1,
        });
      } catch {
        /* skip an unreadable slot */
      }
    }
    return out.sort((a, b) => a.key.localeCompare(b.key));
  };
  return withTimeout(inner(), 3000, []);
}

export async function writeSettings(values: SettingsValues): Promise<void> {
  await set('settings', values);
}
export function readSettings(): Promise<SettingsValues | undefined> {
  // Time-bounded: a hung IDB must not block boot (this runs before Phaser starts).
  return withTimeout(get('settings') as Promise<SettingsValues | undefined>, 2500, undefined);
}

export interface ChallengeRecords {
  [id: string]: { bestTicks: number; completions: number };
}
export function readRecords(): Promise<ChallengeRecords> {
  return withTimeout(
    Promise.resolve(get('records') as Promise<ChallengeRecords | undefined>).then((r) => r ?? {}),
    2500,
    {},
  );
}

/**
 * Wipe all persisted data (saves, settings, records) — the recovery escape hatch.
 * Never hangs, and hard-deletes the whole IDB database as a fallback so it works
 * even when the keyval store itself is wedged.
 */
export async function clearAllData(): Promise<void> {
  await withTimeout(
    Promise.resolve(clear()).catch(() => undefined),
    1500,
    undefined,
  );
  try {
    // Fire-and-forget hard reset — un-wedges a corrupt idb-keyval store.
    indexedDB.deleteDatabase('keyval-store');
  } catch {
    /* ignore */
  }
}
export async function writeRecords(r: ChallengeRecords): Promise<void> {
  await set('records', r);
}

export async function requestPersistence(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* best-effort */
  }
}
