/** Buried artifacts + relic slate — 25×25 char grids ×2 → 50px overlays. */
import { grid } from '../grid.mjs';
import { P } from '../palette.mjs';

const L = {
  o: P.black,
  n: P.pancho, // bone light
  N: P.twine, // bone
  m: P.rope, // bone shadow
  c: P.stinger, // chest wood
  C: P.twine, // chest light
  d: P.oiledCedar, // chest dark
  y: P.goldenFizz,
  Y: P.tahitiGold,
  h: P.heather, // xeno bone
  H: P.lightSteel,
  t: P.topaz,
  v: P.viking,
  V: P.venicBlue,
  R: P.royalBlue,
  w: P.white,
};

// biome-ignore format: pixel grids are aligned by hand
const FOSSIL = [
  '.........................',
  '.........................',
  '......ooo................',
  '.....onnno..ooo..........',
  '.....onmnooonnno.........',
  '.....onnnnnnnmnno........',
  '......oonnnnnnnnno.......',
  '........oonnnnnnno.......',
  '..........onnmnno........',
  '.........onnnnno.........',
  '........onnnoo...........',
  '.......onnno.............',
  '.......onno..............',
  '.......onnooooooo........',
  '.......onnnnnnnnno.......',
  '........onnmnnmnnno......',
  '.........ooonnnoono......',
  '...........onno..........',
  '..........onno...........',
  '.....o....onno....o......',
  '....ono..onnno...ono.....',
  '....ommoonnmnnoommo......',
  '.....oommnnnnmmoo........',
  '.......ooooooo...........',
  '.........................',
];

// biome-ignore format: pixel grids are aligned by hand
const CACHE = [
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '......ooooooooooooo......',
  '.....oCCCCCCCCCCCCCo.....',
  '....oCCccccccccccccco....',
  '....oCcccccccccccccdo....',
  '....oCcccccccccccccdo....',
  '....ooooooooooooooooo....',
  '....oCccccooyooccccdo....',
  '....oCccccoyyyoccccdo....',
  '....oCccccoyYyoccccdo....',
  '....oCcccccoYocccccdo....',
  '....oCcccccooocccccdo....',
  '....oCcccccccccccccdo....',
  '....oCcccccccccccccdo....',
  '....odddddddddddddddo....',
  '.....ooooooooooooooo.....',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
];

// biome-ignore format: pixel grids are aligned by hand
const XENO = [
  '.........................',
  '.........................',
  '........ooooo............',
  '.......oHHHHHo...........',
  '......oHHHHHHHo..........',
  '......oHooHooHo..........',
  '......oHooHooHo..........',
  '......oHHHHHHHo..........',
  '.......oHhhhHo...........',
  '........ooooo............',
  '.........ohho............',
  '....ooooohhhooooo........',
  '...ohhhhhhhhhhhhho.......',
  '....ooooohhhooooo........',
  '.........ohho............',
  '....ooooohhhooooo........',
  '...ohhhhhhhhhhhhho.......',
  '....ooooohhhooooo........',
  '.........ohho............',
  '........ohhhho...........',
  '.......ohho.ohho.........',
  '......ohho...ohho........',
  '.......oo.....oo.........',
  '.........................',
];

// biome-ignore format: pixel grids are aligned by hand
const IDOL = [
  '.........................',
  '.........................',
  '.........ooooo...........',
  '........oyyyyyo..........',
  '.......oyyYYYyyo.........',
  '.......oyoYYYoyo.........',
  '.......oyyYYYyyo.........',
  '........oyyyyyo..........',
  '.........ooooo...........',
  '........oyyyyyo..........',
  '.......oyyYyYyyo.........',
  '......oyyYyyyYyyo........',
  '......oyYyyyyyYyo........',
  '......oyYyyyyyYyo........',
  '......oyyYyyyYyyo........',
  '.......oyyYYYyyo.........',
  '........oyyyyyo..........',
  '......ooooooooooo........',
  '.....oYYYYYYYYYYYo.......',
  '....oYYyyyyyyyyyYYo......',
  '....oooooooooooooo.......',
  '.........................',
  '.........................',
  '.........................',
];

// biome-ignore format: pixel grids are aligned by hand
const SLATE = [
  '.........................',
  '.........................',
  '.........................',
  '.....ooooooooooooooo.....',
  '....oVVVVVVVVVVVVVVVo....',
  '....oVRRRRRRRRRRRRRVo....',
  '....oVRvvvvvvvvvvvRVo....',
  '....oVRvwvwvwvwvwvRVo....',
  '....oVRvvvvvvvvvvvRVo....',
  '....oVRvwvwvwvvvvvRVo....',
  '....oVRvvvvvvvvvvvRVo....',
  '....oVRvwvwvwvwvvvRVo....',
  '....oVRvvvvvvvvvvvRVo....',
  '....oVRvvwvwvvvvvvRVo....',
  '....oVRvvvvvvvvvvvRVo....',
  '....oVRRRRRRRRRRRRRVo....',
  '....oVVVVVVVVVVVVVVVo....',
  '.....ooooooooooooooo.....',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
];

export function artifactFrames() {
  return {
    gem10: grid(FOSSIL, L),
    gem11: grid(CACHE, L),
    gem12: grid(XENO, L),
    gem13: grid(IDOL, L),
    slate: grid(SLATE, L),
  };
}
