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

export async function listSaves(): Promise<SlotMeta[]> {
  // Never let a storage hiccup or one malformed slot blank the title screen.
  try {
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
  } catch {
    return [];
  }
}

export async function writeSettings(values: SettingsValues): Promise<void> {
  await set('settings', values);
}
export async function readSettings(): Promise<SettingsValues | undefined> {
  try {
    return (await get('settings')) as SettingsValues | undefined;
  } catch {
    return undefined; // fall back to defaults rather than blocking boot
  }
}

export interface ChallengeRecords {
  [id: string]: { bestTicks: number; completions: number };
}
export async function readRecords(): Promise<ChallengeRecords> {
  try {
    return ((await get('records')) as ChallengeRecords | undefined) ?? {};
  } catch {
    return {};
  }
}

/** Wipe all persisted data (saves, settings, records) — the recovery escape hatch. */
export async function clearAllData(): Promise<void> {
  try {
    await clear();
  } catch {
    /* best-effort */
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
