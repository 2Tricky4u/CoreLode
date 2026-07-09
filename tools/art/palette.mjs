/** DB32 palette (public domain) + material ramps. One light source: TOP-LEFT. */

export const P = {
  black: [0, 0, 0],
  valhalla: [34, 32, 52],
  loulou: [69, 40, 60],
  oiledCedar: [102, 57, 49],
  rope: [143, 86, 59],
  tahitiGold: [223, 113, 38],
  twine: [217, 160, 102],
  pancho: [238, 195, 154],
  goldenFizz: [251, 242, 54],
  atlantis: [153, 229, 80],
  christi: [106, 190, 48],
  elfGreen: [55, 148, 110],
  dell: [75, 105, 47],
  verdigris: [82, 75, 36],
  opal: [50, 60, 57],
  deepKoamaru: [63, 63, 116],
  venicBlue: [48, 96, 130],
  royalBlue: [91, 110, 225],
  cornflower: [99, 155, 255],
  viking: [95, 205, 228],
  lightSteel: [203, 219, 252],
  white: [255, 255, 255],
  heather: [155, 173, 183],
  topaz: [132, 126, 135],
  dimGray: [105, 106, 106],
  smokeyAsh: [89, 86, 82],
  clairvoyant: [118, 66, 138],
  brown: [172, 50, 50],
  mandy: [217, 87, 99],
  plum: [215, 123, 186],
  rainForest: [143, 151, 74],
  stinger: [138, 111, 48],
};

/** Soil ramps per depth band: desaturated descent ochre→rust→umber→maroon→violet→charcoal.
 * accent = rare bright fleck; edge = tile bottom/right darkening. */
export const SOIL_RAMPS = [
  { light: P.pancho, base: P.twine, shadow: P.rope, edge: P.oiledCedar, accent: P.pancho },
  { light: P.twine, base: P.rope, shadow: P.oiledCedar, edge: P.loulou, accent: P.twine },
  { light: P.rope, base: P.oiledCedar, shadow: P.loulou, edge: P.valhalla, accent: P.stinger },
  { light: P.brown, base: P.loulou, shadow: P.valhalla, edge: P.black, accent: P.brown },
  {
    light: P.clairvoyant,
    base: P.loulou,
    shadow: P.valhalla,
    edge: P.black,
    accent: P.clairvoyant,
  },
  { light: P.smokeyAsh, base: P.opal, shadow: P.valhalla, edge: P.black, accent: P.heather },
];

/** Gem/artifact ramps by collectible index 0-13 (light/base/shadow/outline). */
export const GEM_RAMPS = [
  { light: P.topaz, base: P.smokeyAsh, shadow: P.valhalla, outline: P.black }, // ferrite (iron nugget)
  { light: P.tahitiGold, base: P.stinger, shadow: P.oiledCedar, outline: P.black }, // bronzite
  { light: P.white, base: P.lightSteel, shadow: P.heather, outline: P.valhalla }, // argentite
  { light: P.goldenFizz, base: P.tahitiGold, shadow: P.stinger, outline: P.oiledCedar }, // aurite
  { light: P.lightSteel, base: P.heather, shadow: P.topaz, outline: P.valhalla }, // platinite
  { light: P.white, base: P.viking, shadow: P.venicBlue, outline: P.deepKoamaru }, // einsteinium
  { light: P.atlantis, base: P.christi, shadow: P.elfGreen, outline: P.dell }, // emerald
  { light: P.mandy, base: P.brown, shadow: P.loulou, outline: P.black }, // ruby
  { light: P.white, base: P.lightSteel, shadow: P.viking, outline: P.deepKoamaru }, // diamond
  { light: P.plum, base: P.clairvoyant, shadow: P.loulou, outline: P.black }, // amazonite
  { light: P.pancho, base: P.twine, shadow: P.rope, outline: P.oiledCedar }, // fossil
  { light: P.twine, base: P.stinger, shadow: P.oiledCedar, outline: P.black }, // cache
  { light: P.lightSteel, base: P.heather, shadow: P.topaz, outline: P.valhalla }, // xeno
  { light: P.goldenFizz, base: P.tahitiGold, shadow: P.stinger, outline: P.oiledCedar }, // idol
];

/** Hero sprite ramps. */
export const POD_RAMP = {
  light: P.pancho,
  base: P.tahitiGold,
  shadow: P.oiledCedar,
  outline: P.black,
};
export const POD_STEEL = {
  light: P.heather,
  base: P.smokeyAsh,
  shadow: P.valhalla,
  outline: P.black,
};
export const CANOPY = {
  light: P.lightSteel,
  base: P.viking,
  shadow: P.venicBlue,
  outline: P.black,
};

export const ROCK_RAMP = {
  light: P.heather,
  base: P.smokeyAsh,
  shadow: P.opal,
  outline: P.valhalla,
};
export const LAVA = {
  crustL: P.loulou,
  crust: P.valhalla,
  ember: P.brown,
  hot: P.tahitiGold,
  core: P.goldenFizz,
};
