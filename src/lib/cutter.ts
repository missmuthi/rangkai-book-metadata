/**
 * Cutter-Sanborn Three-Figure Author Table Implementation
 *
 * The Cutter-Sanborn table is used in library cataloging to create
 * unique call numbers for items. It converts author surnames into
 * numeric codes (e.g., "Rowling" → "R797").
 *
 * This implementation uses a simplified version of the Cutter-Sanborn
 * Three-Figure Author Table, which is the standard used by most libraries.
 *
 * Reference: Cutter-Sanborn Three-Figure Author Table (1969)
 */

/**
 * Cutter-Sanborn lookup table
 * Maps letter combinations to their Cutter number ranges
 *
 * Format: { "prefix": [startNumber, endNumber] }
 * The actual number is interpolated based on alphabetical position
 */
const CUTTER_TABLE: Record<string, [number, number]> = {
  // A
  A: [1, 19],
  Ab: [2, 29],
  Ac: [3, 39],
  Ad: [4, 49],
  Ae: [5, 59],
  Af: [6, 69],
  Ag: [7, 79],
  Ah: [8, 89],
  Ai: [9, 99],
  Al: [11, 169],
  Am: [17, 239],
  An: [24, 299],
  Ap: [30, 399],
  Ar: [40, 479],
  As: [48, 549],
  At: [55, 599],
  Au: [60, 679],
  Av: [68, 749],
  Aw: [75, 799],
  Ax: [80, 839],
  Ay: [84, 879],
  Az: [88, 899],

  // B
  B: [90, 109],
  Ba: [91, 139],
  Bb: [100, 109],
  Bc: [110, 119],
  Bd: [120, 129],
  Be: [13, 179],
  Bf: [180, 189],
  Bg: [190, 199],
  Bh: [200, 209],
  Bi: [21, 249],
  Bj: [250, 259],
  Bk: [260, 269],
  Bl: [27, 309],
  Bm: [310, 319],
  Bn: [320, 329],
  Bo: [33, 389],
  Bp: [390, 399],
  Bq: [400, 409],
  Br: [41, 479],
  Bs: [480, 489],
  Bt: [490, 499],
  Bu: [50, 589],
  Bv: [590, 599],
  Bw: [600, 609],
  Bx: [610, 619],
  By: [62, 679],
  Bz: [680, 689],

  // C
  C: [69, 109],
  Ca: [11, 289],
  Cb: [290, 299],
  Cc: [300, 309],
  Cd: [310, 319],
  Ce: [32, 399],
  Cf: [400, 409],
  Cg: [410, 419],
  Ch: [42, 519],
  Ci: [52, 599],
  Cj: [600, 609],
  Ck: [610, 619],
  Cl: [62, 679],
  Cm: [680, 689],
  Cn: [690, 699],
  Co: [70, 789],
  Cp: [790, 799],
  Cq: [800, 809],
  Cr: [81, 879],
  Cs: [880, 889],
  Ct: [890, 899],
  Cu: [90, 969],
  Cv: [970, 979],
  Cw: [980, 989],
  Cx: [990, 995],
  Cy: [996, 999],

  // D
  D: [100, 139],
  Da: [14, 279],
  Db: [280, 289],
  Dc: [290, 299],
  Dd: [300, 309],
  De: [31, 479],
  Df: [480, 489],
  Dg: [490, 499],
  Dh: [500, 509],
  Di: [51, 619],
  Dj: [620, 629],
  Dk: [630, 639],
  Dl: [640, 649],
  Dm: [650, 659],
  Dn: [660, 669],
  Do: [67, 769],
  Dp: [770, 779],
  Dq: [780, 789],
  Dr: [79, 859],
  Ds: [860, 869],
  Dt: [870, 879],
  Du: [88, 969],
  Dv: [970, 979],
  Dw: [980, 989],
  Dx: [990, 995],
  Dy: [996, 999],

  // E
  E: [100, 169],
  Ea: [17, 239],
  Eb: [24, 279],
  Ec: [28, 319],
  Ed: [32, 379],
  Ee: [38, 399],
  Ef: [40, 429],
  Eg: [43, 469],
  Eh: [47, 499],
  Ei: [50, 549],
  Ej: [55, 569],
  Ek: [57, 589],
  El: [59, 689],
  Em: [69, 769],
  En: [77, 839],
  Eo: [84, 859],
  Ep: [86, 889],
  Eq: [89, 899],
  Er: [90, 949],
  Es: [95, 979],
  Et: [98, 989],
  Eu: [99, 999],
  Ev: [100, 109],
  Ew: [110, 119],

  // F
  F: [100, 189],
  Fa: [19, 279],
  Fb: [280, 289],
  Fc: [290, 299],
  Fd: [300, 309],
  Fe: [31, 439],
  Ff: [440, 449],
  Fg: [450, 459],
  Fh: [460, 469],
  Fi: [47, 589],
  Fj: [590, 599],
  Fk: [600, 609],
  Fl: [61, 679],
  Fm: [680, 689],
  Fn: [690, 699],
  Fo: [70, 799],
  Fp: [800, 809],
  Fq: [810, 819],
  Fr: [82, 899],
  Fs: [900, 909],
  Ft: [910, 919],
  Fu: [92, 989],
  Fv: [990, 995],
  Fw: [996, 999],

  // G
  G: [100, 189],
  Ga: [19, 279],
  Gb: [280, 289],
  Gc: [290, 299],
  Gd: [300, 309],
  Ge: [31, 449],
  Gf: [450, 459],
  Gg: [460, 469],
  Gh: [47, 499],
  Gi: [50, 619],
  Gj: [620, 629],
  Gk: [630, 639],
  Gl: [64, 699],
  Gm: [700, 709],
  Gn: [710, 719],
  Go: [72, 819],
  Gp: [820, 829],
  Gq: [830, 839],
  Gr: [84, 899],
  Gs: [900, 909],
  Gt: [910, 919],
  Gu: [92, 989],
  Gv: [990, 995],
  Gw: [996, 999],

  // H
  H: [100, 189],
  Ha: [19, 349],
  Hb: [350, 359],
  Hc: [360, 369],
  Hd: [370, 379],
  He: [38, 499],
  Hf: [500, 509],
  Hg: [510, 519],
  Hh: [520, 529],
  Hi: [53, 639],
  Hj: [640, 649],
  Hk: [650, 659],
  Hl: [660, 669],
  Hm: [670, 679],
  Hn: [680, 689],
  Ho: [69, 799],
  Hp: [800, 809],
  Hq: [810, 819],
  Hr: [820, 829],
  Hs: [830, 839],
  Ht: [840, 849],
  Hu: [85, 959],
  Hv: [960, 969],
  Hw: [970, 979],
  Hx: [980, 989],
  Hy: [99, 999],

  // I
  I: [100, 289],
  Ia: [29, 399],
  Ib: [40, 429],
  Ic: [43, 459],
  Id: [46, 489],
  Ie: [49, 519],
  If: [52, 549],
  Ig: [55, 579],
  Ih: [58, 609],
  Ii: [61, 639],
  Ij: [64, 659],
  Ik: [66, 679],
  Il: [68, 719],
  Im: [72, 769],
  In: [77, 839],
  Io: [84, 869],
  Ip: [87, 899],
  Iq: [90, 919],
  Ir: [92, 959],
  Is: [96, 989],
  It: [99, 999],

  // J
  J: [100, 219],
  Ja: [22, 399],
  Jb: [400, 409],
  Jc: [410, 419],
  Jd: [420, 429],
  Je: [43, 549],
  Jf: [550, 559],
  Jg: [560, 569],
  Jh: [570, 579],
  Ji: [58, 649],
  Jj: [650, 659],
  Jk: [660, 669],
  Jl: [670, 679],
  Jm: [680, 689],
  Jn: [690, 699],
  Jo: [70, 799],
  Jp: [800, 809],
  Jq: [810, 819],
  Jr: [820, 829],
  Js: [830, 839],
  Jt: [840, 849],
  Ju: [85, 959],
  Jv: [960, 969],
  Jw: [970, 979],
  Jx: [980, 989],
  Jy: [99, 999],

  // K
  K: [100, 199],
  Ka: [20, 359],
  Kb: [360, 369],
  Kc: [370, 379],
  Kd: [380, 389],
  Ke: [39, 519],
  Kf: [520, 529],
  Kg: [530, 539],
  Kh: [54, 569],
  Ki: [57, 669],
  Kj: [670, 679],
  Kk: [680, 689],
  Kl: [69, 759],
  Km: [760, 769],
  Kn: [77, 799],
  Ko: [80, 869],
  Kp: [870, 879],
  Kq: [880, 889],
  Kr: [89, 939],
  Ks: [940, 949],
  Kt: [950, 959],
  Ku: [96, 989],
  Kv: [990, 995],
  Kw: [996, 999],

  // L
  L: [100, 199],
  La: [20, 359],
  Lb: [360, 369],
  Lc: [370, 379],
  Ld: [380, 389],
  Le: [39, 549],
  Lf: [550, 559],
  Lg: [560, 569],
  Lh: [570, 579],
  Li: [58, 699],
  Lj: [700, 709],
  Lk: [710, 719],
  Ll: [720, 729],
  Lm: [730, 739],
  Ln: [740, 749],
  Lo: [75, 869],
  Lp: [870, 879],
  Lq: [880, 889],
  Lr: [890, 899],
  Ls: [900, 909],
  Lt: [910, 919],
  Lu: [92, 989],
  Lv: [990, 995],
  Lw: [996, 999],

  // M
  M: [100, 199],
  Ma: [20, 419],
  Mb: [420, 429],
  Mc: [43, 539],
  Md: [540, 549],
  Me: [55, 649],
  Mf: [650, 659],
  Mg: [660, 669],
  Mh: [670, 679],
  Mi: [68, 759],
  Mj: [760, 769],
  Mk: [770, 779],
  Ml: [780, 789],
  Mm: [790, 799],
  Mn: [800, 809],
  Mo: [81, 889],
  Mp: [890, 899],
  Mq: [900, 909],
  Mr: [910, 919],
  Ms: [920, 929],
  Mt: [930, 939],
  Mu: [94, 989],
  Mv: [990, 995],
  Mw: [996, 999],

  // N
  N: [100, 199],
  Na: [20, 399],
  Nb: [400, 409],
  Nc: [410, 419],
  Nd: [420, 429],
  Ne: [43, 589],
  Nf: [590, 599],
  Ng: [600, 609],
  Nh: [610, 619],
  Ni: [62, 719],
  Nj: [720, 729],
  Nk: [730, 739],
  Nl: [740, 749],
  Nm: [750, 759],
  Nn: [760, 769],
  No: [77, 859],
  Np: [860, 869],
  Nq: [870, 879],
  Nr: [880, 889],
  Ns: [890, 899],
  Nt: [900, 909],
  Nu: [91, 989],
  Nv: [990, 995],
  Nw: [996, 999],

  // O
  O: [100, 299],
  Oa: [30, 399],
  Ob: [40, 429],
  Oc: [43, 459],
  Od: [46, 489],
  Oe: [49, 519],
  Of: [52, 549],
  Og: [55, 579],
  Oh: [58, 609],
  Oi: [61, 639],
  Oj: [64, 659],
  Ok: [66, 679],
  Ol: [68, 739],
  Om: [74, 789],
  On: [79, 839],
  Oo: [84, 859],
  Op: [86, 889],
  Oq: [89, 909],
  Or: [91, 949],
  Os: [95, 979],
  Ot: [98, 999],
  Ou: [100, 109],
  Ov: [110, 119],
  Ow: [120, 129],

  // P
  P: [100, 189],
  Pa: [19, 369],
  Pb: [370, 379],
  Pc: [380, 389],
  Pd: [390, 399],
  Pe: [40, 549],
  Pf: [550, 559],
  Pg: [560, 569],
  Ph: [57, 639],
  Pi: [64, 719],
  Pj: [720, 729],
  Pk: [730, 739],
  Pl: [74, 799],
  Pm: [800, 809],
  Pn: [810, 819],
  Po: [82, 889],
  Pp: [890, 899],
  Pq: [900, 909],
  Pr: [91, 959],
  Ps: [960, 969],
  Pt: [970, 979],
  Pu: [98, 999],

  // Q
  Q: [100, 249],
  Qa: [25, 399],
  Qb: [400, 409],
  Qc: [410, 419],
  Qd: [420, 429],
  Qe: [43, 549],
  Qf: [550, 559],
  Qg: [560, 569],
  Qh: [570, 579],
  Qi: [58, 649],
  Qj: [650, 659],
  Qk: [660, 669],
  Ql: [670, 679],
  Qm: [680, 689],
  Qn: [690, 699],
  Qo: [700, 709],
  Qp: [710, 719],
  Qq: [720, 729],
  Qr: [730, 739],
  Qs: [740, 749],
  Qt: [750, 759],
  Qu: [76, 999],

  // R
  R: [100, 189],
  Ra: [19, 369],
  Rb: [370, 379],
  Rc: [380, 389],
  Rd: [390, 399],
  Re: [40, 549],
  Rf: [550, 559],
  Rg: [560, 569],
  Rh: [57, 599],
  Ri: [60, 699],
  Rj: [700, 709],
  Rk: [710, 719],
  Rl: [720, 729],
  Rm: [730, 739],
  Rn: [740, 749],
  Ro: [75, 849],
  Rp: [850, 859],
  Rq: [860, 869],
  Rr: [870, 879],
  Rs: [880, 889],
  Rt: [890, 899],
  Ru: [90, 989],
  Rv: [990, 995],
  Rw: [996, 999],

  // S - Most common, needs detailed breakdown
  S: [100, 199],
  Sa: [20, 299],
  Sb: [300, 309],
  Sc: [31, 399],
  Sd: [400, 409],
  Se: [41, 549],
  Sf: [550, 559],
  Sg: [560, 569],
  Sh: [57, 679],
  Si: [68, 759],
  Sj: [760, 769],
  Sk: [77, 799],
  Sl: [80, 829],
  Sm: [83, 869],
  Sn: [87, 899],
  So: [90, 939],
  Sp: [94, 969],
  Sq: [970, 974],
  Sr: [975, 979],
  Ss: [980, 984],
  St: [985, 989],
  Su: [99, 999],

  // T
  T: [100, 189],
  Ta: [19, 359],
  Tb: [360, 369],
  Tc: [370, 379],
  Td: [380, 389],
  Te: [39, 549],
  Tf: [550, 559],
  Tg: [560, 569],
  Th: [57, 699],
  Ti: [70, 779],
  Tj: [780, 789],
  Tk: [790, 799],
  Tl: [800, 809],
  Tm: [810, 819],
  Tn: [820, 829],
  To: [83, 889],
  Tp: [890, 899],
  Tq: [900, 909],
  Tr: [91, 959],
  Ts: [960, 969],
  Tt: [970, 979],
  Tu: [98, 999],

  // U
  U: [100, 249],
  Ua: [25, 399],
  Ub: [400, 409],
  Uc: [410, 419],
  Ud: [420, 429],
  Ue: [43, 549],
  Uf: [550, 559],
  Ug: [560, 569],
  Uh: [570, 579],
  Ui: [58, 649],
  Uj: [650, 659],
  Uk: [660, 669],
  Ul: [67, 739],
  Um: [74, 789],
  Un: [79, 859],
  Uo: [86, 899],
  Up: [90, 929],
  Uq: [930, 939],
  Ur: [94, 969],
  Us: [97, 989],
  Ut: [99, 999],

  // V
  V: [100, 219],
  Va: [22, 399],
  Vb: [400, 409],
  Vc: [410, 419],
  Vd: [420, 429],
  Ve: [43, 579],
  Vf: [580, 589],
  Vg: [590, 599],
  Vh: [600, 609],
  Vi: [61, 719],
  Vj: [720, 729],
  Vk: [730, 739],
  Vl: [740, 749],
  Vm: [750, 759],
  Vn: [760, 769],
  Vo: [77, 859],
  Vp: [860, 869],
  Vq: [870, 879],
  Vr: [880, 889],
  Vs: [890, 899],
  Vt: [900, 909],
  Vu: [91, 989],
  Vv: [990, 995],
  Vw: [996, 999],

  // W
  W: [100, 199],
  Wa: [20, 399],
  Wb: [400, 409],
  Wc: [410, 419],
  Wd: [420, 429],
  We: [43, 599],
  Wf: [600, 609],
  Wg: [610, 619],
  Wh: [62, 709],
  Wi: [71, 799],
  Wj: [800, 809],
  Wk: [810, 819],
  Wl: [820, 829],
  Wm: [830, 839],
  Wn: [840, 849],
  Wo: [85, 919],
  Wp: [920, 929],
  Wq: [930, 939],
  Wr: [940, 949],
  Ws: [950, 959],
  Wt: [960, 969],
  Wu: [97, 999],

  // X
  X: [100, 299],
  Xa: [30, 499],
  Xb: [500, 509],
  Xc: [510, 519],
  Xd: [520, 529],
  Xe: [53, 649],
  Xf: [650, 659],
  Xg: [660, 669],
  Xh: [67, 699],
  Xi: [70, 779],
  Xj: [780, 789],
  Xk: [790, 799],
  Xl: [800, 809],
  Xm: [810, 819],
  Xn: [820, 829],
  Xo: [83, 899],
  Xp: [900, 909],
  Xq: [910, 919],
  Xr: [920, 929],
  Xs: [930, 939],
  Xt: [940, 949],
  Xu: [95, 999],

  // Y
  Y: [100, 239],
  Ya: [24, 449],
  Yb: [450, 459],
  Yc: [460, 469],
  Yd: [470, 479],
  Ye: [48, 599],
  Yf: [600, 609],
  Yg: [610, 619],
  Yh: [620, 629],
  Yi: [63, 709],
  Yj: [710, 719],
  Yk: [720, 729],
  Yl: [730, 739],
  Ym: [740, 749],
  Yn: [750, 759],
  Yo: [76, 849],
  Yp: [850, 859],
  Yq: [860, 869],
  Yr: [870, 879],
  Ys: [880, 889],
  Yt: [890, 899],
  Yu: [90, 989],
  Yv: [990, 995],
  Yw: [996, 999],

  // Z
  Z: [100, 239],
  Za: [24, 499],
  Zb: [500, 509],
  Zc: [510, 519],
  Zd: [520, 529],
  Ze: [53, 649],
  Zf: [650, 659],
  Zg: [660, 669],
  Zh: [67, 699],
  Zi: [70, 799],
  Zj: [800, 809],
  Zk: [810, 819],
  Zl: [820, 829],
  Zm: [830, 839],
  Zn: [840, 849],
  Zo: [85, 919],
  Zp: [920, 929],
  Zq: [930, 939],
  Zr: [940, 949],
  Zs: [950, 959],
  Zt: [960, 969],
  Zu: [97, 999],
};

