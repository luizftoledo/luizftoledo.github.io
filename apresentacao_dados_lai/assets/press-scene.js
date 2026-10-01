/* Coletiva de imprensa em pixel art (slide "A LAI como coletiva permanente").
   Jornalistas levantam a mão e perguntam; a autoridade responde do púlpito.
   Canvas 300×64 ampliado com image-rendering: pixelated; ~12 fps; pausa fora da tela. */
(function () {
  'use strict';
  var cv = document.getElementById('press-scene');
  if (!cv) return;
  var W = 300, H = 64;
  cv.width = W; cv.height = H;
  var g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function R(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); }
  function px(x, y, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); }
  /* ---------- tiny 3×5 pixel font ---------- */
  var F = {
    'A': '010101111101101', 'B': '110101110101110', 'C': '011100100100011', 'D': '110101101101110', 'E': '111100110100111',
    'F': '111100110100100', 'G': '011100101101011', 'H': '101101111101101', 'I': '111010010010111', 'J': '001001001101010',
    'L': '100100100100111', 'M': '101111111101101', 'N': '110101101101101', 'O': '010101101101010', 'P': '110101110100100',
    'Q': '010101101111011', 'R': '110101110101101', 'S': '011100010001110', 'T': '111010010010010', 'U': '101101101101111',
    'V': '101101101101010', 'X': '101101010101101', 'Z': '111001010100111', 'K': '101101110101101', 'Y': '101101010010010',
    '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110', '4': '101101111001001',
    '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001110',
    '-': '000000111000000', ':': '000010000010000', '.': '000000000000010', ' ': '000000000000000', '/': '001001010100100', '?': '111001010000010'
  };
  function text(s, x, y, col) {
    g.fillStyle = col;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i], tilde = false;
      if (ch === 'Ã') { ch = 'A'; tilde = true; }
      var b = F[ch] || F[' '];
      for (var k = 0; k < 15; k++) if (b[k] === '1') g.fillRect(x + (k % 3), y + ((k / 3) | 0), 1, 1);
      if (tilde) { g.fillRect(x, y - 2, 1, 1); g.fillRect(x + 1, y - 3, 1, 1); g.fillRect(x + 2, y - 2, 1, 1); }
      x += 4;
    }
  }
  function textW(s) { return s.length * 4 - 1; }  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
    function c(v) { v = f < 1 ? v * f : v + (255 - v) * (f - 1); return Math.max(0, Math.min(255, Math.round(v))); }
    return '#' + ((1 << 24) | (c(r) << 16) | (c(gg) << 8) | c(b)).toString(16).slice(1);
  }

  /* ================= SPRITES =================
     Each person is drawn pixel by pixel on a 20×32 grid (facing right), auto-outlined,
     cached once per pose/frame and flipped for facing left. Feet bottom = row 30. */
  var OUT = '#241c2e', SW = 20, SH = 32, CX = 10, BASE = 30, cache = {};
  function sprite(sp, pose, fr, item, flip) {
    var key = sp.id + pose + fr + (item || '') + (flip ? 'f' : '');
    if (cache[key]) return cache[key];
    var grid = new Array(SW * SH);
    function P(x, y, c) { x += 1; y += 1; if (x >= 0 && x < SW && y >= 0 && y < SH) grid[y * SW + x] = c; }
    function Rr(x, y, w, h, c) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) P(x + i, y + j, c); }
    var skin = sp.skin, skinD = shade(skin, .82), skinL = shade(skin, 1.12), blush = shade('#e8806f', 1.15);
    var hair = sp.hair, hairD = shade(hair, .68), hairL = shade(hair, 1.45);
    var top = sp.top, topD = shade(top, .76), topL = shade(top, 1.18);
    var sl = sp.jacket || top, slD = shade(sl, .7), slL = shade(sl, 1.15);
    var pants = sp.pants, pantsD = shade(pants, .7), shoe = sp.shoe || '#3b2a24', shoeL = shade(shoe, 1.6);
    var sit = pose === 'sit', walk = pose === 'walk';
    var LF = 0, LB = 0, liftF = 0, liftB = 0;
    if (walk) { var w4 = [[2, -2, 0, 0], [0, 0, 0, 1], [-2, 2, 0, 0], [0, 0, 1, 0]][fr]; LF = w4[0]; LB = w4[1]; liftF = w4[2]; liftB = w4[3]; }

    /* chair */
    if (sit) {
      var ch = sp.chair || '#3d4a5c', chD = shade(ch, .72);
      Rr(1, 10, 2, 12, ch); Rr(1, 10, 1, 12, chD); P(2, 10, shade(ch, 1.3));
      Rr(2, 21, 9, 2, ch); Rr(2, 22, 9, 1, chD);
      Rr(6, 23, 2, 5, '#7a838c'); Rr(6, 23, 1, 5, '#5b636b');
      Rr(3, 28, 8, 1, '#5b636b'); P(3, 29, '#2b2b2b'); P(10, 29, '#2b2b2b');
    }
    /* legs */
    function leg(x0, off, c, cD, lift) {
      var legC = sp.skirt ? (sp.legs || skinD) : c, legD = sp.skirt ? shade(legC, .85) : cD;
      for (var r = 21; r <= 27 - lift; r++) { var x = x0 + Math.round(off * (r - 21) / 6); P(x, r, legC); P(x + 1, r, legD); }
      var fx = x0 + off, sy = 28 - lift;
      Rr(fx, sy, 3, 1, shoe); P(fx + 2, sy, shoeL); Rr(fx, sy + 1, 3, 1, shade(shoe, .7)); P(fx + 3, sy + 1, shade(shoe, .7));
    }
    if (sit) {
      Rr(6, 21, 8, 2, pants); Rr(6, 22, 8, 1, pantsD); P(13, 21, shade(pants, 1.15));
      Rr(12, 23, 2, 5, sp.skirt ? (sp.legs || skinD) : pants); P(13, 23, pantsD); P(13, 24, pantsD); P(13, 25, pantsD);
      Rr(12, 28, 3, 1, shoe); P(14, 28, shoeL); Rr(12, 29, 4, 1, shade(shoe, .7));
      if (sp.skirt) { Rr(5, 20, 8, 2, sp.skirt); Rr(5, 22, 9, 1, shade(sp.skirt, .75)); }
    } else {
      leg(6, LB, pantsD, shade(pantsD, .85), liftB);
      leg(9, LF, pants, pantsD, liftF);
      if (sp.skirt) {
        var sk = sp.skirt, skD = shade(sk, .72);
        Rr(6, 20, 6, 2, sk); Rr(5, 22, 8, 2, sk); Rr(5, 24, 8, 1, skD); P(5, 22, skD); P(5, 23, skD); P(9, 22, skD);
      } else { Rr(6, 21, 6, 1, pants); P(6, 21, pantsD); }
    }
    /* back arm (behind torso) */
    function swingArm(x0, sw, c1, c2, hand) {
      var x = x0;
      for (var r = 12; r <= 18; r++) {
        x = x0 + Math.round(sw * (r - 12) / 6);
        var rolled = sp.rolled && r >= 16;
        P(x, r, rolled ? skin : c1); P(x + 1, r, rolled ? skinD : c2);
      }
      P(x, 19, hand); P(x + 1, 19, hand); P(x + (sw >= 0 ? 1 : 0), 20, shade(hand, .85));
    }
    if (!sit && !item) swingArm(7, -LB, shade(sl, .6), shade(sl, .55), skinD);
    /* torso */
    Rr(5, 12, 7, 9, top); P(5, 12, undefined); P(11, 12, undefined);
    for (var r = 12; r <= 20; r++) { P(5, r, topD); P(11, r, r < 17 ? topL : top); }
    if (sp.plaid) for (r = 13; r <= 19; r++) for (var x = 6; x <= 10; x++) if ((x + r) % 3 === 0 || r % 3 === 0) P(x, r, topD);
    if (sp.jacket) {
      var jk = sp.jacket, jkD = shade(jk, .72);
      Rr(5, 12, 3, 9, jk); Rr(10, 12, 2, 9, jk); P(5, 12, undefined); P(11, 12, undefined);
      for (r = 12; r <= 20; r++) P(5, r, jkD);
      Rr(8, 16, 2, 5, jk); P(8, 13, jkD); P(10, 13, jkD); P(9, 17, '#e8c55a'); P(9, 19, '#e8c55a');
    }
    if (sp.tie) { P(8, 12, '#ffffff'); P(10, 12, '#ffffff'); P(9, 12, shade(sp.tie, .8)); for (r = 13; r <= 16; r++) P(9, r, sp.tie); P(9, 15, shade(sp.tie, 1.3)); }
    else if (sp.collar) { P(8, 12, '#ffffff'); P(10, 12, '#ffffff'); P(9, 12, skinD); P(9, 14, topD); P(9, 17, topD); }
    else { P(8, 12, skinD); P(9, 12, skinD); P(10, 12, skinD); }
    if (!sp.skirt) { Rr(5, 20, 7, 1, '#3b2b25'); P(10, 20, '#e8c55a'); }
    if (sp.badge) {
      var lc = sp.badge;
      P(8, 13, lc); P(10, 13, lc); P(8, 14, lc); P(10, 14, lc); P(9, 15, lc);
      Rr(8, 16, 3, 3, '#f4f4ee'); Rr(8, 16, 3, 1, lc); P(8, 17, skinD); P(10, 17, '#9aa3ab'); P(10, 18, '#9aa3ab');
    }
    /* item held */
    if (item === 'doc') { Rr(11, 9, 5, 7, '#fbfaf3'); P(15, 9, '#d9d3c1'); for (x = 12; x <= 14; x++) { P(x, 11, '#b9b19b'); P(x, 13, '#b9b19b'); } P(12, 12, '#b9b19b'); P(14, 14, '#d64541'); }
    if (item === 'env') { Rr(11, 11, 7, 5, '#fbfaf3'); P(12, 12, '#cfc8b3'); P(13, 13, '#cfc8b3'); P(16, 12, '#cfc8b3'); P(15, 13, '#cfc8b3'); Rr(14, 13, 2, 2, '#1f8a4c'); P(14, 13, '#36b36a'); }
    if (item === 'box') { Rr(11, 9, 7, 7, '#c69356'); Rr(11, 9, 7, 1, '#e0b47a'); Rr(11, 15, 7, 1, '#9c6f3a'); Rr(13, 11, 3, 2, '#f4f0e4'); P(17, 10, '#9c6f3a'); }
    /* front arm */
    if (item === 'raise') {
      for (var rr = 12; rr >= 1; rr--) { var ax = 9 + Math.round((12 - rr) * 3 / 11); P(ax, rr, slL); P(ax + 1, rr, sl); }
      if (sp.rolled) { P(11, 3, skin); P(12, 3, skinD); P(11, 2, skin); P(12, 2, skinD); }
      Rr(12, -1, 2, 2, skin); P(11, -1, skin); P(13, 0, skinD); Rr(8, 15, 2, 2, slL);
    } else if (item === 'note') {
      var nu = fr ? 1 : 0;
      Rr(8, 12, 2, 4, slL); Rr(9, 15, 3, 2, sp.rolled ? skin : sl);
      Rr(12, 12, 4, 5, '#fbfaf3'); Rr(12, 12, 4, 1, '#c0392b'); P(13, 14, '#9aa0a6'); P(14, 15, '#9aa0a6');
      Rr(12, 15 - nu, 2, 2, skin); P(14, 13 - nu, '#2f5d9b'); P(15, 12 - nu, '#2f5d9b');
    } else if (item === 'mic') {
      Rr(8, 12, 2, 3, slL); Rr(9, 14, 4, 2, sl); P(9, 15, slD);
      Rr(13, 13, 2, 2, skin); Rr(15, 13, 2, 1, '#2b2f36'); Rr(17, 12, 2, 3, '#6b737b'); P(17, 12, '#9aa3ab'); Rr(14, 15, 2, 2, sp.mic || '#d64541');
    } else if (item === 'cam' || item === 'photo') {
      for (var ra = 12; ra >= 8; ra--) { P(9 + ((12 - ra) >> 1), ra, slL); P(10 + ((12 - ra) >> 1), ra, sl); }
      Rr(11, 7, 2, 2, skin);
    } else if (item === 'talk') {
      var hu = fr ? 2 : 0;
      Rr(8, 12, 2, 3, slL); P(10, 14, sl); P(11, 13 - hu, sl); P(10, 13, slL); P(11, 12 - hu, slL); P(12, 12 - hu, sl);
      Rr(13, 9 - hu, 2, 3, skin); P(15, 9 - hu, skin); P(13, 8 - hu, skin); P(14, 11 - hu, skinD);
    } else if (sit || item) {
      var up = sit && !item ? (fr ? 2 : 0) : 0, holdUp = item === 'doc' || item === 'env' || item === 'box';
      Rr(8, 12, 2, 4, slL); P(9, 12, sl); P(9, 13, sl); P(7, 13, topD);
      var fy = holdUp ? 15 : 16 - up, fc = sp.rolled ? skin : sl, fcD = sp.rolled ? skinD : slD;
      Rr(9, fy, 4, 1, fc); Rr(9, fy + 1, 4, 1, fcD); Rr(8, 15, 2, 2, slL);
      if (holdUp) { Rr(12, 14, 2, 2, skin); P(13, 15, skinD); }
      else if (item === 'stamp' || sp.stamp) {
        Rr(13, fy - 1, 2, 2, skin); P(14, fy, skinD);
        Rr(13, fy + 1, 2, 1, '#8a5a33'); Rr(12, fy + 2, 4, 1, '#c0392b');
      } else { Rr(13, fy, 2, 2, skin); P(14, fy + 1, skinD); }
    } else swingArm(8, -LF, slL, sl, skin);
    /* neck + head */
    Rr(8, 10, 2, 2, skinD);
    Rr(5, 2, 8, 8, skin); P(5, 2, undefined); P(12, 2, undefined); P(5, 9, undefined); P(12, 9, undefined);
    for (r = 3; r <= 8; r++) P(6, r, skinD);
    P(12, 8, skinD); P(11, 9, skinD); P(13, 6, skin); P(13, 7, skinD);           // nose, jaw
    P(9, 5, OUT); P(11, 5, OUT); P(9, 4, hairD); P(11, 4, hairD); P(10, 4, skinL); // eyes + brows
    P(9, 7, blush); P(11, 8, '#8c3b3b'); P(12, 8, '#8c3b3b');                    // cheek, mouth
    P(7, 5, skinD); P(7, 6, shade(skin, .7)); P(8, 6, skinD);                     // ear
    var hs = sp.hairStyle;
    if (hs === 'afro') {
      Rr(4, 0, 9, 4, hair); Rr(3, 1, 2, 7, hair); Rr(5, 4, 3, 4, hair); P(4, 0, undefined); P(12, 0, undefined); P(13, 2, hair); P(13, 1, undefined);
      P(5, 1, hairL); P(8, 0, hairL); P(10, 1, hairL); P(4, 4, hairL); P(7, 2, hairL); P(3, 6, hairD); P(6, 6, hairD);
    } else if (hs === 'bald') {
      Rr(5, 4, 3, 3, hair); P(5, 3, hair); P(8, 4, hair); P(9, 2, skinL); P(10, 2, skinL); P(8, 3, skinL);
    } else {
      Rr(6, 1, 6, 1, hair); Rr(5, 2, 8, 2, hair); Rr(5, 4, 3, 3, hair); P(8, 4, hair); P(12, 3, skin); P(11, 3, skin);
      P(8, 1, hairL); P(9, 1, hairL); P(7, 2, hairL); P(5, 5, hairD); P(12, 2, hairD); P(10, 3, hairD);
      if (hs === 'long') { Rr(3, 4, 3, 9, hair); Rr(4, 3, 2, 1, hair); P(3, 12, hairD); P(4, 12, hairD); P(3, 6, hairD); P(4, 9, hairL); Rr(4, 13, 2, 1, hairD); }
      if (hs === 'bun') { Rr(2, 1, 4, 3, hair); P(3, 1, hairL); P(2, 3, hairD); P(5, 3, hairD); P(4, 4, sp.accent || '#d64541'); }
      if (hs === 'ponytail') { Rr(3, 3, 2, 2, sp.accent || '#d64541'); Rr(2, 5, 3, 5, hair); P(2, 9, hairD); P(3, 10, hairD); P(3, 6, hairL); }
    }
    if (sp.beard) { Rr(8, 7, 5, 2, hairD); P(13, 7, hairD); P(9, 9, hairD); P(10, 9, hairD); P(11, 9, hairD); P(11, 8, '#8c3b3b'); P(12, 8, hairD); P(7, 7, hairD); P(10, 7, hair); }
    if (sp.glasses) { P(8, 5, OUT); P(9, 5, '#cfe9f5'); P(10, 5, OUT); P(11, 5, '#cfe9f5'); P(12, 5, OUT); P(9, 6, OUT); P(11, 6, OUT); P(7, 5, OUT); }
    if (sp.headset) { P(6, 1, '#2b2f36'); P(5, 2, '#2b2f36'); Rr(6, 5, 2, 3, '#2b2f36'); P(6, 5, '#d64541'); P(8, 8, '#2b2f36'); P(9, 8, '#2b2f36'); }

    if (item === 'cam') {
      Rr(9, 2, 9, 6, '#2b2f36'); Rr(9, 2, 9, 1, '#454b55'); Rr(18, 3, 2, 4, '#5a6d7d'); P(19, 4, '#a9c4d6');
      Rr(10, 0, 5, 2, '#2b2f36'); P(11, 3, fr ? '#ff3b3b' : '#6b1f1f'); Rr(13, 4, 3, 2, '#f2c230');
    }
    if (item === 'photo') {
      Rr(10, 4, 6, 4, '#2b2f36'); Rr(16, 4, 3, 4, '#3b414a'); P(18, 5, '#a9c4d6'); Rr(11, 2, 3, 2, '#3b414a'); P(12, 2, '#d9e2ea');
    }
    if (item === 'talk' && fr) { P(11, 8, '#4a1414'); P(12, 8, '#4a1414'); P(12, 9, '#4a1414'); }
    /* auto-outline + bake */
    var c = document.createElement('canvas'); c.width = SW; c.height = SH;
    var cx = c.getContext('2d');
    for (var y = 0; y < SH; y++) for (x = 0; x < SW; x++) {
      var col = grid[y * SW + x];
      if (col == null) {
        var n = (x > 0 && grid[y * SW + x - 1] != null) || (x < SW - 1 && grid[y * SW + x + 1] != null) ||
                (y > 0 && grid[(y - 1) * SW + x] != null) || (y < SH - 1 && grid[(y + 1) * SW + x] != null);
        if (!n) continue; col = OUT;
      }
      cx.fillStyle = col; cx.fillRect(x, y, 1, 1);
    }
    if (flip) { var f = document.createElement('canvas'); f.width = SW; f.height = SH; var fx2 = f.getContext('2d'); fx2.translate(SW, 0); fx2.scale(-1, 1); fx2.drawImage(c, 0, 0); c = f; }
    return (cache[key] = { img: c, cx: flip ? SW - 1 - CX : CX });
  }
  function drawPerson(p) {
    var s = sprite(p.sp, p.pose, p.fr || 0, p.item, p.dir < 0);
    g.drawImage(s.img, Math.round(p.x) - s.cx, Math.round(p.y) - BASE);
  }

  var FLOOR = 59, INK = '#241c2e';
  var SP = {
    au: { id: 'au', skin: '#e3b08a', hair: '#55504c', top: '#f4f4f0', jacket: '#26324a', tie: '#b3263a', pants: '#26324a', shoe: '#1d1d22' },
    ph: { id: 'ph', skin: '#c98d63', hair: '#1e1a1a', top: '#4d5a3c', pants: '#3b4a66', badge: '#f2c230', shoe: '#4a3428' },
    j1: { id: 'j1', skin: '#f0c3a0', hair: '#7a3e1d', hairStyle: 'long', top: '#376da9', collar: true, pants: '#2f3442', badge: '#f2c230', chair: '#5b636b' },
    j2: { id: 'j2', skin: '#8a5a3c', hair: '#141014', hairStyle: 'afro', glasses: true, top: '#5b7c40', pants: '#38404c', badge: '#f2c230', chair: '#5b636b' },
    j3: { id: 'j3', skin: '#e0ac83', hair: '#2a1d17', beard: true, top: '#9b6b22', collar: true, pants: '#33363d', badge: '#f2c230', chair: '#5b636b', rolled: true },
    j4: { id: 'j4', skin: '#5e3b26', hair: '#141014', hairStyle: 'bun', accent: '#f2c230', top: '#8b5a91', skirt: '#2b2f3a', legs: '#3a2a26', pants: '#2b2f3a', badge: '#f2c230', mic: '#2f5d9b' },
    cm: { id: 'cm', skin: '#f3d0b5', hair: '#6b4a2e', top: '#30343d', pants: '#4a4f58', badge: '#f2c230' }
  };
  var auth = { sp: SP.au, x: 262, y: FLOOR, dir: -1, pose: 'stand' };
  var crew = [
    { sp: SP.ph, x: 18, y: FLOOR, dir: 1, pose: 'stand', item: 'photo' },
    { sp: SP.j1, x: 48, y: FLOOR, dir: 1, pose: 'sit', item: 'note', ask: true },
    { sp: SP.j2, x: 78, y: FLOOR, dir: 1, pose: 'sit', item: 'note', ask: true },
    { sp: SP.j3, x: 108, y: FLOOR, dir: 1, pose: 'sit', item: 'note', ask: true },
    { sp: SP.j4, x: 144, y: FLOOR, dir: 1, pose: 'stand', item: 'mic', ask: true },
    { sp: SP.cm, x: 178, y: FLOOR, dir: 1, pose: 'stand', item: 'cam' }
  ];
  var askers = crew.filter(function (p) { return p.ask; });

  /* ---------- state machine: ask → answer → pause → next journalist ---------- */
  var t = 0, phase = 'ask', pt = 0, who = 0, flash = 0;
  var order = [0, 2, 3, 1];
  function update() {
    t++; pt++;
    var a = askers[order[who]];
    crew.forEach(function (p, i) {
      if (p.item === 'cam') { p.fr = (t >> 2) % 2; return; }
      if (p.item === 'photo') return;
      if (!p.ask) return;
      if (p === a && phase === 'ask') { p.item = p.sp.id === 'j4' ? 'mic' : 'raise'; p.fr = 0; }
      else if (p.sp.id === 'j4') { p.item = 'mic'; }
      else { p.item = 'note'; p.fr = phase === 'answer' ? ((t + i * 3) >> 1) % 2 : ((t + i * 7) % 20 < 3 ? 1 : 0); }
    });
    if (phase === 'ask') { auth.item = null; if (pt > 26) { phase = 'answer'; pt = 0; } }
    else if (phase === 'answer') {
      auth.item = 'talk'; auth.fr = (pt >> 1) % 3 === 0 ? 0 : 1;
      if (pt > 40) { phase = 'pause'; pt = 0; auth.item = null; }
    } else if (pt > 8) { phase = 'ask'; pt = 0; who = (who + 1) % order.length; }
    if (flash > 0) flash--;
    else if (Math.random() < .035) flash = 3;
  }

  /* ---------- scenery ---------- */
  function bubble(x, y, w, h, tail, tailDir) {
    R(x + 1, y, w - 2, h, INK); R(x, y + 1, w, h - 2, INK);
    R(x + 1, y + 1, w - 2, h - 2, '#ffffff'); R(x + 1, y + h - 2, w - 2, 1, '#e4e1db');
    R(tail, y + h - 1, 3, 1, '#ffffff'); px(tail - 1, y + h - 1, INK); px(tail + 3, y + h - 1, INK);
    var tx = tailDir > 0 ? tail + 1 : tail + 1;
    R(tx, y + h, 2, 1, '#ffffff'); px(tx - 1, y + h, INK); px(tx + 2, y + h, INK);
    px(tx + (tailDir > 0 ? 1 : 0), y + h + 1, INK);
  }
  function qmark(x, y, c) {
    var m = ['01110', '10001', '00010', '00100', '00100', '00000', '00100'];
    for (var j = 0; j < 7; j++) for (var i = 0; i < 5; i++) if (m[j][i] === '1') px(x + i, y + j, c);
  }
  function drawRoom() {
    R(0, 0, W, 54, '#ece6da');
    for (var x = 6; x < 204; x += 10) R(x, 0, 1, 40, '#e4ddcf');
    R(0, 40, 204, 14, '#dcd2c0'); R(0, 40, 204, 1, '#c9bca5'); R(0, 53, W, 1, '#b8ab94');
    // window
    R(14, 8, 34, 22, INK); R(15, 9, 32, 20, '#a6d9ea'); R(15, 22, 32, 7, '#b9dce8'); R(21, 18, 5, 11, '#9cc9da'); R(28, 15, 4, 14, '#9cc9da');
    R(30, 9, 1, 20, INK); R(15, 18, 32, 1, INK); R(17, 11, 7, 2, '#ffffff'); R(12, 30, 38, 2, '#c9bca5');
    // clock
    R(116, 10, 11, 11, INK); R(117, 11, 9, 9, '#ffffff'); px(121, 13, INK); px(121, 14, INK); px(121, 15, INK); px(122, 15, INK); px(123, 15, INK);
    // backdrop
    R(202, 2, 98, 52, '#1f3f73'); R(202, 2, 2, 52, '#17305a');
    for (var by = 18; by < 52; by += 9) for (var bx = 208 + ((by / 9) % 2) * 6; bx < 298; bx += 12) { px(bx + 1, by, '#3f63a3'); px(bx, by + 1, '#3f63a3'); px(bx + 2, by + 1, '#3f63a3'); px(bx + 1, by + 2, '#3f63a3'); }
    R(206, 5, 90, 9, '#17305a');
    text('COLETIVA DE IMPRENSA', 211, 7, '#ffffff');
    // flag
    R(292, 14, 1, 40, '#9aa3ab'); px(292, 13, '#f2c230');
    R(285, 16, 7, 18, '#169b47'); R(286, 20, 5, 9, '#f2c230'); R(287, 22, 3, 5, '#2a3f8f'); R(285, 16, 1, 18, '#0f7a37');
    // floor
    R(0, 54, W, H - 54, '#c9b99c'); R(0, 54, W, 1, '#a8977a');
    for (var fx = 0; fx < W; fx += 16) px(fx + ((fx >> 4) % 2) * 8, 58, '#b5a487');
    R(204, 56, 96, 8, '#8f2b37'); R(204, 56, 96, 1, '#a8394a');
    // tripod light on the left
    R(190, 20, 1, 34, '#454b55'); R(186, 53, 9, 1, '#454b55'); R(186, 14, 8, 6, '#2b2f36'); R(187, 15, 6, 4, flash ? '#ffffff' : '#fff1b8');
  }
  function drawPodium() {
    R(236, 45, 28, 3, '#8a5a33'); R(236, 45, 28, 1, '#b07a48');
    R(238, 48, 24, 10, '#6e4a2a'); R(238, 48, 1, 10, '#5a3b21'); R(238, 57, 24, 1, '#4a2f1a');
    R(246, 50, 9, 6, '#f2c230'); R(247, 51, 7, 4, '#1f3f73'); px(250, 52, '#ffffff'); px(250, 53, '#f2c230');
    var mics = [['#d64541', 239], ['#2f5d9b', 242], ['#1f8a4c', 245], ['#f2c230', 248]];
    mics.forEach(function (m, i) {
      var x0 = m[1], top = 37 + (i % 2);
      for (var y = 44; y >= top + 2; y--) px(x0 + Math.round((44 - y) * .6), y, '#2b2f36');
      var hx = x0 + Math.round((44 - top - 2) * .6);
      R(hx, top, 3, 2, '#3b414a'); px(hx + 1, top, '#6b737b'); R(hx - 1, top + 2, 3, 2, m[0]);
    });
    R(257, 41, 3, 4, '#cfe9f5'); R(257, 43, 3, 2, '#9cc9da');
  }
  function render() {
    drawRoom();
    drawPerson(auth); drawPodium();
    crew.forEach(drawPerson);
    var a = askers[order[who]];
    if (phase === 'ask' && pt > 3) {
      var bx = a.x + (a.pose === 'sit' ? 2 : 6), by = a.pose === 'sit' ? 15 : 13;
      var pop = pt < 6 ? 1 : 0;
      bubble(bx - pop, by + pop, 11 + pop * 2, 11 - pop, bx + 1, 1);
      qmark(bx + 3, by + 2 + pop, '#c8283a');
    }
    if (phase === 'answer') {
      bubble(206, 18, 44, 14, 244, 1);
      var n = Math.min(66, pt * 3);
      R(209, 21, Math.min(38, n), 2, '#6b737b');
      if (n > 38) R(209, 25, Math.min(28, n - 38), 2, '#6b737b');
      if (pt > 18) R(209, 29 - 1, 0, 0, '#6b737b');
    }
    if (flash) {
      g.globalAlpha = flash / 6; R(0, 0, W, H, '#ffffff'); g.globalAlpha = 1;
      var fx = crew[0].x + 9, fy = FLOOR - 26;
      R(fx, fy - 2, 1, 5, '#ffffff'); R(fx - 2, fy, 5, 1, '#ffffff'); px(fx - 1, fy - 1, '#fff6c9'); px(fx + 1, fy + 1, '#fff6c9');
    }
  }

  var running = false, last = 0, raf = 0, visible = true;
  function loop(now) { raf = requestAnimationFrame(loop); if (now - last < 83) return; last = now; update(); render(); }
  function start() { if (!running && !reduce) { running = true; raf = requestAnimationFrame(loop); } }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function sync() { (visible && !document.hidden) ? start() : stop(); }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; sync(); }).observe(cv);
  document.addEventListener('visibilitychange', sync);
  for (var i = 0; i < 34; i++) update();
  render(); sync();
})();
