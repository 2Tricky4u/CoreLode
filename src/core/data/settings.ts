/**
 * Settings registry. Anything with `affectsFidelity: true` defaults OFF and is
 * force-disabled by puristMode, so the authentic experience is provably intact.
 */

export interface SettingDef<T extends boolean | number | string = boolean | number | string> {
  id: string;
  labelKey: string;
  category: 'video' | 'audio' | 'controls' | 'assist' | 'fidelity';
  type: 'bool' | 'range' | 'enum';
  default: T;
  min?: number;
  max?: number;
  options?: readonly string[];
  affectsFidelity: boolean;
}

export const SETTING_DEFS: readonly SettingDef[] = [
  {
    id: 'musicVol',
    labelKey: 'setMusicVol',
    category: 'audio',
    type: 'range',
    default: 0.7,
    min: 0,
    max: 1,
    affectsFidelity: false,
  },
  {
    id: 'sfxVol',
    labelKey: 'setSfxVol',
    category: 'audio',
    type: 'range',
    default: 1,
    min: 0,
    max: 1,
    affectsFidelity: false,
  },
  {
    id: 'screenShake',
    labelKey: 'setScreenShake',
    category: 'video',
    type: 'bool',
    default: true,
    affectsFidelity: false,
  },
  {
    id: 'damageFlash',
    labelKey: 'setDamageFlash',
    category: 'video',
    type: 'bool',
    default: true,
    affectsFidelity: false,
  },
  {
    id: 'pixelPerfect',
    labelKey: 'setPixelPerfect',
    category: 'video',
    type: 'bool',
    default: true,
    affectsFidelity: false,
  },
  {
    id: 'fxDensity',
    labelKey: 'setFxDensity',
    category: 'video',
    type: 'enum',
    default: 'full',
    options: ['full', 'reduced'],
    affectsFidelity: false,
  },
  {
    id: 'ambientLife',
    labelKey: 'setAmbientLife',
    category: 'video',
    type: 'bool',
    default: true,
    affectsFidelity: false,
  },
  {
    id: 'controlScheme',
    labelKey: 'setControlScheme',
    category: 'controls',
    type: 'enum',
    default: 'classic',
    options: ['classic', 'vim'],
    affectsFidelity: false,
  },
  {
    id: 'touchControls',
    labelKey: 'setTouchControls',
    category: 'controls',
    type: 'enum',
    default: 'auto',
    options: ['auto', 'on', 'off'],
    affectsFidelity: false,
  },
  {
    id: 'touchLayout',
    labelKey: 'setTouchLayout',
    category: 'controls',
    type: 'enum',
    default: 'right',
    options: ['left', 'right'],
    affectsFidelity: false,
  },
  // Fidelity-affecting QoL — all default OFF.
  {
    id: 'autosaveOnSurface',
    labelKey: 'setAutosave',
    category: 'fidelity',
    type: 'bool',
    default: false,
    affectsFidelity: true,
  },
  {
    id: 'minimap',
    labelKey: 'setMinimap',
    category: 'fidelity',
    type: 'bool',
    default: false,
    affectsFidelity: true,
  },
  {
    id: 'speedrunTimer',
    labelKey: 'setSpeedrunTimer',
    category: 'fidelity',
    type: 'bool',
    default: false,
    affectsFidelity: true,
  },
  {
    id: 'oreGlyphs',
    labelKey: 'setOreGlyphs',
    category: 'fidelity',
    type: 'bool',
    default: false,
    affectsFidelity: true,
  },
  {
    id: 'gasShimmerHint',
    labelKey: 'setGasShimmer',
    category: 'fidelity',
    type: 'bool',
    default: false,
    affectsFidelity: true,
  },
  {
    id: 'seededRuns',
    labelKey: 'setSeededRuns',
    category: 'fidelity',
    type: 'bool',
    default: false,
    affectsFidelity: true,
  },
  {
    id: 'fuelFailsafe',
    labelKey: 'setFuelFailsafe',
    category: 'fidelity',
    type: 'bool',
    default: false,
    affectsFidelity: true,
  },
  {
    id: 'objectivesPanel',
    labelKey: 'setObjectivesPanel',
    category: 'fidelity',
    type: 'bool',
    default: false,
    affectsFidelity: true,
  },
  {
    id: 'puristMode',
    labelKey: 'setPuristMode',
    category: 'fidelity',
    type: 'bool',
    default: false,
    affectsFidelity: false,
  },
];

export type SettingsValues = Record<string, boolean | number | string>;

export const defaultSettings = (): SettingsValues =>
  Object.fromEntries(SETTING_DEFS.map((s) => [s.id, s.default]));

/** Apply puristMode: force every fidelity-affecting toggle off. */
export function effectiveSettings(values: SettingsValues): SettingsValues {
  if (!values.puristMode) return values;
  const out = { ...values };
  for (const def of SETTING_DEFS) {
    if (def.affectsFidelity) out[def.id] = def.type === 'bool' ? false : def.default;
  }
  return out;
}