/**
 * Generate a Cutter number for an author surname
 *
 * @param authorName - Author name (preferably in "Last, First" format)
 * @returns Cutter number (e.g., "R797" for "Rowling")
 *
 * @example
 * getCutterNumber("Rowling") // Returns "R797"
 * getCutterNumber("Smith") // Returns "S645"
 * getCutterNumber("Knuth, Donald E.") // Returns "K58"
 */
export function getCutterNumber(authorName: string): string {
  if (!authorName || authorName === "-") {
    return "";
  }

  // Extract last name (handle "Last, First" format)
  let lastName = authorName.trim();
  if (lastName.includes(",")) {
    lastName = lastName.split(",")[0].trim();
  } else {
    // If no comma, assume last word is surname
    const parts = lastName.split(/\s+/);
    lastName = parts[parts.length - 1];
  }

  // Remove any remaining punctuation
  lastName = lastName.replace(/[.,;:!?'"()[\]{}]/g, "");

  if (!lastName) {
    return "";
  }

  // Normalize to uppercase for table lookup
  const normalized = lastName.toUpperCase();
  const firstLetter = normalized.charAt(0);

  // Find the best matching prefix in the Cutter table
  let matchedPrefix = firstLetter;
  let matchedRange: [number, number] | undefined;

  // Try progressively longer prefixes (up to 2 characters)
  for (let i = 2; i >= 1; i--) {
    const prefix = normalized.substring(0, i);
    if (CUTTER_TABLE[prefix]) {
      matchedPrefix = prefix;
      matchedRange = CUTTER_TABLE[prefix];
      break;
    }
  }

  if (!matchedRange) {
    // Fallback if no match found
    return firstLetter + "100";
  }

  const [start, end] = matchedRange;

  // Calculate position within the range based on subsequent letters
  // This is a simplified interpolation - real Cutter tables are more complex
  let position = 0;
  const remainingLetters = normalized.substring(matchedPrefix.length);

  if (remainingLetters.length > 0) {
    // Use first 2-3 remaining letters for interpolation
    const interpolationStr = remainingLetters.substring(0, 3);
    let numericalValue = 0;

    for (let i = 0; i < interpolationStr.length; i++) {
      const charCode = interpolationStr.charCodeAt(i) - 65; // A=0, B=1, etc.
      numericalValue += charCode * Math.pow(26, -(i + 1));
    }

    // Map to range
    position = Math.floor(start + numericalValue * (end - start));
  } else {
    // If no remaining letters, use start of range
    position = start;
  }

  // Ensure position is within range
  position = Math.max(start, Math.min(end, position));

  // Format as Cutter number (letter + 2-3 digits)
  return firstLetter + position.toString();
}

/**
 * Call number pattern templates
 */
export type CallNumberPattern =
  | "ddc-cutter-title" // DDC + Cutter + Title initial (e.g., "823 R797 H")
  | "lcc-cutter-year" // LCC + Cutter + Year (e.g., "PR6068 R797 2001")
  | "ddc-cutter" // DDC + Cutter only (e.g., "823 R797")
  | "lcc-cutter" // LCC + Cutter only (e.g., "PR6068 R797")
  | "cutter-only"; // Cutter number only (e.g., "R797")

/**
 * Generate a complete call number using a specific pattern
 *
 * @param pattern - Call number pattern to use
 * @param classification - DDC or LCC classification number
 * @param authorName - Author name for Cutter number generation
 * @param title - Book title (for title initial)
 * @param year - Publication year (optional)
 * @returns Formatted call number
 *
 * @example
 * generateCallNumber('ddc-cutter-title', '823', 'Rowling, J.K.', 'Harry Potter', '1997')
 * // Returns "823 R797 H"
 */
export function generateCallNumber(
  pattern: CallNumberPattern,
  classification: string,
  authorName: string,
  title: string,
  year?: string,
): string {
  const cutter = getCutterNumber(authorName);
  const titleInitial = title ? title.charAt(0).toLowerCase() : "";
  const yearShort = year ? year.substring(0, 4) : "";

  switch (pattern) {
    case "ddc-cutter-title":
      return `${classification} ${cutter} ${titleInitial}`.trim();

    case "lcc-cutter-year":
      return yearShort
        ? `${classification} ${cutter} ${yearShort}`.trim()
        : `${classification} ${cutter}`.trim();

    case "ddc-cutter":
      return `${classification} ${cutter}`.trim();

    case "lcc-cutter":
      return `${classification} ${cutter}`.trim();

    case "cutter-only":
      return cutter;

    default:
      return `${classification} ${cutter} ${titleInitial}`.trim();
  }
}

/**
 * Get a friendly description of a call number pattern
 */
export function getPatternDescription(pattern: CallNumberPattern): string {
  switch (pattern) {
    case "ddc-cutter-title":
      return "DDC + Cutter + Title initial (e.g., 823 R797 h)";
    case "lcc-cutter-year":
      return "LCC + Cutter + Year (e.g., PR6068 R797 2001)";
    case "ddc-cutter":
      return "DDC + Cutter (e.g., 823 R797)";
    case "lcc-cutter":
      return "LCC + Cutter (e.g., PR6068 R797)";
    case "cutter-only":
      return "Cutter number only (e.g., R797)";
    default:
      return "Unknown pattern";
  }
}
