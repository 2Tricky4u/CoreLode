/**
 * Scripted events: transmissions (exact original trigger depths + bonuses),
 * sky easter eggs, and the altimeter-glitch thresholds (in constants.ts).
 * All display text is looked up in content/strings.ts by `key`.
 */
import { CAL } from './physics';

export type Portrait = 'employer' | 'employerTrue' | 'minerRig7' | 'static' | 'dispatch' | 'deity';

export interface TransmissionDef {
  id: string;
  /** Trigger: pod depth (ft, negative) reaches at or below this value.
   *  Sentinels: 'start' fires on new game; 'bossIntro'/'bossForm2' fire from the boss FSM. */
  trigger: number | 'start' | 'bossIntro' | 'bossForm2' | 'victory';
  bonus: number; // $ wired with the message
  speakerKey: string;
  textKey: string;
  portrait: Portrait;
}

/** Exact original depths: −1(start)/500/1000/1750/2100/2500/3100/3500/4100/4500/6200/7000 + boss sentinels. */
export const TRANSMISSIONS: readonly TransmissionDef[] = [
  {
    id: 'tx-start',
    trigger: 'start',
    bonus: 0,
    speakerKey: 'spkEmployer',
    textKey: 'txStart',
    portrait: 'employer',
  },
  {
    id: 'tx-500',
    trigger: -500,
    bonus: 1_000,
    speakerKey: 'spkEmployer',
    textKey: 'tx500',
    portrait: 'employer',
  },
  {
    id: 'tx-1000',
    trigger: -1_000,
    bonus: 3_000,
    speakerKey: 'spkEmployer',
    textKey: 'tx1000',
    portrait: 'employer',
  },
  {
    id: 'tx-1750',
    trigger: -1_750,
    bonus: 0,
    speakerKey: 'spkUnknown',
    textKey: 'tx1750',
    portrait: 'static',
  },
  {
    id: 'tx-2100',
    trigger: -2_100,
    bonus: 0,
    speakerKey: 'spkRig7',
    textKey: 'tx2100',
    portrait: 'minerRig7',
  },
  {
    id: 'tx-2500',
    trigger: -2_500,
    bonus: 0,
    speakerKey: 'spkOpenChannel',
    textKey: 'tx2500',
    portrait: 'static',
  },
  {
    id: 'tx-3100',
    trigger: -3_100,
    bonus: 0,
    speakerKey: 'spkRig7',
    textKey: 'tx3100',
    portrait: 'minerRig7',
  },
  {
    id: 'tx-3500',
    trigger: -3_500,
    bonus: 25_000,
    speakerKey: 'spkEmployer',
    textKey: 'tx3500',
    portrait: 'employer',
  },
  {
    id: 'tx-4100',
    trigger: -4_100,
    bonus: 0,
    speakerKey: 'spkRig7',
    textKey: 'tx4100',
    portrait: 'minerRig7',
  },
  {
    id: 'tx-4500',
    trigger: -4_500,
    bonus: 0,
    speakerKey: 'spkRig9',
    textKey: 'tx4500',
    portrait: 'static',
  },
  {
    id: 'tx-6200',
    trigger: -6_200,
    bonus: 0,
    speakerKey: 'spkEmployer',
    textKey: 'tx6200',
    portrait: 'employer',
  },
  {
    id: 'tx-7000',
    trigger: -7_000,
    bonus: 0,
    speakerKey: 'spkEmployer',
    textKey: 'tx7000',
    portrait: 'employer',
  },
  {
    id: 'tx-boss',
    trigger: 'bossIntro',
    bonus: 0,
    speakerKey: 'spkEmployer',
    textKey: 'txBossIntro',
    portrait: 'employerTrue',
  },
  {
    id: 'tx-form2',
    trigger: 'bossForm2',
    bonus: 0,
    speakerKey: 'spkEmployer',
    textKey: 'txBossForm2',
    portrait: 'employerTrue',
  },
  {
    id: 'tx-victory',
    trigger: 'victory',
    bonus: 0,
    speakerKey: 'spkEmployer',
    textKey: 'txVictory',
    portrait: 'employerTrue',
  },
];

/** Sky easter eggs — trigger when ALTITUDE (positive ft above surface) exceeds the value. */
export interface SkyEggDef {
  id: string;
  altitudeFt: number;
  bonus: number;
  spawnsGuardian: boolean;
  speakerKey: string;
  textKey: string;
  portrait: Portrait;
}

export const SKY_EGGS: readonly SkyEggDef[] = [
  {
    id: 'egg-5000',
    altitudeFt: 5_000,
    bonus: CAL(10_000, 'original altitude-bonus amount not recovered'),
    spawnsGuardian: false,
    speakerKey: 'spkDispatch',
    textKey: 'egg5000',
    portrait: 'dispatch',
  },
  {
    id: 'egg-10000',
    altitudeFt: 10_000,
    bonus: 0,
    spawnsGuardian: true, // the Seraph: all incoming damage ×0.5 while present
    speakerKey: 'spkNoCallerId',
    textKey: 'egg10000',
    portrait: 'static',
  },
  {
    id: 'egg-100000',
    altitudeFt: 100_000,
    bonus: 0,
    spawnsGuardian: false,
    speakerKey: 'spkDeity',
    textKey: 'egg100000',
    portrait: 'deity',
  },
];

export const GUARDIAN_DAMAGE_FACTOR = 0.5;
