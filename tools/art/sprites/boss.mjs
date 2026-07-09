/**
 * Boss — 50×70 char grids ×2 → 100×140. (v2 after round-1 critique: readable
 * face on both forms, gold monocle ring + chain, 2px cane, three-talon claw.)
 * Form 1 "the foreman": tall suit, slick hair, subtle horn tips, obsidian cane.
 * Form 2 "the tyrant": horned demon, furnace-grate chest, talon arm, hooves.
 * Light: top-left.
 */
import { grid } from '../grid.mjs';
import { P } from '../palette.mjs';

const L1 = {
  o: P.black,
  s: P.valhalla, // suit shadow / hair
  b: P.deepKoamaru, // suit base
  l: P.royalBlue, // suit light
  k: P.pancho, // skin
  K: P.twine, // skin shadow
  h: P.rope, // horn tips
  w: P.white,
  W: P.lightSteel,
  t: P.mandy, // tie
  T: P.brown, // tie shadow
  y: P.goldenFizz, // monocle + chain
  c: P.smokeyAsh, // cane
  C: P.heather, // cane light
  r: P.mandy, // eye glint
};

// biome-ignore format: pixel grids are aligned by hand
const FORM1 = [
  '..................oo........oo....................',
  '.................ohho......ohho...................',
  '.................oohhoooooohhoo...................',
  '..................ossssssssssso...................',
  '.................ossssssssssssso..................',
  '.................oslssssssssssso..................',
  '.................oskkkkkkkkkkkso..................',
  '.................okkkkkkkkkkkkko..................',
  '.................okoookkkkooooko..................',
  '.................okorrokkoyyyyoo..................',
  '.................okorrokkoykkyoo..................',
  '.................okkkkkkkoyyyyoo..................',
  '.................okkkkkkkkkoyoko..................',
  '.................oKkkoooookkoyko..................',
  '.................oKkkkkkkkkkoyko..................',
  '..................ooKKKKKKKKoyo...................',
  '..............oooooooooooooooooooo................',
  '...........ooolllllbbbbbbbbbbbbsooo...............',
  '..........ollllllbbbbbbbbbbbbbbbssoo..............',
  '.........ollllbbbbbwwwwwwbbbbbbbbsso..............',
  '........ollllbbbbbwwwwwwwwbbbbbbbsssoo............',
  '........ollbbbbbbwwwtttwwwwbbbbbbbssCCo...........',
  '.......ollbbbbbbbwwtttttwwwbbbbbbbssoCCo..........',
  '.......olbbbo.bbbwwtttttwwwbbb.obbssoCCo..........',
  '.......olbbo..bbwwwwtttwwwwbbb..obssoCCo..........',
  '.......olbo...bbwwwwtttwwwwbbb...obsoCCo..........',
  '.......obbo...bbwwwwTTTwwwwbbb...obsoCCo..........',
  '.......obbo...bbwwwwTTTwwwwbbb...obsoCCo..........',
  '.......obbo...bbbwwwTTTwwwbbbb...obsoCCo..........',
  '.......olbo...bbbwwwTTTwwwbbbb...obsoCCo..........',
  '.......olbo...bbbbwwTTTwwbbbbb...obsoCCo..........',
  '.......olbo...bbbbbwTTTwbbbbbb...obsoCCo..........',
  '.......olbo...bbbbbbTTTbbbbbbb...obsoCCo..........',
  '.......okko...bbbbbbbTbbbbbbbb...okkoCCo..........',
  '.......okko...bbbbbbbbbbbbbbbb...okkoCco..........',
  '.......oooo...bbbbbbbbbbbbbbbb...ooooCco..........',
  '..............bbbbbbbbbbbbbbbb......oCco..........',
  '..............obbbbbbbbbbbbbbo......oCco..........',
  '..............obbbbbbbbbbbbbso......oCco..........',
  '..............obbbbbbbbbbbbsso......oCco..........',
  '..............oobbbbbbbbbbsoo.......oCco..........',
  '...............obbbbossbbbso........oCco..........',
  '...............obbbso..obbso........oCco..........',
  '...............obbso....obso........oCco..........',
  '...............obbo......obo........oCco..........',
  '...............obbo......obo........oCco..........',
  '...............obbo......obo........oCco..........',
  '...............obbo......obo........oCco..........',
  '...............obbo......obo........oCco..........',
  '...............obbo......obo........oCco..........',
  '...............osbo......osbo.......oCco..........',
  '...............osbo......osbo.......oCco..........',
  '...............osbo......osbo.......oCco..........',
  '...............osbo......osbo.......oCco..........',
  '..............oosboo.....osboo......oCco..........',
  '.............ossssso....ossssso....ooCcoo.........',
  '.............ossssso....ossssso....oCCcco.........',
  '..............ooooo......ooooo......oooo..........',
  '...................................................',
  '...................................................',
];

