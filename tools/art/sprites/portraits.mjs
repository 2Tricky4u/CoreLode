/** Transmission portraits — 24×24 char grids ×2 → 48px, framed by the dialog CSS. */
import { grid } from '../grid.mjs';
import { P } from '../palette.mjs';
import { Sprite, texRng } from '../png.mjs';

const L = {
  o: P.black,
  k: P.pancho, // skin
  K: P.twine, // skin shadow
  b: P.valhalla, // dark suit / bg
  B: P.deepKoamaru, // suit light
  w: P.white,
  W: P.lightSteel,
  t: P.mandy, // tie
  y: P.goldenFizz,
  h: P.rope, // hat / horn
  H: P.oiledCedar,
  g: P.atlantis, // console green
  G: P.christi,
  d: P.opal, // panel dark
  v: P.viking,
  r: P.brown,
  e: P.goldenFizz, // demon eyes
  s: P.loulou,
  m: P.smokeyAsh,
};

// biome-ignore format: pixel grids are aligned by hand
const EMPLOYER = [
  'bbbbbbbbbbbbbbbbbbbbbbbb',
  'bbbbbbboooooooooobbbbbbb',
  'bbbbbboBBBBBBBBBBobbbbbb',
  'bbbbboBBBBBBBBBBBBobbbbb',
  'bbbboBBkkkkkkkkkkBBobbbb',
  'bbbokkkkkkkkkkkkkkkobbbb',
  'bbbokkkkkkkkkkkkkkkobbbb',
  'bbbokkorrokkkkoyyyokobbb',
  'bbbokkorrokkkkoyryokobbb',
  'bbbokkkkkkkkkkoyyyokobbb',
  'bbbokkkkkkkkkkkkkoyobbbb',
  'bbbokKkkkooookkkkkKobbbb',
  'bbbboKkkkkkkkkkkkKobbbbb',
  'bbbbooKKKKKKKKKKKoobbbbb',
  'bbbooooooooooooooooobbbb',
  'bboBBBBBwwwwwwwBBBBBobbb',
  'bboBBBBwwwtttwwwBBBBobbb',
  'boBBBBBwwtttttwwBBBBBobb',
  'boBBBBBwwtttttwwBBBBBobb',
  'boBBBBwwwtttttwwwBBBBobb',
  'boBBBBwwwwtttwwwwBBBBobb',
  'boBBBBwwwwtttwwwwBBBBobb',
  'boBBBBwwwwtttwwwwBBBBobb',
  'bbbbbbbbbbbbbbbbbbbbbbbb',
];

// biome-ignore format: pixel grids are aligned by hand
const EMPLOYER_TRUE = [
  'ssssssssssssssssssssssss',
  'ssohhossssssssssssohhoss',
  'sohhhossssssssssssohhhos',
  'sohhossssssssssssssohhos',
  'ssohhoooooooooooooohhoss',
  'sssoorrrrrrrrrrrrroossss',
  'ssorrrrrrrrrrrrrrrrrosss',
  'ssorrrrrrrrrrrrrrrrrosss',
  'ssorreeorrrrrrroeeorross',
  'ssorreeorrrrrrroeeorross',
  'ssorrrrrrrrrrrrrrrrrosss',
  'ssorrrrrooooooorrrrrosss',
  'ssorrrrosswwsssorrrrosss',
  'sssorrrosssssssorrrossss',
  'sssoorrrrooooorrrroossss',
  'sssssorrrrrrrrrrrossssss',
  'ssssssooorrrrrooosssssss',
  'sssssssssrrrrrssssssssss',
  'ssssooooooooooooooosssss',
  'sssorrooyyyyyyyoorrrosss',
  'ssorrrroyyyyyyyorrrrross',
  'ssorrrroyyyyyyyorrrrross',
  'ssorrrrooooooooorrrrross',
  'ssssssssssssssssssssssss',
];