const L2 = {
  o: P.black,
  s: P.loulou, // body shadow
  b: P.brown, // body base
  l: P.mandy, // body light
  h: P.pancho, // horn
  H: P.twine, // horn shadow
  y: P.goldenFizz, // furnace core
  Y: P.tahitiGold, // furnace glow
  g: P.valhalla, // grate bars
  e: P.goldenFizz, // eyes
  c: P.heather, // claw
  C: P.lightSteel, // claw light
  k: P.smokeyAsh, // hoof
  w: P.white,
};

// biome-ignore format: pixel grids are aligned by hand
const FORM2 = [
  '......ohh..........................hho.............',
  '.....ohhho........................ohhho............',
  '....ohhhHo........................oHhhho...........',
  '....ohhHo..........................oHhho...........',
  '....ohhHo..........................oHhho...........',
  '.....ohhHoo......................ooHhho............',
  '......ohhHHoooooooooooooooooooooHHhho..............',
  '.......oossbbbbbbbbbbbbbbbbbbbbssoo................',
  '.........olbbbbbbbbbbbbbbbbbbbso..................',
  '........olbooooobbbbbbbbooooobso..................',
  '........olboeeeobbbbbbbboeeeobso..................',
  '........olboeeeobbbbbbbboeeeobso..................',
  '........olbbooobbbssssbbboooobso..................',
  '.........olbbbbbosswwsssobbbbso...................',
  '.........olbbbbboswowowsobbbso....................',
  '..........oolbbbosssssssobboo.....................',
  '...........ooolbbbbbbbbbooo.......................',
  '..........ooollllbbbbbbbbsoo......................',
  '........oolllllbbbbbbbbbbbssoo....................',
  '.......ollllbbbbbbbbbbbbbbbssso...................',
  '......ollllbbbbbbbbbbbbbbbbbssso..................',
  '.....ollllbbbooooooooooobbbbssssoo................',
  '.....olllbbboYYYYYYYYYYYobbbsssssso...............',
  '....olllbbbboYyyyyyyyyyYobbbbsssoo................',
  '....ollbbbbboYygygygyggYobbbbbssoCCo..............',
  '....ollbbbbboYyyyyyyyyyYobbbbbsooCCCo.............',
  '....olbbo..boYygygygyggYob..bso.oCoCCo............',
  '....olbo...boYyyyyyyyyyYob...bso.o.oCCo...........',
  '....olbo...boYygygygyggYob...bso....oCo...........',
  '....obbo...boYYYYYYYYYYYob...bso...oCCo...........',
  '....obbo...bbooooooooooobb...bso..oCCo............',
  '....obbo...bbbbbbbbbbbbbbb...bso.oCo..............',
  '....olbo...bbbbbbbbbbbbbbb...oso..o...............',
  '....olbo...obbbbbbbbbbbbbo...oso..................',
  '....occo...obbbbbbbbbbbbso...occo.................',
  '....occco..obbbbbbbbbbbsso..occco.................',
  '....occcco.oobbbbbbbbbsoo..occcco.................',
  '.....ooooo..obbbbossbbso...ooooo..................',
  '.............obbso.obbso..........................',
  '.............obbo...obbo..........................',
  '.............obbo...obbo..........................',
  '.............obbo...obbo..........................',
  '.............osbo...osbo..........................',
  '.............osbo...osbo..........................',
  '.............osbo...osbo..........................',
  '............oosbo...osboo.........................',
  '............okkko...okkkoo........................',
  '...........okkkkko.okkkkkko.......................',
  '...........okkkkko.okkkkkko.......................',
  '............ooooo...ooooo.........................',
  '...................................................',
  '...................................................',
];

export function bossFrames() {
  const f1 = grid(FORM1, L1);
  const f2 = grid(FORM2, L2);
  return {
    boss1_a: f1,
    boss1_b: f1.shifted(0, -2),
    boss2_a: f2,
    boss2_b: f2.shifted(0, -2),
  };
}