// biome-ignore format: pixel grids are aligned by hand
const MINER = [
  'dddddddddddddddddddddddd',
  'ddddddhhhhhhhhhhdddddddd',
  'dddddhhhhhhhhhhhhddddddd',
  'ddddohHHHHHHHHHHhoddddddd',
  'ddddohhhhhhhhhhhhoddddddd',
  'dddddooooooooooooddddddd',
  'ddddokkkkkkkkkkkkoddddddd',
  'ddddokkkkkkkkkkkkoddddddd',
  'ddddokkoWWokkoWWokodddddd',
  'ddddokkoWWokkoWWokodddddd',
  'ddddokkkkkkkkkkkkoddddddd',
  'ddddokkkkkkkkkkkkoddddddd',
  'ddddokKmmmmmmmmKkodddddd',
  'ddddokmmmmmmmmmmkodddddd',
  'dddddoKmmmmmmmmKoddddddd',
  'ddddddoKKKKKKKKodddddddd',
  'dddooooooooooooooooddddd',
  'ddoBvvBBBBBBBBBBvvBodddd',
  'ddoBvvBBBBBBBBBBvvBodddd',
  'doBBvvBBBBBBBBBBvvBBoddd',
  'doBBvvBBByyyyBBBvvBBoddd',
  'doBBBBBByyyyyyBBBBBBoddd',
  'doBBBBBBBBBBBBBBBBBBoddd',
  'dddddddddddddddddddddddd',
];

// biome-ignore format: pixel grids are aligned by hand
const DISPATCH = [
  'dddddddddddddddddddddddd',
  'ddooooooooooooooooooooood',
  'ddoggggggggggggggggggodd',
  'ddogGGGGGGGGGGGGGGGGGodd',
  'ddoggggggggggggggggggodd',
  'ddogGGgggGGGGgggGGGggodd',
  'ddoggggggggggggggggggodd',
  'ddogGGGGGGGggggGGGgggodd',
  'ddoggggggggggggggggggodd',
  'ddogggGGGgggGGGGGggggodd',
  'ddoggggggggggggggggggodd',
  'ddooooooooooooooooooooood',
  'ddddddddooooooodddddddddd',
  'dddddddommmmmmoddddddddd',
  'ddddddommmmmmmmodddddddd',
  'dddddommmmmmmmmmoddddddd',
  'ddddommmmmmmmmmmmodddddd',
  'dddommmmmmmmmmmmmmoddddd',
  'ddommmmmmmmmmmmmmmmodddd',
  'ddoooooooooooooooooodddd',
  'dddddddddddddddddddddddd',
  'dddddddddddddddddddddddd',
  'dddddddddddddddddddddddd',
  'dddddddddddddddddddddddd',
];

// biome-ignore format: pixel grids are aligned by hand
const DEITY = [
  'bbbbbbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbwyywbbbbbbbbbbb',
  'bbbbbbbwyyyyyywbbbbbbbbb',
  'bbbbbwyyyyyyyyyywbbbbbbb',
  'bbbbyyyywwwwwwyyyybbbbbb',
  'bbbwyyywwwwwwwwyyywbbbbb',
  'bbbyyywwwwwwwwwwyyybbbbb',
  'bbwyyywwwwwwwwwwyyywbbbb',
  'bbyyyywwwwwwwwwwyyyybbbb',
  'bbyyyywwwwwwwwwwyyyybbbb',
  'bbwyyywwwwwwwwwwyyywbbbb',
  'bbbyyywwwwwwwwwwyyybbbbb',
  'bbbwyyywwwwwwwwyyywbbbbb',
  'bbbbyyyywwwwwwyyyybbbbbb',
  'bbbbbwyyyyyyyyyywbbbbbbb',
  'bbbbbbbwyyyyyywbbbbbbbbb',
  'bbbbbbbbbwyywbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbbbbbb',
  'bbbywbbbbbbbbbbbbbwybbbb',
  'bbbbbbbbwbbbbbwbbbbbbbbb',
  'bbbbbybbbbbbbbbbbybbbbbb',
  'bbbbbbbbbbbybbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbbbbbb',
];

export function portraitFrames() {
  const out = {
    portrait_employer: grid(EMPLOYER, L),
    portrait_employerTrue: grid(EMPLOYER_TRUE, L),
    portrait_minerRig7: grid(MINER, L),
    portrait_dispatch: grid(DISPATCH, L),
    portrait_deity: grid(DEITY, L),
  };
  // static — seeded noise, no grid needed
  const st = new Sprite(48, 48);
  const rnd = texRng(0x57a7);
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 48; x++) {
      const v = rnd();
      st.px(x, y, v < 0.45 ? P.opal : v < 0.8 ? P.smokeyAsh : P.heather);
    }
  for (let y = 0; y < 48; y += 5) st.rect(0, y, 48, 1, P.valhalla); // scanlines
  out.portrait_static = st;
  return out;
}
