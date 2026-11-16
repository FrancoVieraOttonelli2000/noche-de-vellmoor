'use strict';
/* Noche de Vellmoor — prototipo "survivor" de horror gótico y cósmico.
   Todo el arte se genera con formas en Canvas; nombres y diseño originales. */

// ---------------------------------------------------------------- Canvas
const canvas = document.getElementById('game');
const mainCtx = canvas.getContext('2d');
let ctx = mainCtx; // durante el render del mundo apunta al lienzo de baja resolución
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
}
window.addEventListener('resize', resize);
resize();
// El mundo se dibuja en un lienzo chico y se agranda sin suavizado: un solo tamaño de píxel para todo
const sceneCv = document.createElement('canvas'), sctx = sceneCv.getContext('2d');
function pixelZoom() { return W >= 1600 ? 2 : W >= 1000 ? 1.5 : 1.25; }
function viewW() { return W / pixelZoom(); }
function viewH() { return H / pixelZoom(); }

// ---------------------------------------------------------------- Utilidades
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function hash(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); }

// --- Pixel art gótico: cada figura se redibuja sobre una grilla de pixeles con una paleta limitada
// (negros, hueso, sangre, oro, acero lunar, arcano), tramado ordenado, luz de luna en los bordes
// superiores, sombra en los inferiores y contorno de un pixel.
const PIXEL_PALETTE = [
  '#07040a', '#140e16', '#221824', '#2e2430', '#3e3440', '#54484e', '#6e6266', '#8e8484', '#b8aea4', '#e2d8c8',
  '#2a0a10', '#4e1018', '#7a1a22', '#a8282c', '#d4483c',
  '#2a1a10', '#4a3018', '#6e4a24', '#9a6e34', '#c9a35a', '#f0d890',
  '#14202a', '#24384a', '#4a6a82', '#9ac0d8',
  '#1c1028', '#3a2050', '#6a3a8a', '#b07cff',
  '#1a2a14', '#3a5a2a', '#7aa84a',
  '#ff9a3c', '#ffd27a',
].map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const PAL_CACHES = new Map();
function nearestPal(r, g, b, pal = PIXEL_PALETTE) {
  let PAL_CACHE = PAL_CACHES.get(pal);
  if (!PAL_CACHE) PAL_CACHES.set(pal, PAL_CACHE = new Map());
  const key = (r >> 3) << 10 | (g >> 3) << 5 | (b >> 3);
  let hit = PAL_CACHE.get(key);
  if (hit) return hit;
  let best = pal[0], bd = Infinity;
  for (const c of pal) {
    const dr = r - c[0], dg = g - c[1], db = b - c[2], d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
    if (d < bd) { bd = d; best = c; }
  }
  PAL_CACHE.set(key, best);
  return best;
}
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function pixelArt(src, px = 1.3, pal = PIXEL_PALETTE, rim = 0.38, dith = 22) {
  const logical = src.width / 2, n = Math.max(10, Math.round(logical / px));
  const c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.drawImage(src, 0, 0, n, n);
  const img = g.getImageData(0, 0, n, n), d = img.data;
  const solid = new Uint8Array(n * n);
  // 1) silueta nítida + paleta limitada con tramado
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = (y * n + x) * 4;
    if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
    const t = (BAYER4[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * dith;
    const [r, gg, b] = nearestPal(clamp(d[i] + t, 0, 255), clamp(d[i + 1] + t, 0, 255), clamp(d[i + 2] + t, 0, 255), pal);
    d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255; solid[y * n + x] = 1;
  }
  const at = (x, y) => x >= 0 && y >= 0 && x < n && y < n && solid[y * n + x];
  const out = new Uint8ClampedArray(d);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = (y * n + x) * 4;
    if (solid[y * n + x]) {
      // 2) luz de luna arriba a la izquierda, sombra abajo a la derecha
      const lit = !at(x, y - 1) || !at(x - 1, y), shade = !at(x, y + 1) || !at(x + 1, y);
      let r = d[i], gg = d[i + 1], b = d[i + 2];
      if (lit && !shade) { r = r + (226 - r) * rim; gg = gg + (222 - gg) * rim; b = b + (240 - b) * rim * 1.1; }
      else if (shade && !lit) { r *= 0.62; gg *= 0.62; b *= 0.7; }
      const q = nearestPal(r, gg, b, pal); out[i] = q[0]; out[i + 1] = q[1]; out[i + 2] = q[2];
    } else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) {
      // 3) contorno de un pixel
      out[i] = 7; out[i + 1] = 4; out[i + 2] = 10; out[i + 3] = 255;
    }
  }
  img.data.set(out); g.putImageData(img, 0, 0);
  c.pixel = true;
  return c;
}
// dibuja un sprite de pixel art sin suavizar (pixeles nítidos)
function crisp(fn) { const s = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; fn(); ctx.imageSmoothingEnabled = s; }


const RUN_LENGTH = 600;      // 10 minutos hasta el amanecer
const MAX_ENEMIES = 320;

// ---------------------------------------------------------------- Sonido (sintetizado)
let actx = null, muted = false;
const lastSfx = {};
const SFX = {
  hit:   [260, 120, 0.05, 'square', 0.02],
  pick:  [900, 1400, 0.05, 'sine', 0.03],
  level: [392, 784, 0.4, 'triangle', 0.09],
  hurt:  [180, 60, 0.2, 'sawtooth', 0.07],
  bell:  [660, 640, 0.7, 'sine', 0.06],
  toss:  [500, 250, 0.06, 'triangle', 0.02],
  shot:  [1100, 160, 0.08, 'square', 0.035],
  slash: [420, 140, 0.09, 'sawtooth', 0.03],
  boom:  [140, 40, 0.3, 'sawtooth', 0.05],
  die:   [240, 50, 0.7, 'sawtooth', 0.09],
  elite: [90, 60, 0.9, 'sawtooth', 0.09],
  heal:  [520, 1040, 0.25, 'sine', 0.06],
  rift:  [70, 35, 1.6, 'sine', 0.14],
  lucid: [330, 990, 0.6, 'sine', 0.06],
  trick: [180, 620, 0.16, 'triangle', 0.06],
  parry: [1500, 700, 0.18, 'square', 0.05],
  visceral: [130, 50, 0.4, 'sawtooth', 0.1],
  dodge: [500, 200, 0.12, 'triangle', 0.035],
  vial:  [300, 700, 0.35, 'sine', 0.07],
  reload: [200, 90, 0.25, 'sawtooth', 0.06],
  stomp: [80, 30, 0.5, 'sawtooth', 0.1],
  phase: [110, 55, 1.2, 'sawtooth', 0.09],
  empty: [180, 160, 0.06, 'square', 0.03],
};
function sfx(name) {
  if (muted) return;
  const d = SFX[name]; if (!d) return;
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch (e) { return; }
  const now = actx.currentTime;
  if (lastSfx[name] && now - lastSfx[name] < 0.045) return;
  lastSfx[name] = now;
  const [f0, f1, dur, type, vol] = d;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, now);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g); g.connect(actx.destination);
  o.start(now); o.stop(now + dur + 0.02);
}

// ---------------------------------------------------------------- Sprites generados
function makeSprite(size, fn) {
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  const g = c.getContext('2d');
  g.scale(2, 2); g.translate(size / 2, size / 2);
  g.lineCap = 'round'; g.lineJoin = 'round';
  fn(g);
  return c;
}
function flashOf(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  return c;
}
// Contorno peludo/irregular
function blob(g, r, n, jag, seed) {
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const k = ((hash(i % n, seed) % 100) / 100 - 0.5) * jag * (i % 2 ? 1 : 0.4);
    const rr = r * (1 + k);
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
}

const SPR = {};
SPR.player = makeSprite(48, g => {
  // abrigo largo
  g.fillStyle = '#1c1a22';
  g.beginPath(); g.moveTo(-7, -3); g.lineTo(7, -3); g.lineTo(12, 15); g.lineTo(2, 13); g.lineTo(0, 16); g.lineTo(-2, 13); g.lineTo(-12, 15); g.closePath(); g.fill();
  g.strokeStyle = '#3a3542'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -2); g.lineTo(0, 13); g.stroke();
  g.fillStyle = '#5a4630'; g.fillRect(-8, 4, 16, 2);
  // esclavina carmesí
  g.fillStyle = '#7d1a26';
  g.beginPath(); g.moveTo(-9, -4); g.lineTo(9, -4); g.lineTo(6, 1); g.lineTo(-6, 1); g.closePath(); g.fill();
  // cabeza y máscara
  g.fillStyle = '#d8c6ad'; g.beginPath(); g.arc(0, -9, 5, 0, TAU); g.fill();
  g.fillStyle = '#2b2832'; g.fillRect(-5, -8, 10, 4);
  g.fillStyle = '#e9e2d0'; g.fillRect(1, -11, 2, 1.5);
  // sombrero de ala ancha
  g.fillStyle = '#121016';
  g.beginPath(); g.ellipse(0, -13, 12, 3.2, 0, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(-6, -13); g.lineTo(-5, -21); g.lineTo(5, -21); g.lineTo(6, -13); g.closePath(); g.fill();
  g.fillStyle = '#7d1a26'; g.fillRect(-6, -15, 12, 1.6);
  // hoja en la mano derecha
  g.strokeStyle = '#c9ccd8'; g.lineWidth = 2; g.beginPath(); g.moveTo(9, 4); g.lineTo(19, -9); g.stroke();
  g.strokeStyle = '#5a4630'; g.lineWidth = 3; g.beginPath(); g.moveTo(7, 7); g.lineTo(9.5, 3.5); g.stroke();
  // pistola en la mano izquierda
  g.fillStyle = '#2a2730'; g.fillRect(-16, 5, 8, 3);
  g.fillStyle = '#5a4630'; g.fillRect(-10, 6, 3, 5);
});

// El cazador, con más detalle y ciclo de caminata (0 = quieto, 1..4 = pasos)
function hunterFrame(step) {
  const k = step ? Math.sin(((step - 1) / 4) * TAU) : 0, sw = k * 2;
  return makeSprite(56, g => {
    // piernas y botas
    g.fillStyle = '#141018';
    g.fillRect(-6 + k * 2, 10, 4, 9 - Math.max(0, k) * 2); g.fillRect(2 - k * 2, 10, 4, 9 - Math.max(0, -k) * 2);
    g.fillStyle = '#2e2218';
    g.fillRect(-7 + k * 2, 18 - Math.max(0, k) * 2, 6, 3); g.fillRect(1 - k * 2, 18 - Math.max(0, -k) * 2, 6, 3);
    // abrigo largo con faldones que se balancean
    const cg = g.createLinearGradient(-12, -4, 12, 16); cg.addColorStop(0, '#2c2834'); cg.addColorStop(1, '#121018');
    g.fillStyle = cg;
    g.beginPath(); g.moveTo(-8, -4); g.lineTo(8, -4); g.lineTo(12 + sw, 16); g.lineTo(3 + sw * 0.5, 13); g.lineTo(0, 17); g.lineTo(-3 + sw * 0.5, 13); g.lineTo(-12 + sw, 16); g.closePath(); g.fill();
    g.strokeStyle = '#3a3542'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(0.5, -3); g.lineTo(0.5, 13); g.stroke();
    g.fillStyle = '#c9a35a'; for (const y of [0, 3.5, 7]) { g.beginPath(); g.arc(2, y, 0.8, 0, TAU); g.fill(); }
    g.fillStyle = '#4a3826'; g.fillRect(-8, 5, 16, 2.4); g.fillStyle = '#c9a35a'; g.fillRect(-1.2, 5, 2.4, 2.4);
    // esclavina carmesí con pliegues
    g.fillStyle = '#6e1622'; g.beginPath(); g.moveTo(-10, -5); g.lineTo(10, -5); g.lineTo(8, 3); g.lineTo(0, 4.5); g.lineTo(-8, 3); g.closePath(); g.fill();
    g.strokeStyle = '#4a0c16'; g.lineWidth = 0.8; for (const x of [-5, 0, 5]) { g.beginPath(); g.moveTo(x, -4); g.lineTo(x * 0.9, 3); g.stroke(); }
    // brazo derecho con estoque
    g.fillStyle = '#1e1b24'; g.fillRect(7, -3, 4, 9);
    g.fillStyle = '#c8b8a0'; g.beginPath(); g.arc(9, 7, 1.6, 0, TAU); g.fill();
    g.strokeStyle = '#d4d8e4'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 6); g.lineTo(22, -9); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(11, 4.6); g.lineTo(21, -8); g.stroke();
    g.strokeStyle = '#c9a35a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(8, 8); g.lineTo(12, 4); g.stroke();
    // brazo izquierdo con pistola
    g.fillStyle = '#1e1b24'; g.fillRect(-11, -3, 4, 8);
    g.fillStyle = '#2a2730'; g.fillRect(-18, 4, 9, 3); g.fillStyle = '#5a4630'; g.fillRect(-11, 5, 3, 5);
    g.fillStyle = '#8a8a96'; g.fillRect(-18, 4, 6, 1);
    // cabeza: rostro pálido, máscara de tela y ojos
    g.fillStyle = '#d8c6ad'; g.beginPath(); g.arc(0, -10, 5.2, 0, TAU); g.fill();
    g.fillStyle = '#2b2832'; g.fillRect(-5.2, -9, 10.4, 4.5);
    g.fillStyle = '#f0e8d8'; g.fillRect(1, -12, 2, 1.4); g.fillRect(-2.6, -12, 1.6, 1.4);
    // sombrero de ala ancha con cinta
    g.fillStyle = '#110e14'; g.beginPath(); g.ellipse(0, -14.5, 13, 3.4, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-6, -14.5); g.lineTo(-5, -23); g.lineTo(5, -23); g.lineTo(6, -14.5); g.closePath(); g.fill();
    g.fillStyle = '#6e1622'; g.fillRect(-6, -16.6, 12, 1.8);
    g.strokeStyle = '#2c2834'; g.lineWidth = 1; g.beginPath(); g.moveTo(-4, -21.5); g.lineTo(-4.6, -16.8); g.stroke();
    // farolito en la cadera
    g.fillStyle = '#5a4630'; g.fillRect(-13.4, 7, 4.8, 6);
    g.fillStyle = '#ffcf6b'; g.beginPath(); g.arc(-11, 10, 2, 0, TAU); g.fill();
  });
}

SPR.aldeano = makeSprite(40, g => {
  g.fillStyle = '#3d312b';
  g.beginPath(); g.moveTo(-9, 13); g.lineTo(9, 13); g.lineTo(6, -3); g.lineTo(-6, -3); g.closePath(); g.fill();
  g.fillStyle = '#7a6a5c'; g.beginPath(); g.arc(1, -6, 5.5, 0, TAU); g.fill();
  g.fillStyle = '#4c3d35';
  g.beginPath(); g.arc(0, -7, 7, Math.PI, 0); g.lineTo(6, -3); g.lineTo(-6, -2); g.closePath(); g.fill();
  g.fillStyle = '#ff5a3c'; g.fillRect(1, -7, 2, 2); g.fillRect(4, -7, 2, 2);
  g.strokeStyle = '#6b5236'; g.lineWidth = 2; g.beginPath(); g.moveTo(7, 12); g.lineTo(12, -9); g.stroke();
  g.fillStyle = '#ffb347'; g.beginPath(); g.arc(12.5, -11, 3, 0, TAU); g.fill();
  g.fillStyle = '#ff7a2a'; g.beginPath(); g.arc(12.5, -12, 1.6, 0, TAU); g.fill();
});

SPR.sabueso = makeSprite(44, g => {
  g.strokeStyle = '#2a1614'; g.lineWidth = 2.5;
  [[-9, 4, -11, 12], [-4, 5, -3, 12], [5, 4, 4, 12], [9, 3, 11, 11]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
  g.strokeStyle = '#4f2b27'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(-12, 0); g.quadraticCurveTo(-18, -4, -17, -9); g.stroke();
  g.fillStyle = '#4f2b27'; g.beginPath(); g.ellipse(-1, 1, 12, 6.5, -0.05, 0, TAU); g.fill();
  g.fillStyle = '#2e1916';
  for (let i = -8; i <= 6; i += 4) { g.beginPath(); g.moveTo(i - 2, -4); g.lineTo(i, -9); g.lineTo(i + 2, -4); g.fill(); }
  g.fillStyle = '#5a312c'; g.beginPath(); g.ellipse(11, -3, 7, 4.5, -0.25, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(8, -6); g.lineTo(9, -12); g.lineTo(12, -7); g.fill();
  g.fillStyle = '#ffd23c'; g.beginPath(); g.arc(13, -4.5, 1.4, 0, TAU); g.fill();
  g.fillStyle = '#e8dcc4';
  g.beginPath(); g.moveTo(14, -1); g.lineTo(15, 1.5); g.lineTo(16, -1); g.fill();
});

function batFrame(up) {
  return makeSprite(36, g => {
    const wy = up ? -10 : 6;
    g.fillStyle = '#2a1f33';
    for (const s of [1, -1]) {
      g.save(); g.scale(s, 1);
      g.beginPath(); g.moveTo(3, 0); g.quadraticCurveTo(10, wy - 4, 16, wy); g.lineTo(11, wy + 3); g.lineTo(8, wy + 1); g.lineTo(5, 3); g.closePath(); g.fill();
      g.restore();
    }
    g.fillStyle = '#3a2b46'; g.beginPath(); g.ellipse(0, 1, 4, 5, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-3, -3); g.lineTo(-2, -7); g.lineTo(-1, -3); g.fill();
    g.beginPath(); g.moveTo(3, -3); g.lineTo(2, -7); g.lineTo(1, -3); g.fill();
    g.fillStyle = '#ff3b4e'; g.fillRect(-2.2, -1.5, 1.4, 1.4); g.fillRect(0.8, -1.5, 1.4, 1.4);
  });
}
SPR.murcielago = batFrame(true);
SPR.murcielago2 = batFrame(false);

SPR.bestia = makeSprite(64, g => {
  g.strokeStyle = '#3b2a22'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(10, 2); g.lineTo(20, 11); g.stroke();
  g.beginPath(); g.moveTo(-10, 2); g.lineTo(-17, 13); g.stroke();
  g.strokeStyle = '#e8dcc4'; g.lineWidth = 1.2;
  [[20, 11], [-17, 13]].forEach(([x, y]) => { for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3 + k, y + 4); g.stroke(); } });
  g.fillStyle = '#3b2a22'; blob(g, 17, 22, 0.45, 7); g.fill();
  g.fillStyle = '#4e382c'; blob(g, 12, 18, 0.35, 11); g.fill();
  g.fillStyle = '#4e382c'; g.beginPath(); g.ellipse(8, -11, 8, 7, 0, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(3, -15); g.lineTo(2, -23); g.lineTo(7, -17); g.fill();
  g.beginPath(); g.moveTo(10, -17); g.lineTo(13, -24); g.lineTo(14, -16); g.fill();
  g.fillStyle = '#ffd23c'; g.beginPath(); g.arc(9, -12, 1.6, 0, TAU); g.arc(13, -11, 1.6, 0, TAU); g.fill();
  g.fillStyle = '#1a0e0b'; g.beginPath(); g.ellipse(12, -6, 4, 2.2, 0, 0, TAU); g.fill();
  g.fillStyle = '#e8dcc4'; for (let i = 9; i <= 14; i += 2.5) { g.beginPath(); g.moveTo(i, -7.5); g.lineTo(i + 0.8, -5.2); g.lineTo(i + 1.6, -7.5); g.fill(); }
});

SPR.coloso = makeSprite(104, g => {
  const glow = g.createRadialGradient(0, 0, 10, 0, 0, 50);
  glow.addColorStop(0, 'rgba(160,20,35,0.35)'); glow.addColorStop(1, 'rgba(160,20,35,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(0, 0, 50, 0, TAU); g.fill();
  g.strokeStyle = '#2a1d1a'; g.lineWidth = 8;
  g.beginPath(); g.moveTo(16, 4); g.lineTo(34, 18); g.stroke();
  g.beginPath(); g.moveTo(-16, 4); g.lineTo(-30, 22); g.stroke();
  g.strokeStyle = '#e8dcc4'; g.lineWidth = 2;
  [[34, 18], [-30, 22]].forEach(([x, y]) => { for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4 + k * 2, y + 7); g.stroke(); } });
  g.fillStyle = '#2a1d1a'; blob(g, 30, 30, 0.4, 21); g.fill();
  g.fillStyle = '#3a2823'; blob(g, 22, 24, 0.3, 33); g.fill();
  g.strokeStyle = '#cdbfa5'; g.lineWidth = 2.5;
  for (const s of [1, -1]) {
    g.beginPath(); g.moveTo(6 * s + 6, -26); g.lineTo(14 * s + 6, -42); g.lineTo(22 * s + 6, -46); g.stroke();
    g.beginPath(); g.moveTo(11 * s + 6, -36); g.lineTo(4 * s + 6, -44); g.stroke();
    g.beginPath(); g.moveTo(17 * s + 6, -44); g.lineTo(18 * s + 6, -50); g.stroke();
  }
  g.fillStyle = '#3a2823'; g.beginPath(); g.ellipse(8, -22, 13, 10, 0, 0, TAU); g.fill();
  g.fillStyle = '#ff2a3c'; g.beginPath(); g.arc(8, -24, 2.4, 0, TAU); g.arc(15, -23, 2.4, 0, TAU); g.fill();
  g.fillStyle = '#120806'; g.beginPath(); g.ellipse(14, -15, 6, 3.2, 0, 0, TAU); g.fill();
  g.fillStyle = '#e8dcc4'; for (let i = 9; i <= 18; i += 3) { g.beginPath(); g.moveTo(i, -17); g.lineTo(i + 1.2, -13.5); g.lineTo(i + 2.4, -17); g.fill(); }
});

SPR.player = hunterFrame(0);
for (let i = 1; i <= 4; i++) SPR['player_w' + i] = hunterFrame(i);

// --- Horrores cósmicos
SPR.larva = makeSprite(34, g => {
  for (let i = 3; i >= 0; i--) {
    g.fillStyle = i ? '#8d7fa8' : '#a898c4';
    g.beginPath(); g.arc(-i * 4.5, Math.sin(i * 1.3) * 1.5, 5.5 - i * 0.8, 0, TAU); g.fill();
  }
  g.fillStyle = '#2a0f2e'; g.beginPath(); g.arc(2, 0, 2.6, 0, TAU); g.fill();
  g.fillStyle = '#e8dcc4'; for (const k of [-1, 0, 1]) g.fillRect(3.4, k * 1.3 - 0.3, 1.3, 0.7);
  g.fillStyle = 'rgba(190,255,140,0.9)'; g.fillRect(-6, -3, 1.3, 1.3); g.fillRect(-10, 2, 1.3, 1.3); g.fillRect(-13, -1, 1, 1);
});

SPR.ojo = makeSprite(46, g => {
  g.strokeStyle = '#3d2a4a'; g.lineWidth = 2.2;
  for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 3, 8); g.quadraticCurveTo(i * 5 + 3, 15, i * 4, 21); g.stroke(); }
  const gr = g.createRadialGradient(-3, -3, 2, 0, 0, 13);
  gr.addColorStop(0, '#f4efe4'); gr.addColorStop(1, '#b8a592');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(170,30,50,0.75)'; g.lineWidth = 0.8;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.4;
    g.beginPath(); g.moveTo(Math.cos(a) * 12, Math.sin(a) * 12); g.quadraticCurveTo(Math.cos(a + 0.3) * 9, Math.sin(a + 0.3) * 9, Math.cos(a) * 6.5, Math.sin(a) * 6.5); g.stroke();
  }
  g.fillStyle = '#6a2fa0'; g.beginPath(); g.arc(2, 0, 5.5, 0, TAU); g.fill();
  g.fillStyle = '#0d0610'; g.beginPath(); g.ellipse(2.5, 0, 1.6, 4.2, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(-4, -5, 1.6, 0, TAU); g.fill();
});

SPR.tentaculo = makeSprite(70, g => {
  g.strokeStyle = '#1f3b3a'; g.lineWidth = 4;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    g.beginPath(); g.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
    g.quadraticCurveTo(Math.cos(a + 0.5) * 24, Math.sin(a + 0.5) * 24, Math.cos(a + 0.15) * 31, Math.sin(a + 0.15) * 31); g.stroke();
  }
  g.fillStyle = '#24453f'; blob(g, 18, 20, 0.3, 41); g.fill();
  g.fillStyle = '#2f5a52'; blob(g, 13, 16, 0.25, 43); g.fill();
  for (const [x, y, r] of [[-6, -6, 3], [5, -8, 2.2], [8, 2, 2.6], [-2, 4, 2], [-10, 2, 1.6], [2, -1, 1.4]]) {
    g.fillStyle = '#efe7a0'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = '#0b0b0b'; g.beginPath(); g.arc(x + r * 0.25, y, r * 0.45, 0, TAU); g.fill();
  }
  g.fillStyle = '#0a1412'; g.beginPath(); g.ellipse(2, 10, 5, 2.5, 0, 0, TAU); g.fill();
});

SPR.heraldo = makeSprite(130, g => {
  const glow = g.createRadialGradient(0, -10, 8, 0, -10, 62);
  glow.addColorStop(0, 'rgba(140,60,200,0.4)'); glow.addColorStop(1, 'rgba(140,60,200,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(0, -10, 62, 0, TAU); g.fill();
  // halo de tentáculos
  g.strokeStyle = '#3a2450'; g.lineWidth = 3.5;
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    const ex = Math.cos(a) * 46, ey = -30 + Math.sin(a) * 40;
    g.beginPath(); g.moveTo(0, -30);
    g.bezierCurveTo(Math.cos(a - 0.4) * 20, -30 + Math.sin(a - 0.4) * 20, Math.cos(a + 0.4) * 34, -30 + Math.sin(a + 0.4) * 30, ex, ey);
    g.stroke();
  }
  // túnica harapienta
  g.fillStyle = '#1a1222';
  g.beginPath(); g.moveTo(-14, -18); g.lineTo(14, -18); g.lineTo(30, 46);
  for (let x = 30; x > -30; x -= 7.5) g.lineTo(x - 3.75, 46 + ((x / 7.5) % 2 ? 6 : 0));
  g.lineTo(-30, 46); g.closePath(); g.fill();
  g.strokeStyle = '#2d1f3b'; g.lineWidth = 1.5;
  for (const x of [-10, 0, 10]) { g.beginPath(); g.moveTo(x * 0.5, -14); g.lineTo(x * 1.8, 44); g.stroke(); }
  // manos largas y pálidas
  g.strokeStyle = '#d9d0c4'; g.lineWidth = 1.4;
  for (const s of [1, -1]) for (let k = 0; k < 4; k++) {
    g.beginPath(); g.moveTo(20 * s, 8); g.lineTo((26 + k * 1.5) * s, 18 + k * 2.5); g.stroke();
  }
  // rostro liso, sin facciones
  const fg = g.createRadialGradient(-3, -34, 2, 0, -30, 14);
  fg.addColorStop(0, '#f0e8dc'); fg.addColorStop(1, '#a89c8e');
  g.fillStyle = fg; g.beginPath(); g.ellipse(0, -30, 10, 13, 0, 0, TAU); g.fill();
  g.strokeStyle = '#8a3fd0'; g.lineWidth = 1.2;
  g.beginPath(); g.arc(0, -36, 2.5, 0, TAU); g.stroke();
});

// --- Bestia desollada (solo bajo la Luna de sangre)
SPR.desollado = makeSprite(52, g => {
  g.strokeStyle = '#5a1a1e'; g.lineWidth = 3;
  [[-10, 4, -14, 16], [-4, 5, -5, 16], [6, 4, 7, 16], [11, 3, 15, 14]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
  g.fillStyle = '#8a2c30'; g.beginPath(); g.ellipse(0, 0, 14, 7, -0.1, 0, TAU); g.fill();
  g.strokeStyle = '#e0c8b0'; g.lineWidth = 1.2;
  for (const x of [-7, -3, 1, 5]) { g.beginPath(); g.moveTo(x, -5); g.quadraticCurveTo(x + 2, 0, x, 5); g.stroke(); }
  g.fillStyle = '#e0c8b0';
  for (let x = -10; x <= 6; x += 4) { g.beginPath(); g.moveTo(x - 1.5, -6); g.lineTo(x, -11); g.lineTo(x + 1.5, -6); g.fill(); }
  g.fillStyle = '#9a3438'; g.beginPath(); g.ellipse(14, -5, 7, 5, -0.3, 0, TAU); g.fill();
  g.fillStyle = '#2a0608'; g.beginPath(); g.moveTo(15, -3); g.lineTo(22, -1); g.lineTo(15, 1); g.closePath(); g.fill();
  g.fillStyle = '#e0c8b0'; g.fillRect(17, -2.5, 1, 1.5); g.fillRect(19, -2, 1, 1.5);
  g.fillStyle = '#fff2a0'; g.beginPath(); g.arc(15, -7, 1.5, 0, TAU); g.fill();
});

// --- Jefe final: la Bestia del Campanario Rojo
SPR.campanario = makeSprite(150, g => {
  const glow = g.createRadialGradient(0, 0, 10, 0, 0, 72);
  glow.addColorStop(0, 'rgba(190,20,40,0.4)'); glow.addColorStop(1, 'rgba(190,20,40,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(0, 0, 72, 0, TAU); g.fill();
  for (const s of [1, -1]) {
    g.save(); g.scale(s, 1);
    g.fillStyle = '#2a1418';
    g.beginPath(); g.moveTo(12, -18); g.quadraticCurveTo(46, -64, 72, -36); g.lineTo(62, -26); g.lineTo(57, -10); g.lineTo(47, -16);
    g.lineTo(40, 0); g.lineTo(30, -8); g.lineTo(16, 6); g.closePath(); g.fill();
    g.strokeStyle = '#4a2228'; g.lineWidth = 2;
    for (const [x, y] of [[62, -26], [47, -16], [30, -8]]) { g.beginPath(); g.moveTo(14, -16); g.lineTo(x, y); g.stroke(); }
    g.restore();
  }
  g.strokeStyle = '#3a1e1e'; g.lineWidth = 7;
  g.beginPath(); g.moveTo(18, 8); g.lineTo(32, 26); g.stroke();
  g.beginPath(); g.moveTo(-18, 8); g.lineTo(-32, 26); g.stroke();
  g.strokeStyle = '#e8dcc4'; g.lineWidth = 2;
  [[32, 26], [-32, 26]].forEach(([x, y]) => { for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + k * 3, y + 7); g.stroke(); } });
  g.fillStyle = '#3a1e1e'; blob(g, 28, 30, 0.4, 77); g.fill();
  g.fillStyle = '#4a2a26'; blob(g, 20, 24, 0.3, 79); g.fill();
  g.fillStyle = '#4a2a26'; g.beginPath(); g.ellipse(0, -30, 14, 12, 0, 0, TAU); g.fill();
  g.strokeStyle = '#cdbfa5'; g.lineWidth = 3;
  for (const s of [1, -1]) { g.beginPath(); g.moveTo(8 * s, -38); g.quadraticCurveTo(18 * s, -50, 12 * s, -58); g.stroke(); }
  g.fillStyle = '#ff2a3c'; for (const [x, y] of [[-6, -32], [6, -32], [0, -37]]) { g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.fill(); }
  g.fillStyle = '#140606'; g.beginPath(); g.ellipse(0, -23, 7, 3.5, 0, 0, TAU); g.fill();
  g.fillStyle = '#e8dcc4'; for (let x = -5; x <= 4; x += 3) { g.beginPath(); g.moveTo(x, -25); g.lineTo(x + 1.2, -21.5); g.lineTo(x + 2.4, -25); g.fill(); }
  // la campana colgada del cuello
  g.strokeStyle = '#5a4a3a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-8, -18); g.lineTo(0, -4); g.lineTo(8, -18); g.stroke();
  g.fillStyle = '#8a6a2a';
  g.beginPath(); g.moveTo(-9, 4); g.quadraticCurveTo(-9, -6, 0, -6); g.quadraticCurveTo(9, -6, 9, 4); g.lineTo(12, 12); g.lineTo(-12, 12); g.closePath(); g.fill();
  g.fillStyle = '#5a4418'; g.beginPath(); g.arc(0, 13, 2.5, 0, TAU); g.fill();
});

// --- Jefe de las criptas: el Sepulturero hueco
SPR.sepulturero = makeSprite(130, g => {
  const glow = g.createRadialGradient(-22, 6, 4, -22, 6, 40);
  glow.addColorStop(0, 'rgba(120,255,140,0.45)'); glow.addColorStop(1, 'rgba(120,255,140,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(-22, 6, 40, 0, TAU); g.fill();
  // pala enorme
  g.strokeStyle = '#5a4630'; g.lineWidth = 4; g.beginPath(); g.moveTo(14, 30); g.lineTo(34, -36); g.stroke();
  g.fillStyle = '#7a7a82'; g.beginPath(); g.moveTo(28, -34); g.lineTo(44, -40); g.lineTo(46, -56); g.lineTo(32, -60); g.closePath(); g.fill();
  // abrigo encorvado
  g.fillStyle = '#1e1c22';
  g.beginPath(); g.moveTo(-18, -14); g.quadraticCurveTo(0, -26, 18, -12); g.lineTo(26, 42); g.lineTo(-26, 42); g.closePath(); g.fill();
  g.strokeStyle = '#2e2a34'; g.lineWidth = 1.5; for (const x of [-10, 0, 10]) { g.beginPath(); g.moveTo(x * 0.6, -12); g.lineTo(x * 1.6, 40); g.stroke(); }
  // farol verde
  g.strokeStyle = '#3a3640'; g.lineWidth = 2; g.beginPath(); g.moveTo(-14, -2); g.lineTo(-22, 0); g.stroke();
  g.fillStyle = '#2a2830'; g.fillRect(-27, 0, 10, 12);
  g.fillStyle = '#9affa8'; g.fillRect(-25, 2, 6, 8);
  // cabeza: cráneo pálido bajo un sombrero de ala ancha
  g.fillStyle = '#d8d0c0'; g.beginPath(); g.ellipse(2, -24, 9, 10, 0, 0, TAU); g.fill();
  g.fillStyle = '#0c0a0e'; g.beginPath(); g.arc(-1, -25, 2.6, 0, TAU); g.arc(6, -25, 2.6, 0, TAU); g.fill();
  g.fillStyle = '#7aff8a'; g.beginPath(); g.arc(-1, -25, 1.1, 0, TAU); g.arc(6, -25, 1.1, 0, TAU); g.fill();
  g.fillStyle = '#121016'; g.beginPath(); g.ellipse(2, -32, 18, 4.5, -0.1, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(-7, -32); g.lineTo(-5, -44); g.lineTo(10, -44); g.lineTo(11, -32); g.closePath(); g.fill();
});

// --- Vigilante con mosquete (dispara desde lejos)
SPR.tirador = makeSprite(44, g => {
  g.fillStyle = '#2e2a26'; g.beginPath(); g.moveTo(-8, -3); g.lineTo(8, -3); g.lineTo(10, 13); g.lineTo(-10, 13); g.closePath(); g.fill();
  g.fillStyle = '#5a4630'; g.fillRect(-8, 3, 16, 2);
  g.fillStyle = '#a89a86'; g.beginPath(); g.arc(0, -8, 5, 0, TAU); g.fill();
  g.fillStyle = '#ff5a3c'; g.fillRect(1, -9, 1.6, 1.6); g.fillRect(3.5, -9, 1.6, 1.6);
  g.fillStyle = '#1a1612'; g.beginPath(); g.moveTo(-8, -11); g.lineTo(0, -19); g.lineTo(8, -11); g.closePath(); g.fill();
  g.strokeStyle = '#4a3a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-2, 4); g.lineTo(18, -4); g.stroke();
  g.strokeStyle = '#7a7a82'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(8, 0); g.lineTo(21, -5); g.stroke();
});
// --- Aldeano incendiario (arroja botellas en llamas)
SPR.lanzador = makeSprite(40, g => {
  g.fillStyle = '#4a3428'; g.beginPath(); g.moveTo(-9, 13); g.lineTo(9, 13); g.lineTo(6, -3); g.lineTo(-6, -3); g.closePath(); g.fill();
  g.fillStyle = '#7a6a5c'; g.beginPath(); g.arc(0, -6, 5.5, 0, TAU); g.fill();
  g.fillStyle = '#3a2a22'; g.beginPath(); g.arc(0, -7, 7, Math.PI, 0); g.lineTo(6, -3); g.lineTo(-6, -2); g.closePath(); g.fill();
  g.fillStyle = '#ffb347'; g.fillRect(-2, -7, 2, 2); g.fillRect(2, -7, 2, 2);
  g.fillStyle = '#5a6a3a'; g.fillRect(-14, -8, 5, 8);
  g.fillStyle = '#ff8a2a'; g.beginPath(); g.arc(-11.5, -11, 2.6, 0, TAU); g.fill();
});
// --- Monje de la campana (anillos de orbes)
SPR.monje = makeSprite(46, g => {
  g.fillStyle = '#3a2a3a'; g.beginPath(); g.moveTo(-10, 14); g.lineTo(10, 14); g.lineTo(7, -4); g.lineTo(-7, -4); g.closePath(); g.fill();
  g.fillStyle = '#4a3448'; g.beginPath(); g.arc(0, -7, 7.5, Math.PI, 0); g.lineTo(7, -2); g.lineTo(-7, -2); g.closePath(); g.fill();
  g.fillStyle = '#120a12'; g.beginPath(); g.arc(0, -5, 4.5, 0, TAU); g.fill();
  g.fillStyle = '#d07cff'; g.fillRect(-2.5, -6, 1.6, 1.6); g.fillRect(1, -6, 1.6, 1.6);
  g.fillStyle = '#b08a3a'; g.beginPath(); g.moveTo(9, 0); g.quadraticCurveTo(9, -7, 14, -7); g.quadraticCurveTo(19, -7, 19, 0); g.lineTo(21, 5); g.lineTo(7, 5); g.closePath(); g.fill();
});
// --- Escupidor de bilis (abanicos de veneno)
SPR.escupidor = makeSprite(46, g => {
  g.fillStyle = '#3a4a24'; blob(g, 13, 16, 0.3, 211); g.fill();
  g.fillStyle = '#4e6230'; g.beginPath(); g.ellipse(6, -6, 9, 8, 0, 0, TAU); g.fill();
  g.fillStyle = '#1a2008'; g.beginPath(); g.ellipse(11, -4, 5, 4, 0, 0, TAU); g.fill();
  g.fillStyle = '#9aff6a'; g.beginPath(); g.arc(12, -4, 2, 0, TAU); g.fill();
  g.fillStyle = '#e0d870'; g.beginPath(); g.arc(4, -10, 1.6, 0, TAU); g.arc(9, -11, 1.6, 0, TAU); g.fill();
  g.fillStyle = 'rgba(150,255,100,0.7)'; for (const [x, y] of [[-6, 2], [-2, 6], [-9, -3]]) { g.beginPath(); g.arc(x, y, 1.8, 0, TAU); g.fill(); }
});
// --- Ballestero (disparo lento y letal)
SPR.ballestero = makeSprite(44, g => {
  g.fillStyle = '#3a3428'; g.beginPath(); g.moveTo(-8, -3); g.lineTo(8, -3); g.lineTo(10, 13); g.lineTo(-10, 13); g.closePath(); g.fill();
  g.fillStyle = '#6a6a72'; g.beginPath(); g.arc(0, -9, 6, Math.PI, 0); g.fill(); g.fillRect(-6, -9, 12, 3);
  g.fillStyle = '#a89a86'; g.fillRect(-4, -6, 8, 4);
  g.strokeStyle = '#5a4630'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(2, 2); g.lineTo(18, 2); g.stroke();
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 2; g.beginPath(); g.arc(16, 2, 7, -1.3, 1.3); g.stroke();
});
// --- Escudero con pavés (bloquea balas de frente)
SPR.escudero = makeSprite(50, g => {
  g.fillStyle = '#3a3a42'; g.beginPath(); g.moveTo(-9, -3); g.lineTo(9, -3); g.lineTo(11, 15); g.lineTo(-11, 15); g.closePath(); g.fill();
  g.fillStyle = '#7a7a84'; g.beginPath(); g.arc(0, -9, 6.5, 0, TAU); g.fill();
  g.fillStyle = '#1a1a20'; g.fillRect(-5, -10, 10, 2);
  g.strokeStyle = '#5a4630'; g.lineWidth = 2; g.beginPath(); g.moveTo(-8, 4); g.lineTo(-16, -12); g.stroke();
  g.fillStyle = '#9a9aa6'; g.beginPath(); g.moveTo(-18, -14); g.lineTo(-14, -18); g.lineTo(-12, -12); g.closePath(); g.fill();
});
// --- Fanático de la pólvora (corre y estalla)
SPR.bombero = makeSprite(40, g => {
  g.fillStyle = '#4a2a1e'; g.beginPath(); g.moveTo(-8, 12); g.lineTo(8, 12); g.lineTo(5, -3); g.lineTo(-5, -3); g.closePath(); g.fill();
  g.fillStyle = '#7a6a5c'; g.beginPath(); g.arc(0, -7, 5, 0, TAU); g.fill();
  g.fillStyle = '#ffdd44'; g.fillRect(-3, -8, 2, 2); g.fillRect(1.5, -8, 2, 2);
  g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(0, 4, 6.5, 0, TAU); g.fill();
  g.strokeStyle = '#c9a35a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(3, -1); g.lineTo(7, -6); g.stroke();
  g.fillStyle = '#ff8a2a'; g.beginPath(); g.arc(7.5, -7, 2, 0, TAU); g.fill();
});
// --- Sacerdote de sangre (cura y enfurece a los suyos)
SPR.sacerdote = makeSprite(48, g => {
  g.fillStyle = '#5a1018'; g.beginPath(); g.moveTo(-10, 15); g.lineTo(10, 15); g.lineTo(6, -4); g.lineTo(-6, -4); g.closePath(); g.fill();
  g.fillStyle = '#e8dcc4'; g.fillRect(-1, -3, 2, 16); g.fillRect(-4, 2, 8, 2);
  g.fillStyle = '#c8b8a0'; g.beginPath(); g.arc(0, -8, 5.5, 0, TAU); g.fill();
  g.fillStyle = '#3a0a10'; g.beginPath(); g.moveTo(-7, -9); g.lineTo(0, -20); g.lineTo(7, -9); g.closePath(); g.fill();
  g.strokeStyle = '#8a6a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 14); g.lineTo(13, -14); g.stroke();
  g.fillStyle = '#ff4a5a'; g.beginPath(); g.arc(13, -16, 3, 0, TAU); g.fill();
});
// --- Bestia saltadora (cae sobre vos)
SPR.saltador = makeSprite(56, g => {
  g.strokeStyle = '#2a1a14'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(-8, 4); g.quadraticCurveTo(-18, 2, -16, 14); g.stroke();
  g.beginPath(); g.moveTo(8, 4); g.quadraticCurveTo(18, 2, 16, 14); g.stroke();
  g.fillStyle = '#4a3a2a'; g.beginPath(); g.ellipse(0, 0, 12, 9, 0, 0, TAU); g.fill();
  g.fillStyle = '#5a4634'; g.beginPath(); g.ellipse(9, -6, 8, 6, -0.3, 0, TAU); g.fill();
  g.fillStyle = '#ffd23c'; g.beginPath(); g.arc(12, -8, 1.6, 0, TAU); g.fill();
  g.fillStyle = '#e8dcc4'; g.beginPath(); g.moveTo(14, -3); g.lineTo(15, 0); g.lineTo(16, -3); g.fill();
});

// --- Jefe: el Cazador Caído (forma humana y forma bestial)
SPR.caido = makeSprite(70, g => {
  g.fillStyle = '#2a2420'; g.beginPath(); g.moveTo(-10, -4); g.lineTo(10, -4); g.lineTo(16, 24); g.lineTo(4, 21); g.lineTo(0, 25); g.lineTo(-4, 21); g.lineTo(-16, 24); g.closePath(); g.fill();
  g.fillStyle = '#3e3428'; g.beginPath(); g.moveTo(-11, -5); g.lineTo(11, -5); g.lineTo(8, 3); g.lineTo(-8, 3); g.closePath(); g.fill();
  g.fillStyle = '#c8b8a0'; g.beginPath(); g.arc(0, -12, 6, 0, TAU); g.fill();
  g.fillStyle = '#e8e0d0'; g.fillRect(-6, -14, 12, 3);
  g.fillStyle = '#16121a'; g.beginPath(); g.ellipse(0, -17, 13, 3.5, 0, 0, TAU); g.fill();
  g.fillRect(-6, -25, 12, 8);
  g.strokeStyle = '#5a4630'; g.lineWidth = 3; g.beginPath(); g.moveTo(10, 6); g.lineTo(24, -18); g.stroke();
  g.fillStyle = '#9a9aa6'; g.beginPath(); g.moveTo(20, -14); g.lineTo(30, -16); g.lineTo(30, -28); g.lineTo(22, -24); g.closePath(); g.fill();
  g.fillStyle = '#2a2730'; g.fillRect(-20, 4, 9, 3); g.fillStyle = '#5a4630'; g.fillRect(-13, 5, 3, 5);
});
SPR.caidoBestia = makeSprite(100, g => {
  g.fillStyle = '#3a2c24'; blob(g, 24, 26, 0.45, 91); g.fill();
  g.fillStyle = '#2a2420'; for (const x of [-14, -4, 8]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x - 4, 28); g.lineTo(x + 4, 26); g.closePath(); g.fill(); }
  g.strokeStyle = '#3a2c24'; g.lineWidth = 6; g.beginPath(); g.moveTo(16, 4); g.lineTo(32, 16); g.stroke(); g.beginPath(); g.moveTo(-16, 4); g.lineTo(-30, 18); g.stroke();
  g.strokeStyle = '#e8dcc4'; g.lineWidth = 1.6; for (const [x, y] of [[32, 16], [-30, 18]]) for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + k * 3, y + 7); g.stroke(); }
  g.fillStyle = '#4a382c'; g.beginPath(); g.ellipse(12, -18, 12, 8, -0.3, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(5, -24); g.lineTo(3, -34); g.lineTo(10, -26); g.fill();
  g.fillStyle = '#e8e0d0'; g.beginPath(); g.arc(14, -20, 2, 0, TAU); g.arc(19, -18, 2, 0, TAU); g.fill();
  g.fillStyle = '#16121a'; g.beginPath(); g.ellipse(4, -30, 11, 3, -0.3, 0, TAU); g.fill();
});
// --- Jefe: el Hambre del Matadero
SPR.hambre = makeSprite(96, g => {
  g.strokeStyle = '#3a0e12'; g.lineWidth = 4;
  [[-14, 6, -22, 28], [-4, 8, -6, 30], [8, 8, 10, 30], [16, 4, 24, 26]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
  g.fillStyle = '#4a1418'; g.beginPath(); g.ellipse(0, 2, 22, 11, 0, 0, TAU); g.fill();
  g.fillStyle = '#d8c8b0'; for (let x = -16; x <= 12; x += 5) { g.beginPath(); g.moveTo(x - 2, -6); g.lineTo(x, -18 - (x % 3) * 2); g.lineTo(x + 2, -6); g.fill(); }
  g.fillStyle = '#6a1a20'; g.beginPath(); g.ellipse(22, -4, 11, 7, -0.2, 0, TAU); g.fill();
  g.fillStyle = '#1a0406'; g.beginPath(); g.moveTo(24, -1); g.lineTo(36, 1); g.lineTo(24, 4); g.closePath(); g.fill();
  g.fillStyle = '#ffd23c'; g.beginPath(); g.arc(25, -7, 2, 0, TAU); g.fill();
  g.fillStyle = 'rgba(160,0,20,0.6)'; for (const [x, y] of [[-8, 8], [4, 10], [-14, 4]]) { g.beginPath(); g.arc(x, y, 2.5, 0, TAU); g.fill(); }
});
// --- Jefe: la Penitente de Ceniza
SPR.penitente = makeSprite(150, g => {
  g.strokeStyle = 'rgba(230,200,110,0.55)'; g.lineWidth = 3; g.beginPath(); g.arc(0, -40, 26, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  g.fillStyle = '#b8af9e'; blob(g, 40, 34, 0.35, 141); g.fill();
  g.fillStyle = '#d0c7b6'; blob(g, 30, 28, 0.3, 143); g.fill();
  g.strokeStyle = '#b8af9e'; g.lineWidth = 10;
  g.beginPath(); g.moveTo(26, 0); g.lineTo(48, 34); g.stroke(); g.beginPath(); g.moveTo(-26, 0); g.lineTo(-48, 34); g.stroke();
  g.strokeStyle = '#2a2420'; g.lineWidth = 2; for (const [x, y] of [[48, 34], [-48, 34]]) for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + k * 4, y + 10); g.stroke(); }
  g.fillStyle = '#c8bfae'; g.beginPath(); g.ellipse(0, -32, 16, 13, 0, 0, TAU); g.fill();
  g.fillStyle = '#2a1e18'; g.beginPath(); g.ellipse(0, -28, 9, 7, 0, 0, TAU); g.fill();
  g.fillStyle = '#ffd23c'; g.beginPath(); g.arc(-4, -30, 1.8, 0, TAU); g.arc(4, -30, 1.8, 0, TAU); g.fill();
  g.strokeStyle = '#7a1a26'; g.lineWidth = 3; g.beginPath(); g.moveTo(-20, -10); g.quadraticCurveTo(0, 6, 20, -10); g.stroke();
});
// --- Jefe: la Durmiente del Lago
SPR.durmiente = makeSprite(130, g => {
  g.strokeStyle = '#8a82a0'; g.lineWidth = 2.5;
  for (let i = 0; i < 8; i++) { const s = i < 4 ? 1 : -1, k = i % 4; g.beginPath(); g.moveTo(14 * s, -10 + k * 10); g.quadraticCurveTo(34 * s, -16 + k * 12, 44 * s, 4 + k * 12); g.stroke(); }
  for (let i = 3; i >= 0; i--) { g.fillStyle = i % 2 ? '#a8a0bc' : '#bcb4d0'; g.beginPath(); g.ellipse(0, -10 + i * 14, 24 - i * 2, 12, 0, 0, TAU); g.fill(); }
  g.fillStyle = '#9ad8ff'; for (const [x, y, h] of [[-12, -18, 14], [0, -24, 18], [12, -16, 13], [-6, -2, 10], [8, 4, 9]]) { g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x, y - h); g.lineTo(x + 4, y); g.closePath(); g.fill(); }
  g.fillStyle = '#d0c8e0'; g.beginPath(); g.arc(0, -36, 8, 0, TAU); g.fill();
  g.fillStyle = '#2a1a3a'; for (const [x, y] of [[-3, -37], [3, -37], [0, -33], [-5, -33], [5, -33]]) { g.beginPath(); g.arc(x, y, 1.3, 0, TAU); g.fill(); }
});
// --- Jefe: el Señor del Eclipse
SPR.eclipse = makeSprite(130, g => {
  g.strokeStyle = '#c21f35'; g.lineWidth = 4; g.beginPath(); g.arc(0, -30, 34, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(10,4,12,0.9)'; g.beginPath(); g.arc(0, -30, 30, 0, TAU); g.fill();
  g.strokeStyle = '#1a0a1e'; g.lineWidth = 5;
  for (let i = 0; i < 10; i++) { const a = Math.PI * 0.15 + (i / 9) * Math.PI * 0.7; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(Math.cos(a) * 20, 10 + Math.sin(a) * 20, Math.cos(a) * 34 + (i % 2 ? 6 : -6), 30, Math.cos(a) * 44, 48); g.stroke(); }
  g.fillStyle = '#120812'; g.beginPath(); g.moveTo(-14, -14); g.lineTo(14, -14); g.lineTo(10, 18); g.lineTo(-10, 18); g.closePath(); g.fill();
  g.fillStyle = '#1e101e'; g.beginPath(); g.ellipse(0, -22, 9, 11, 0, 0, TAU); g.fill();
  g.strokeStyle = '#ff2a3c'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, -23, 4, 0, TAU); g.stroke();
});

// --- Acechador del velo (invisible sin Lucidez suficiente)
SPR.acechante = makeSprite(64, g => {
  g.strokeStyle = '#cfc6d8'; g.lineWidth = 1.6;
  for (let i = 0; i < 6; i++) {
    const s = i < 3 ? 1 : -1, k = i % 3;
    g.beginPath(); g.moveTo(4 * s, -4 + k * 6);
    g.quadraticCurveTo((16 + k * 3) * s, -14 + k * 8, (24 + k * 2) * s, 6 + k * 8); g.stroke();
  }
  g.fillStyle = '#9a90a8'; g.beginPath(); g.ellipse(0, 0, 9, 16, 0, 0, TAU); g.fill();
  g.fillStyle = '#b8aec6'; g.beginPath(); g.ellipse(0, -16, 8, 9, 0, 0, TAU); g.fill();
  for (const [x, y, r] of [[-3, -18, 2], [3, -18, 2], [0, -13, 1.6], [-5, -12, 1.2], [5, -12, 1.2], [0, -22, 1.4]]) {
    g.fillStyle = '#2a0f3a'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = '#e0b0ff'; g.beginPath(); g.arc(x, y, r * 0.4, 0, TAU); g.fill();
  }
  g.strokeStyle = '#6a5a7a'; g.lineWidth = 1;
  for (let y = -6; y <= 10; y += 4) { g.beginPath(); g.moveTo(-7, y); g.lineTo(7, y); g.stroke(); }
});

// ================================================================ Enemigos animados por cuadros
// Cada figura se dibuja en función de la fase del paso (ph, de 0 a 1) y de si está atacando (atk).
// Se generan 4 cuadros de caminata (tipo_0..3) y una pose de ataque (tipo_w).
const rag = (g, x0, x1, y, sway, teeth = 3) => { // borde deshilachado de una tela
  for (let x = x1; x > x0; x -= teeth) g.lineTo(x + sway * (x / x1) * 0.5 - teeth / 2, y + ((Math.round(x) % 2) ? 2 : -0.5));
};
// ---------------------------------------------------------------- Cazador en alta definición
// Figura de ~74 px de alto en una grilla de 80: tela por capas, correas, hebillas, brazales y tramado.
const HD_PAL = [
  '#07040a', '#100c12', '#1a161c', '#252028', '#322c34', '#423a42', '#554c52', '#6c6268', '#8a8086', '#aaa0a2', '#cfc6c0', '#ece4d8',
  '#1a1e26', '#2a3038', '#3c4450', '#56606c', '#74808c', '#9aa6b0',
  '#1e140e', '#2e2016', '#44301e', '#5c4228', '#7a5a38', '#9a7650', '#bc9a70',
  '#3a2810', '#5e4218', '#8a6424', '#b08a3a', '#d4b05a', '#f0d890', '#fff4c8',
  '#2a080c', '#4e1018', '#7a1a22', '#a8282c', '#d4483c', '#ff8a7a',
  '#6a4a3a', '#9a7460', '#c8a488', '#e8ccb0',
  '#8a8478', '#aaa496', '#c8c2b4', '#e2dccd', '#f6f0e2',
  '#4a4e5a', '#6e7480', '#9aa0ac', '#c8ccd6', '#eef0f6',
  '#1c1028', '#2e1a40', '#4a2a66', '#6a3a8a', '#9a6ad8', '#c9a0ff',
  '#ff9a3c', '#ffd27a',
  '#141e0e', '#24361a', '#3a5428', '#5a7a38', '#86a850', '#b4d47a', '#e2f4b0', '#1e3a3a', '#3a6a6a',
].map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

// materiales de cada atuendo: [luz, medio, sombra]
const HD_STYLE = {
  viaje:  { coat: ['#8a6a48', '#5e4630', '#30221a'], hem: 14, open: true, vest: ['#6a4630', '#3a2618'], shirt: '#c8b8a0', pants: ['#6a5a48', '#3a3026'], boot: ['#5a4430', '#2a1e14'], bootTop: 25, metal: ['#f0d890', '#b08a3a', '#5e4218'], scarf: ['#a8382c', '#5a1418'], glove: ['#7a5a3a', '#3a2818'], hat: 'cap', capelet: 0, bracer: 'cuero', belts: 'bandolera' },
  sereno: { coat: ['#7a8694', '#4e5864', '#1e232a'], hem: 30, open: false, vest: ['#3a3e46', '#1e2026'], shirt: '#9aa0a8', pants: ['#44464e', '#1e2026'], boot: ['#363040', '#100c14'], bootTop: 21, metal: ['#f0d890', '#b08a3a', '#5e4218'], scarf: ['#3a3640', '#141218'], glove: ['#2a262e', '#0e0c10'], hat: 'ala', capelet: 2, bracer: null, belts: 'cinto' },
  gaban:  { coat: ['#7e7c88', '#46444c', '#141216'], hem: 32, open: true, vest: ['#5a4030', '#2a1c12'], shirt: '#ece4d8', pants: ['#4e4438', '#221c16'], boot: ['#3a3036', '#0e0c10'], bootTop: 19, metal: ['#fff4c8', '#d4b05a', '#5e4218'], scarf: ['#2a2830', '#0e0c10'], glove: ['#4a382a', '#1e140e'], hat: 'copa', capelet: 1, bracer: 'oro', belts: 'hebillas' },
  habito: { coat: ['#f6f0e2', '#c8c2b4', '#7a7468'], hem: 35, open: false, vest: ['#3a3040', '#1a141e'], shirt: '#e2dccd', pants: ['#a8a294', '#6a645a'], boot: ['#c8c2b4', '#7a7468'], bootTop: 31, metal: ['#f0d890', '#b08a3a', '#5e4218'], scarf: ['#e2dccd', '#8a8478'], glove: ['#e8ccb0', '#9a7460'], hat: 'capucha', capelet: 0, bracer: null, belts: 'cordon' },
  vigia:  { coat: ['#a4a8b4', '#626670', '#24262c'], hem: 12, open: false, vest: ['#4a4e5a', '#24262c'], shirt: '#6e7480', pants: ['#4e505a', '#1e2026'], boot: ['#a4a8b4', '#3a3c44'], bootTop: 20, metal: ['#eef0f6', '#9aa0ac', '#4a4e5a'], scarf: ['#4a4e5a', '#1a1c20'], glove: ['#8a8e98', '#30323a'], hat: 'yelmo', capelet: 0, bracer: 'hierro', belts: 'cinto', cape: 'carmesi' },
  velo:   { coat: ['#3a3048', '#1e1828', '#08060c'], hem: 35, open: false, vest: ['#4a2a66', '#1c1028'], shirt: '#2e1a40', pants: ['#221a2a', '#0a080e'], boot: ['#2e2636', '#0a080e'], bootTop: 23, metal: ['#eef0f6', '#9aa0ac', '#4a4e5a'], scarf: ['#1e1828', '#08060c'], glove: ['#1e1828', '#08060c'], hat: 'punta', capelet: 0, bracer: null, belts: 'cinto', cape: 'plumas' },
};

const hdLin = (g, x0, y0, x1, y1, cols) => { const gr = g.createLinearGradient(x0, y0, x1, y1); cols.forEach((c, i) => gr.addColorStop(i / (cols.length - 1), c)); return gr; };
const hdPoly = (g, pts, fill, ol) => { if (ol) { g.strokeStyle = 'rgba(7,4,10,0.9)'; g.lineWidth = ol; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.stroke(); } g.fillStyle = fill; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill(); };
const hdLimb = (g, pts, col, w) => { hdLine(g, pts, 'rgba(7,4,10,0.9)', w + 1.3); hdLine(g, pts, col, w); };
const hdLine = (g, pts, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); };
// hebilla: marco de metal con pasador
function hdBuckle(g, x, y, M, s = 1) {
  g.fillStyle = M[2]; g.fillRect(x - 1.8 * s, y - 1.5 * s, 3.6 * s, 3 * s);
  g.fillStyle = M[1]; g.fillRect(x - 1.5 * s, y - 1.2 * s, 3 * s, 2.4 * s);
  g.fillStyle = '#1a120c'; g.fillRect(x - 0.8 * s, y - 0.6 * s, 1.6 * s, 1.2 * s);
  g.fillStyle = M[0]; g.fillRect(x - 1.5 * s, y - 1.2 * s, 3 * s, 0.6 * s);
}
// codo por cinemática inversa: dos segmentos de largo a y b, el codo cae hacia abajo
function hdElbow(sx, sy, hx, hy, a = 9.5, b = 9.5) {
  const dx = hx - sx, dy = hy - sy, d = Math.max(0.01, Math.hypot(dx, dy)), dd = Math.min(d, a + b - 0.01);
  const x = (a * a - b * b + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, a * a - x * x));
  const ux = dx / d, uy = dy / d;
  let ex = sx + ux * x - uy * h, ey = sy + uy * x + ux * h;
  const ex2 = sx + ux * x + uy * h, ey2 = sy + uy * x - ux * h;
  if (ey2 > ey) { ex = ex2; ey = ey2; }
  return [ex, ey];
}

// --- capa trasera (por detrás de todo)
function hdCape(g, id, sw) {
  const S = HD_STYLE[id];
  if (S.cape === 'carmesi') {
    const pts = [[-9, -20], [8, -20], [13 + sw, 30]];
    for (let x = 13; x >= -15; x -= 2.4) pts.push([x + sw * ((x + 15) / 28), 30 + ((Math.round(x * 3) % 4) ? 3 : -2) + (x % 5 === 0 ? 2 : 0)]);
    pts.push([-15 + sw * 0.2, 28]);
    hdPoly(g, pts, hdLin(g, -14, -20, 12, 30, ['#a8282c', '#7a1a22', '#2a080c']));
    for (const x of [-9, -4, 2, 7]) hdLine(g, [[x * 0.5, -16], [x + sw * 0.6, 30]], 'rgba(20,4,8,0.55)', 1);
    for (const x of [-7, -1, 5]) hdLine(g, [[x * 0.5, -16], [x + 1 + sw * 0.6, 28]], 'rgba(255,120,110,0.25)', 0.7);
  } else if (S.cape === 'plumas') {
    hdPoly(g, [[-11, -22], [10, -22], [19 + sw, 34], [-19 + sw, 34]], hdLin(g, -18, -20, 18, 34, ['#2e2636', '#120e18', '#050308']));
    for (let i = -18; i <= 18; i += 1.6) {
      const tip = 34 + ((i * 13) % 4);
      hdLine(g, [[i * 0.45, -18], [i + sw, tip]], i % 3.2 < 1.6 ? '#3a3048' : '#08060c', 0.9);
    }
  }
}

// --- faldón trasero del abrigo (detrás de las piernas)
function hdCoatBack(g, id, sw) {
  const S = HD_STYLE[id], L = S.hem;
  if (L < 16) return;
  const pts = [[-7, 0], [6, 0], [10 + sw, L]];
  for (let x = 10; x >= -12; x -= 2.2) pts.push([x + sw * ((x + 12) / 22), L + ((Math.round(x * 2) % 3) ? 1 : -0.6)]);
  hdPoly(g, pts, hdLin(g, -10, 0, 10, L, [S.coat[1], S.coat[2]]));
  hdLine(g, [[-2, 2], [-3 + sw, L]], 'rgba(0,0,0,0.35)', 1);
}

// --- piernas: muslo, rodilla, caña y bota con correas
function hdLeg(g, S, hipX, footX, lift, dark) {
  const hip = [hipX, 5], ank = [footX, 33 - lift];
  const knee = [(hip[0] + ank[0]) / 2 + 1.6, 20 - lift * 0.6];
  const P = dark ? [S.pants[1], S.pants[1]] : S.pants, B = dark ? [S.boot[1], S.boot[1]] : S.boot;
  g.lineCap = 'round';
  hdLimb(g, [hip, knee], hdLin(g, hip[0] - 3, 0, hip[0] + 3, 0, [P[0], P[1]]), 6.4);
  hdLimb(g, [knee, ank], hdLin(g, knee[0] - 3, 0, knee[0] + 3, 0, [P[0], P[1]]), 5.4);
  if (!dark) { hdLine(g, [[knee[0] - 2, knee[1] - 1], [knee[0] + 1, knee[1] + 1]], 'rgba(0,0,0,0.4)', 0.8); hdLine(g, [[hip[0] - 1.5, hip[1] + 3], [knee[0] - 1.8, knee[1] - 2]], 'rgba(255,255,255,0.12)', 0.8); }
  // caña de la bota desde bootTop hasta el tobillo
  const t = clamp((S.bootTop - knee[1]) / Math.max(1, ank[1] - knee[1]), -0.3, 1);
  const top = t < 0 ? [hip[0] + (knee[0] - hip[0]) * (1 + t), knee[1] + (knee[1] - hip[1]) * t] : [knee[0] + (ank[0] - knee[0]) * t, knee[1] + (ank[1] - knee[1]) * t];
  hdLimb(g, [top, ank], hdLin(g, top[0] - 3, 0, top[0] + 3.5, 0, [B[0], B[1]]), 6.2);
  // pie con puntera hacia adelante, tacón y suela
  hdPoly(g, [[ank[0] - 3.2, ank[1] - 1.5], [ank[0] + 2, ank[1] - 1], [ank[0] + 6.5, ank[1] + 1.2], [ank[0] + 6.8, ank[1] + 3], [ank[0] - 3.4, ank[1] + 3]], B[1]);
  hdPoly(g, [[ank[0] - 2.6, ank[1] - 1.2], [ank[0] + 2, ank[1] - 0.8], [ank[0] + 5.5, ank[1] + 1]], B[0]);
  g.fillStyle = '#07040a'; g.fillRect(ank[0] - 3.4, ank[1] + 2.6, 10.2, 1);
  if (dark) return;
  // vuelta de la bota y correas con hebilla
  hdLine(g, [[top[0] - 3.4, top[1]], [top[0] + 3.4, top[1] + 0.4]], B[0], 1.6);
  const mid = [top[0] + (ank[0] - top[0]) * 0.55, top[1] + (ank[1] - top[1]) * 0.55];
  hdLine(g, [[mid[0] - 3, mid[1]], [mid[0] + 3, mid[1] + 0.6]], '#1e140e', 1.2);
  hdBuckle(g, mid[0] + 1.6, mid[1] + 0.3, S.metal, 0.7);
  hdLine(g, [[ank[0] - 3, ank[1] - 1.8], [ank[0] + 2.6, ank[1] - 1.2]], '#1e140e', 1);
  hdLine(g, [[top[0] - 1.6, top[1] + 1], [ank[0] - 1.8, ank[1] - 2.5]], 'rgba(255,255,255,0.16)', 0.7);
  if (S.bracer === 'hierro') { hdLine(g, [[knee[0] - 2.8, knee[1]], [knee[0] + 2.8, knee[1]]], S.metal[1], 3); g.fillStyle = S.metal[0]; g.fillRect(knee[0] - 2.4, knee[1] - 1.4, 4.8, 0.8); }
}
function hdLegs(g, id, k, lf, lb) {
  const S = HD_STYLE[id];
  hdLeg(g, S, -2, -1.5 - k * 6.5, lb, true);
  hdLeg(g, S, 2, 2.5 + k * 6.5, lf, false);
}

// --- torso: chaleco, abrigo, correas, cuello y esclavina
function hdTorso(g, id, sw) {
  const S = HD_STYLE[id], L = S.hem, C = S.coat, M = S.metal;
  // camisa y chaleco
  hdPoly(g, [[-6, -19], [7, -19], [6, 4], [-5, 4]], hdLin(g, -6, -19, 6, 4, [S.vest[0], S.vest[1]]));
  // abrigo: panel trasero (lado lejano) y delantero (lado cercano)
  const skirt = Math.min(L, 40);
  const back = [[-9, -19], [-3, -18], [-3, 3], [(S.open ? -7.5 : -5.5) + sw * 0.4, skirt - 1], [-11 + sw, skirt], [-10, 4], [-8.5, -6]];
  hdPoly(g, back, hdLin(g, -11, -18, -2, skirt, [C[1], C[2]]), 1);
  const fx = S.open ? 3 : -1;
  const front = [[9, -19], [fx, -18], [fx - 0.5, 3], [fx + (S.open ? 6.5 : 1) + sw * 0.5, skirt - 1.5], [11 + sw, skirt], [9, 4], [8.5, -6]];
  hdPoly(g, front, hdLin(g, -2, -19, 12, skirt, [C[0], C[1], C[2]]), 1);
  if (!S.open) {
    // abrigo cerrado: el panel delantero cubre el pecho
    hdPoly(g, [[-3, -18], [fx + 4, -18], [fx + 4, 4], [-3, 4]], hdLin(g, -3, -18, 4, 4, [C[0], C[1]]));
  }
  // pliegues del faldón
  for (const [x, a] of [[-7, 0.4], [-4.5, 0.5], [6, 0.45], [8.5, 0.35]]) hdLine(g, [[x * 0.7, 5], [x + sw * 0.8, skirt - 1]], `rgba(0,0,0,${a})`, 0.9);
  for (const x of [-6, 7]) hdLine(g, [[x * 0.7 + 0.8, 6], [x + 1 + sw * 0.8, skirt - 2]], 'rgba(255,255,255,0.13)', 0.7);
  // dobladillo deshilachado
  g.fillStyle = C[2];
  for (let x = -11; x <= 11; x += 1.6) if ((Math.round(x * 5) % 3) === 0) g.fillRect(x + sw * ((x + 11) / 22), skirt - 0.4, 1, 1.4);

  if (S.open) {
    // camisa blanca y chorrera
    hdPoly(g, [[-1.5, -19], [2.5, -19], [1.8, -12], [-0.8, -12]], S.shirt);
    hdLine(g, [[0.5, -18.5], [0.5, -13]], 'rgba(0,0,0,0.2)', 0.6);
    // solapas
    hdPoly(g, [[-3, -18], [-0.5, -18.5], [-1.5, -9], [-3.5, -11]], C[2]);
    hdPoly(g, [[3, -18], [5.5, -18.5], [5, -10], [3.4, -9]], C[0]);
  } else {
    // botonadura
    for (let y = -15; y <= 2; y += 3.4) { g.fillStyle = M[2]; g.fillRect(fx + 0.6, y, 1.6, 1.6); g.fillStyle = M[0]; g.fillRect(fx + 0.6, y, 0.8, 0.8); }
    hdLine(g, [[fx, -18], [fx - 0.4, 4], [fx + 0.6 + sw * 0.5, skirt - 2]], 'rgba(0,0,0,0.45)', 0.7);
  }
  // correas
  if (S.belts === 'hebillas') {
    for (const y of [-13, -8.5, -4, 0.5]) { hdLine(g, [[-2.5, y], [3.2, y]], '#1a120c', 1.6); hdBuckle(g, 0.4, y, M, 0.85); }
    hdLine(g, [[-7, -19], [9, 4]], '#2a1a10', 2); hdLine(g, [[-6.5, -19.6], [9.4, 3.4]], 'rgba(255,220,170,0.18)', 0.5);
    hdBuckle(g, 3.6, -4.8, M, 0.9);
    // cadena del reloj
    g.strokeStyle = M[1]; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-2.5, -1); g.quadraticCurveTo(-5, 4, -4.5, 8); g.stroke();
    g.fillStyle = M[0]; g.beginPath(); g.arc(-4.5, 9, 1.2, 0, TAU); g.fill(); g.fillStyle = M[2]; g.fillRect(-4.9, 8.6, 0.8, 0.8);
  } else if (S.belts === 'bandolera') {
    hdLine(g, [[-7, -19], [8, 4]], '#3a2616', 2.4);
    for (let i = 0; i < 4; i++) { const x = -4.5 + i * 3.4, y = -15 + i * 5.2; g.fillStyle = '#c9ccd8'; g.fillRect(x, y - 1.6, 1.4, 2.4); g.fillStyle = M[1]; g.fillRect(x, y + 0.6, 1.4, 0.8); }
  } else if (S.belts === 'cordon') {
    hdPoly(g, [[-1.5, -19], [1.5, -19], [1.2, 30], [-1.2, 30]], hdLin(g, -1.5, 0, 1.5, 0, [S.vest[0], S.vest[1]]));
    g.fillStyle = M[1]; g.fillRect(-1, -6, 2, 5); g.fillRect(-2.4, -4.6, 4.8, 1.6); g.fillStyle = M[0]; g.fillRect(-1, -6, 1, 1);
    hdLine(g, [[-7, 3], [7, 3]], '#8a7a5a', 1.6); hdLine(g, [[-7, 2.6], [7, 2.6]], '#c8b890', 0.5);
    hdLine(g, [[5, 3], [6, 9], [5.6, 14]], '#8a7a5a', 1.2);
    for (let i = 0; i < 6; i++) { g.fillStyle = '#5a4630'; g.beginPath(); g.arc(-4 + Math.sin(i) * 0.8, 5 + i * 1.6, 0.7, 0, TAU); g.fill(); }
  }
  if (S.belts !== 'cordon') {
    hdLine(g, [[-7, 3.2], [8, 3.2]], '#1e140e', 2.2); hdLine(g, [[-7, 2.4], [8, 2.4]], 'rgba(255,220,170,0.15)', 0.5);
    hdBuckle(g, 1.5, 3.2, M, 0.9);
  }
  // escamas de hierro del vigía
  if (id === 'vigia') {
    for (let r = 0; r < 7; r++) for (let c = -3; c <= 3; c++) {
      const x = c * 2.4 + (r % 2 ? 1.2 : 0), y = -17 + r * 2.8;
      g.fillStyle = r % 2 ? M[1] : '#7a7e88'; g.beginPath(); g.arc(x, y, 1.5, 0, Math.PI); g.fill();
      g.fillStyle = M[0]; g.fillRect(x - 0.8, y, 0.8, 0.5);
    }
  }
  if (id === 'velo') {
    g.strokeStyle = '#c8ccd6'; g.lineWidth = 0.6;
    for (const y of [-14, -9, -4]) { g.beginPath(); g.moveTo(-5, y); g.quadraticCurveTo(0, y + 4, 6, y); g.stroke(); }
    g.fillStyle = '#eef0f6'; g.fillRect(0, -2, 1.2, 1.2); g.fillRect(-3, -11, 0.8, 0.8); g.fillRect(4, -7, 0.8, 0.8);
  }
  // cuello alto levantado
  hdPoly(g, [[-6, -19], [-3.5, -25], [-1, -20]], C[2]);
  hdPoly(g, [[7, -19], [5, -25.5], [2.5, -20]], C[0]);
}

// esclavina por encima de los hombros (1 o 2 niveles)
function hdCapelet(g, id, sw) {
  const S = HD_STYLE[id], C = S.coat;
  if (!S.capelet) return;
  const tier = (top, bot, w, cols) => {
    const pts = [[-w * 0.7, top], [w * 0.75, top], [w + 1 + sw * 0.3, bot - 1]];
    for (let x = w; x >= -w - 1; x -= 2) pts.push([x + sw * 0.3, bot + ((Math.round(x) % 4 === 0) ? 1.2 : 0)]);
    pts.push([-w - 1, bot - 1]);
    hdPoly(g, pts, hdLin(g, -w, top, w, bot, cols), 1);
    for (const x of [-w * 0.6, -w * 0.15, w * 0.35, w * 0.75]) hdLine(g, [[x * 0.6, top + 2], [x + sw * 0.3, bot]], 'rgba(0,0,0,0.38)', 0.8);
    hdLine(g, [[-w * 0.5, top + 1.5], [-w * 0.8, bot - 1]], 'rgba(255,255,255,0.14)', 0.7);
  };
  tier(-21, -8, 11, [C[0], C[1], C[2]]);
  if (S.capelet > 1) tier(-21.5, -13.5, 9.5, [C[0], C[1]]);
  // broche
  g.fillStyle = S.metal[2]; g.beginPath(); g.arc(1, -20, 1.5, 0, TAU); g.fill();
  g.fillStyle = S.metal[0]; g.beginPath(); g.arc(0.7, -20.3, 0.8, 0, TAU); g.fill();
}

// --- brazo con manga, puño, brazal y guante
function hdArm(g, id, sx, sy, hx, hy, dark) {
  const S = HD_STYLE[id], C = S.coat, [ex, ey] = hdElbow(sx, sy, hx, hy);
  const sl = dark ? [C[2], C[2]] : [C[0], C[2]];
  g.lineCap = 'round';
  hdLimb(g, [[sx, sy], [ex, ey]], hdLin(g, sx - 3, sy, sx + 3, sy + 4, sl), id === 'habito' ? 6.2 : 5);
  hdLimb(g, [[ex, ey], [hx, hy]], hdLin(g, ex - 3, ey, ex + 3, ey + 4, sl), id === 'habito' ? 5.6 : 4.4);
  if (!dark) {
    hdLine(g, [[ex - 1.4, ey - 0.4], [ex + 1, ey + 1.2]], 'rgba(0,0,0,0.45)', 0.7);
    hdLine(g, [[sx - 1, sy + 1], [ex - 1.2, ey - 1]], 'rgba(255,255,255,0.15)', 0.7);
  }
  const fx = (t) => [ex + (hx - ex) * t, ey + (hy - ey) * t];
  if (S.bracer === 'oro' || S.bracer === 'hierro' || S.bracer === 'cuero') {
    const [ax, ay] = fx(0.35), [bx, by] = fx(0.88);
    const M = S.bracer === 'cuero' ? ['#9a7650', '#5c4228', '#2e2016'] : S.metal;
    hdLine(g, [[ax, ay], [bx, by]], dark ? M[2] : M[1], 5.2);
    if (!dark) {
      hdLine(g, [[ax - 0.8, ay - 1.2], [bx - 0.8, by - 1.2]], M[0], 0.9);
      hdLine(g, [[ax + 0.9, ay + 1.4], [bx + 0.9, by + 1.4]], M[2], 0.9);
      if (S.bracer === 'oro') {
        // filigrana grabada
        for (let t = 0.15; t < 0.95; t += 0.22) { const qx = ax + (bx - ax) * t, qy = ay + (by - ay) * t; g.fillStyle = M[2]; g.fillRect(qx - 0.5, qy - 0.5, 1, 1); g.fillStyle = M[0]; g.fillRect(qx + 0.6, qy - 1.2, 0.7, 0.7); }
        hdLine(g, [[ax, ay], [bx, by]], 'rgba(90,60,20,0.5)', 0.5);
      }
      g.fillStyle = M[2]; g.fillRect(ax - 2.6, ay - 0.4, 0.8, 0.8); g.fillRect(bx + 1.6, by - 0.4, 0.8, 0.8);
    }
  } else if (!dark) {
    const [cx, cy] = fx(0.8); hdLine(g, [[cx - 2.4, cy - 0.8], [cx + 2.2, cy + 0.8]], C[2], 1.5);
  }
  // guante con dedos
  const G2 = S.glove;
  g.fillStyle = dark ? G2[1] : G2[1]; g.beginPath(); g.arc(hx, hy, 2.4, 0, TAU); g.fill();
  if (!dark) { g.fillStyle = G2[0]; g.beginPath(); g.arc(hx - 0.6, hy - 0.7, 1.3, 0, TAU); g.fill(); g.fillStyle = G2[1]; g.fillRect(hx + 0.8, hy - 1.2, 1.6, 2.6); }
}

// estoque largo con guarda dorada, vaceo y filo brillante
function hdBlade(g, hx, hy, ba, M) {
  const c = Math.cos(ba), s = Math.sin(ba), L = 23;
  const tx = hx + c * L, ty = hy + s * L, nx = -s, ny = c;
  hdLine(g, [[hx - c * 3, hy - s * 3], [hx, hy]], '#3a2616', 1.8);
  g.fillStyle = M[1]; g.beginPath(); g.arc(hx - c * 3.6, hy - s * 3.6, 1.1, 0, TAU); g.fill();
  hdPoly(g, [[hx + nx * 1.4, hy + ny * 1.4], [tx + nx * 0.3, ty + ny * 0.3], [tx + c * 2, ty + s * 2], [tx - nx * 0.3, ty - ny * 0.3], [hx - nx * 1.4, hy - ny * 1.4]], '#9aa0ac');
  hdLine(g, [[hx + c * 2 + nx * 0.7, hy + s * 2 + ny * 0.7], [tx + nx * 0.2, ty + ny * 0.2]], '#eef0f6', 0.6);
  hdLine(g, [[hx + c * 2, hy + s * 2], [tx - c * 2, ty - s * 2]], '#4a4e5a', 0.4);
  hdLine(g, [[hx + nx * 3.2, hy + ny * 3.2], [hx - nx * 3.2, hy - ny * 3.2]], M[1], 1.6);
  g.fillStyle = M[0]; g.fillRect(hx + nx * 3.2 - 0.5, hy + ny * 3.2 - 0.5, 1, 1);
}
// pistola de chispa
function hdPistol(g, hx, hy, ang, M) {
  g.save(); g.translate(hx, hy); g.rotate(ang);
  g.fillStyle = '#3a2616'; g.beginPath(); g.moveTo(-1, -1); g.lineTo(2, -1.4); g.lineTo(1.5, 1); g.lineTo(-1.6, 4.2); g.lineTo(-3.2, 3.4); g.closePath(); g.fill();
  g.fillStyle = '#4a4e5a'; g.fillRect(1, -2.2, 10, 2);
  g.fillStyle = '#c8ccd6'; g.fillRect(1.5, -2.2, 9, 0.6);
  g.fillStyle = M[1]; g.fillRect(0.5, -2.6, 2, 3); g.fillRect(10, -2.4, 1, 2.4);
  g.fillStyle = '#1a161c'; g.fillRect(0, -3.4, 1.4, 1.2);
  g.restore();
}

// --- cabeza y sombreros
function hdHead(g, id) {
  const S = HD_STYLE[id], M = S.metal;
  const hy = -28;
  if (S.headFn) return S.headFn(g, S);
  if (S.hat === 'capucha') {
    hdPoly(g, [[-9, -19], [-9.5, -30], [-5, -37], [2, -38.5], [7.5, -34], [9, -24], [7, -19]], hdLin(g, -9, -38, 9, -19, S.hood || ['#f6f0e2', '#c8c2b4', '#8a8478']), S.hood ? 1 : 0);
    g.fillStyle = '#100c12'; g.beginPath(); g.ellipse(1.6, -28, 4.6, 6, 0.1, 0, TAU); g.fill();
    g.fillStyle = S.eye || '#ffd27a'; g.fillRect(0.4, -29, 1, 0.8); g.fillRect(3, -29, 1, 0.8);
    hdLine(g, [[-6, -34], [1, -37], [6.5, -33]], 'rgba(255,255,255,0.4)', 0.7);
    hdLine(g, [[-7, -22], [-6.8, -30]], 'rgba(0,0,0,0.25)', 0.8);
    return;
  }
  if (S.hat === 'yelmo') {
    g.fillStyle = '#cfc6c0'; g.fillRect(-7, -27, 3, 8);
    hdPoly(g, [[-6, -20], [-6.8, -31], [-3, -36], [3, -36.5], [7, -32], [7, -20]], hdLin(g, -7, -36, 7, -20, ['#eef0f6', '#9aa0ac', '#4a4e5a']));
    g.fillStyle = '#07040a'; g.fillRect(-1, -30, 8, 1.4); g.fillRect(2.5, -28.4, 1, 4);
    g.fillStyle = '#eef0f6'; for (const [x, y] of [[-4, -22], [-4, -26], [5.5, -22]]) g.fillRect(x, y, 0.8, 0.8);
    hdPoly(g, [[-1, -36.5], [1, -36.5], [0.5, -40], [-0.5, -40]], M[1]);
    hdLine(g, [[-5.5, -32], [-2, -35.5]], 'rgba(255,255,255,0.5)', 0.7);
    return;
  }
  if (S.hat === 'punta') {
    hdPoly(g, [[-9, -19], [-8, -32], [-3, -38], [-7, -40], [3, -39], [8, -31], [9, -19]], hdLin(g, -9, -40, 9, -19, ['#3a3048', '#1e1828', '#050308']));
    g.fillStyle = '#1c1028'; g.beginPath(); g.ellipse(1.6, -27.5, 4.4, 5.8, 0.1, 0, TAU); g.fill();
    g.fillStyle = '#eef0f6'; for (const [x, y] of [[-0.5, -30], [3, -31], [1.5, -26], [-0.5, -24], [3.5, -25]]) g.fillRect(x, y, 0.7, 0.7);
    g.fillStyle = '#c9a0ff'; g.fillRect(0, -29, 1.2, 0.8); g.fillRect(2.8, -29, 1.2, 0.8);
    hdLine(g, [[-7, -32], [-3, -37.5]], 'rgba(200,180,255,0.25)', 0.7);
    return;
  }
  // cabello por detrás, rostro, máscara de tela
  g.fillStyle = '#2a1e18'; g.beginPath(); g.ellipse(-2.4, hy + 1, 3.6, 4.6, 0, 0, TAU); g.fill();
  g.fillStyle = '#c8a488'; g.beginPath(); g.ellipse(1.2, hy, 4.4, 5.2, 0, 0, TAU); g.fill();
  g.fillStyle = '#e8ccb0'; g.fillRect(2, hy - 3.5, 2.6, 2.4);
  // sombra de los ojos bajo el ala y el brillo de la mirada
  g.fillStyle = '#3a2620'; g.fillRect(-1.5, hy - 2, 7, 1.8);
  g.fillStyle = '#f6f0e2'; g.fillRect(3.2, hy - 1.6, 1.2, 0.9); g.fillRect(0.4, hy - 1.6, 1, 0.9);
  // máscara: tela que cubre nariz y boca, con pliegues
  hdPoly(g, [[-3, hy - 0.5], [6, hy - 0.8], [6.2, hy + 3.2], [4, hy + 6], [-3.2, hy + 6]], hdLin(g, -3, hy, 6, hy + 6, [S.scarf[0], S.scarf[1]]));
  hdLine(g, [[-1, hy + 1.6], [5, hy + 1.2]], 'rgba(0,0,0,0.35)', 0.6);
  hdLine(g, [[-1, hy + 3.6], [4.6, hy + 3.4]], 'rgba(0,0,0,0.35)', 0.6);
  if (S.hat === 'cap') {
    hdPoly(g, [[-5.5, hy - 3], [-4.5, hy - 7.5], [1, hy - 9], [5.5, hy - 7], [6, hy - 3.6]], hdLin(g, -5, hy - 9, 6, hy - 3, ['#5c4228', '#2e2016']));
    hdPoly(g, [[3, hy - 4.2], [10.5, hy - 3.2], [9.5, hy - 2.2], [3, hy - 2.8]], '#1e140e');
    hdLine(g, [[-3.5, hy - 7], [2, hy - 8.4]], 'rgba(255,255,255,0.2)', 0.7);
  } else if (S.hat === 'ala') {
    g.fillStyle = '#100c12'; g.beginPath(); g.ellipse(0.8, hy - 4, 13, 3, -0.06, 0, TAU); g.fill();
    g.fillStyle = '#2a3038'; g.beginPath(); g.ellipse(0.8, hy - 4.6, 12.6, 2.2, -0.06, Math.PI, 0); g.fill();
    hdPoly(g, [[-5.5, hy - 5], [-4.8, hy - 10.5], [0.5, hy - 12.5], [5.8, hy - 10.5], [6.4, hy - 5]], hdLin(g, -5, hy - 12, 6, hy - 5, ['#3c4450', '#1a1e26']));
    hdLine(g, [[-5.5, hy - 6.4], [6.4, hy - 6.4]], '#56606c', 1.4);
    hdLine(g, [[-10, hy - 5], [-3, hy - 6]], 'rgba(255,255,255,0.22)', 0.6);
  } else if (S.hat === 'copa') {
    g.fillStyle = '#07040a'; g.beginPath(); g.ellipse(0.8, hy - 4, 11, 2.6, -0.06, 0, TAU); g.fill();
    hdPoly(g, [[-5, hy - 4.5], [-5.4, hy - 13], [6.8, hy - 13], [6.4, hy - 4.5]], hdLin(g, -5, 0, 7, 0, ['#322c34', '#100c12', '#07040a']));
    g.fillStyle = '#1a161c'; g.beginPath(); g.ellipse(0.7, hy - 13, 6.1, 1.3, 0, 0, TAU); g.fill();
    hdLine(g, [[-5.2, hy - 6.3], [6.6, hy - 6.3]], '#4e1018', 1.8);
    g.fillStyle = M[1]; g.fillRect(4, hy - 7.2, 1.6, 1.8);
    hdLine(g, [[-3.6, hy - 12], [-3.4, hy - 7.5]], 'rgba(255,255,255,0.25)', 0.8);
  }
}

// farol colgado a la cintura
function hdLantern(g) {
  hdLine(g, [[-7, 3], [-9, 7]], '#3a2616', 0.8);
  g.fillStyle = '#3a2810'; g.fillRect(-11.5, 6.5, 5, 1.2); g.fillRect(-11.5, 12, 5, 1.2);
  g.fillStyle = '#ffd27a'; g.fillRect(-11, 7.6, 4, 4.4);
  g.fillStyle = '#ff9a3c'; g.fillRect(-10, 9, 2, 2.4);
  g.fillStyle = '#5e4218'; g.fillRect(-11.5, 7.6, 0.8, 4.4); g.fillRect(-7.3, 7.6, 0.8, 4.4);
}

const ANIM = {
  aldeano: [40, (g, ph, atk) => {
    const s = Math.sin(ph * TAU);
    g.fillStyle = '#1e1612'; g.fillRect(-6 + s * 2, 13, 4, 3); g.fillRect(2 - s * 2, 13, 4, 3);
    const rg = g.createLinearGradient(0, -6, 0, 14); rg.addColorStop(0, '#5a4636'); rg.addColorStop(1, '#2a1f17'); g.fillStyle = rg;
    g.beginPath(); g.moveTo(-6, -4); g.lineTo(6, -4); g.lineTo(9 + s, 13); rag(g, -9, 9, 13, s); g.lineTo(-9 + s, 13); g.closePath(); g.fill();
    g.strokeStyle = '#21170f'; g.lineWidth = 0.8; for (const x of [-3, 1, 4]) { g.beginPath(); g.moveTo(x * 0.6, -2); g.lineTo(x + s * 0.6, 12); g.stroke(); }
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 1; g.beginPath(); g.moveTo(-6, 3); g.lineTo(6, 3); g.lineTo(4, 8); g.stroke();
    g.fillStyle = '#3a2c22'; g.beginPath(); g.moveTo(-7, -2); g.quadraticCurveTo(-8, -14, 1, -15); g.quadraticCurveTo(8, -13, 7, -2); g.closePath(); g.fill();
    g.fillStyle = '#100a08'; g.beginPath(); g.ellipse(1.5, -7, 4, 4.5, 0, 0, TAU); g.fill();
    g.fillStyle = '#ff5a3c'; g.fillRect(0, -8, 1.6, 1.4); g.fillRect(3, -8, 1.6, 1.4);
    const ay = atk ? -15 : -9 + s * 0.6;
    g.strokeStyle = '#4a3626'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(5, -2); g.lineTo(10, ay + 5); g.stroke();
    g.strokeStyle = '#6b5236'; g.lineWidth = 2; g.beginPath(); g.moveTo(9, ay + 9); g.lineTo(12, ay - 3); g.stroke();
    const fl = 1 + Math.sin(ph * TAU * 2) * 0.3;
    g.fillStyle = '#ff6a1a'; g.beginPath(); g.moveTo(9.6, ay - 3); g.quadraticCurveTo(12.5, ay - 11 * fl, 15.4, ay - 3); g.closePath(); g.fill();
    g.fillStyle = '#ffd27a'; g.beginPath(); g.moveTo(11.2, ay - 3); g.quadraticCurveTo(12.5, ay - 7 * fl, 13.8, ay - 3); g.closePath(); g.fill();
  }],
  sabueso: [44, (g, ph, atk) => {
    const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU), crouch = atk ? 2.5 : 0;
    g.strokeStyle = '#24120f'; g.lineWidth = 2.6;
    // galope: patas en pares opuestos
    [[-9, 4, s], [-4, 5, -s], [5, 4, -s], [9, 3, s]].forEach(([x, y, k]) => { g.beginPath(); g.moveTo(x, y + crouch); g.lineTo(x + k * 3.5, 12); g.lineTo(x + k * 4.5 + 1.5, 12); g.stroke(); });
    g.strokeStyle = '#4f2b27'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-12, crouch); g.quadraticCurveTo(-18, -4 + c * 2, -17, -10 + c * 2); g.stroke();
    const bg = g.createLinearGradient(0, -6, 0, 8); bg.addColorStop(0, '#6a3a32'); bg.addColorStop(1, '#3a1e1a'); g.fillStyle = bg;
    g.beginPath(); g.ellipse(-1, 1 + crouch + c * 0.6, 12.5, 6.5, -0.05, 0, TAU); g.fill();
    g.strokeStyle = '#2a1410'; g.lineWidth = 0.8; for (const x of [-6, -3, 0, 3]) { g.beginPath(); g.moveTo(x, -3 + crouch); g.quadraticCurveTo(x + 1, 1 + crouch, x, 5 + crouch); g.stroke(); }
    g.fillStyle = '#2e1916'; for (let i = -8; i <= 6; i += 3.5) { g.beginPath(); g.moveTo(i - 1.6, -4 + crouch); g.lineTo(i, -10 + crouch); g.lineTo(i + 1.6, -4 + crouch); g.fill(); }
    g.fillStyle = '#5a312c'; g.beginPath(); g.ellipse(11, -3 + crouch, 7.5, 4.6, -0.25, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(8, -6 + crouch); g.lineTo(9, -13 + crouch); g.lineTo(12, -7 + crouch); g.fill();
    g.fillStyle = '#ffd23c'; g.beginPath(); g.arc(13, -4.5 + crouch, 1.4, 0, TAU); g.fill();
    g.fillStyle = '#140806'; g.beginPath(); g.moveTo(13, -1 + crouch); g.lineTo(19, atk ? 3 : 0 + crouch); g.lineTo(13, 1.5 + crouch); g.closePath(); g.fill();
    g.fillStyle = '#e8dcc4'; for (const x of [14, 16]) { g.beginPath(); g.moveTo(x, -0.8 + crouch); g.lineTo(x + 0.7, 1.6 + crouch); g.lineTo(x + 1.4, -0.8 + crouch); g.fill(); }
  }],
  bestia: [64, (g, ph, atk) => {
    const s = Math.sin(ph * TAU), raise = atk ? -10 : 0;
    g.fillStyle = '#2a1a14'; g.fillRect(-10 + s * 2, 14, 7, 4); g.fillRect(3 - s * 2, 14, 7, 4);
    g.strokeStyle = '#3b2a22'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(10, 0); g.lineTo(19 - s * 2, 10 + raise); g.stroke();
    g.beginPath(); g.moveTo(-10, 0); g.lineTo(-17 + s * 2, 12 + raise); g.stroke();
    g.strokeStyle = '#e8dcc4'; g.lineWidth = 1.3;
    [[19 - s * 2, 10 + raise], [-17 + s * 2, 12 + raise]].forEach(([x, y]) => { for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3 + k, y + 5); g.stroke(); } });
    const fg = g.createRadialGradient(-4, -6, 2, 0, 0, 20); fg.addColorStop(0, '#5e4434'); fg.addColorStop(1, '#2a1c16'); g.fillStyle = fg;
    blob(g, 17 + s * 0.4, 24, 0.45, 7); g.fill();
    g.strokeStyle = '#1e140f'; g.lineWidth = 0.9; for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); g.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); g.stroke(); }
    g.fillStyle = '#4e382c'; g.beginPath(); g.ellipse(8, -11 + s * 0.5, 8.5, 7, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(3, -15); g.lineTo(1, -24); g.lineTo(7, -17); g.fill(); g.beginPath(); g.moveTo(10, -17); g.lineTo(13, -25); g.lineTo(14, -16); g.fill();
    g.fillStyle = '#ffd23c'; g.beginPath(); g.arc(9, -12, 1.7, 0, TAU); g.arc(13, -11, 1.7, 0, TAU); g.fill();
    g.fillStyle = '#140a08'; g.beginPath(); g.ellipse(12, -6, 4.5, atk ? 3.5 : 2.2, 0, 0, TAU); g.fill();
    g.fillStyle = '#e8dcc4'; for (let i = 9; i <= 14; i += 2.5) { g.beginPath(); g.moveTo(i, -7.5); g.lineTo(i + 0.8, -5); g.lineTo(i + 1.6, -7.5); g.fill(); }
  }],
  desollado: [52, (g, ph, atk) => {
    const s = Math.sin(ph * TAU), crouch = atk ? 3 : 0;
    g.strokeStyle = '#5a1a1e'; g.lineWidth = 3;
    [[-10, 4, s], [-4, 5, -s], [6, 4, -s], [11, 3, s]].forEach(([x, y, k]) => { g.beginPath(); g.moveTo(x, y + crouch); g.lineTo(x + k * 4, 15); g.stroke(); });
    const bg = g.createLinearGradient(0, -7, 0, 7); bg.addColorStop(0, '#b0424a'); bg.addColorStop(1, '#6a1e22'); g.fillStyle = bg;
    g.beginPath(); g.ellipse(0, crouch, 14, 7, -0.1, 0, TAU); g.fill();
    g.strokeStyle = '#e8d4bc'; g.lineWidth = 1.2; for (const x of [-7, -3, 1, 5]) { g.beginPath(); g.moveTo(x, -5 + crouch); g.quadraticCurveTo(x + 2, crouch, x, 5 + crouch); g.stroke(); }
    g.fillStyle = '#e8d4bc'; for (let x = -10; x <= 6; x += 4) { g.beginPath(); g.moveTo(x - 1.5, -6 + crouch); g.lineTo(x, -12 + crouch); g.lineTo(x + 1.5, -6 + crouch); g.fill(); }
    g.fillStyle = '#9a3438'; g.beginPath(); g.ellipse(14, -5 + crouch, 7, 5, -0.3, 0, TAU); g.fill();
    g.fillStyle = '#2a0608'; g.beginPath(); g.moveTo(15, -3 + crouch); g.lineTo(23, atk ? 3 : -1); g.lineTo(15, 1 + crouch); g.closePath(); g.fill();
    g.fillStyle = '#e8d4bc'; g.fillRect(17, -2.5 + crouch, 1, 1.5); g.fillRect(19, -2 + crouch, 1, 1.5);
    g.fillStyle = '#fff2a0'; g.beginPath(); g.arc(15, -7 + crouch, 1.5, 0, TAU); g.fill();
  }],
  tirador: [44, (g, ph, atk) => {
    const s = Math.sin(ph * TAU);
    g.fillStyle = '#1a1612'; g.fillRect(-5 + s * 2, 11, 4, 4); g.fillRect(1 - s * 2, 11, 4, 4);
    const cg = g.createLinearGradient(-9, -4, 9, 14); cg.addColorStop(0, '#3e3830'); cg.addColorStop(1, '#1e1a16'); g.fillStyle = cg;
    g.beginPath(); g.moveTo(-8, -3); g.lineTo(8, -3); g.lineTo(10 + s, 13); rag(g, -10, 10, 13, s); g.lineTo(-10 + s, 13); g.closePath(); g.fill();
    g.fillStyle = '#5a4630'; g.fillRect(-8, 3, 16, 2); g.fillStyle = '#c9a35a'; g.fillRect(-1, 3, 2, 2);
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-7, -3); g.lineTo(6, 6); g.stroke();
    g.fillStyle = '#a89a86'; g.beginPath(); g.arc(0, -8, 5, 0, TAU); g.fill();
    g.fillStyle = '#2a2420'; g.fillRect(-5, -7, 10, 3);
    g.fillStyle = '#ff5a3c'; g.fillRect(1, -9.5, 1.6, 1.4); g.fillRect(3.5, -9.5, 1.6, 1.4);
    g.fillStyle = '#16120e'; g.beginPath(); g.moveTo(-9, -11); g.lineTo(0, -21); g.lineTo(9, -11); g.closePath(); g.fill();
    g.fillStyle = '#4a1a1a'; g.fillRect(-7, -12.5, 14, 1.4);
    // mosquete: en ataque lo levanta a la altura del hombro
    const my = atk ? -6 : 3;
    g.strokeStyle = '#4a3a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-2, my + 2); g.lineTo(16, my - 2); g.stroke();
    g.strokeStyle = '#8a8a94'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(9, my); g.lineTo(23, my - 3.5); g.stroke();
    if (atk) { g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(24, my - 3.8, 1.2, 0, TAU); g.fill(); }
  }],
  lanzador: [40, (g, ph, atk) => {
    const s = Math.sin(ph * TAU);
    g.fillStyle = '#1e1612'; g.fillRect(-6 + s * 2, 13, 4, 3); g.fillRect(2 - s * 2, 13, 4, 3);
    const rg = g.createLinearGradient(0, -6, 0, 14); rg.addColorStop(0, '#5a3a2a'); rg.addColorStop(1, '#2e1e16'); g.fillStyle = rg;
    g.beginPath(); g.moveTo(-6, -4); g.lineTo(6, -4); g.lineTo(9 + s, 13); rag(g, -9, 9, 13, s); g.lineTo(-9 + s, 13); g.closePath(); g.fill();
    g.fillStyle = '#3a2a22'; g.beginPath(); g.moveTo(-7, -2); g.quadraticCurveTo(-8, -14, 0, -15); g.quadraticCurveTo(8, -14, 7, -2); g.closePath(); g.fill();
    g.fillStyle = '#100a08'; g.beginPath(); g.ellipse(0, -7, 4, 4.5, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffb347'; g.fillRect(-2, -8, 1.6, 1.4); g.fillRect(1.5, -8, 1.6, 1.4);
    // brazo con la botella: atrás y arriba al arrojar
    const bx = atk ? -12 : -9, by = atk ? -16 : -4 + s * 0.6;
    g.strokeStyle = '#4a3020'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-5, -2); g.lineTo(bx + 2, by + 4); g.stroke();
    g.fillStyle = '#4a5a2a'; g.fillRect(bx - 1.5, by - 2, 4, 7);
    const fl = 1 + Math.sin(ph * TAU * 2) * 0.3;
    g.fillStyle = '#ff7a2a'; g.beginPath(); g.moveTo(bx - 1, by - 2); g.quadraticCurveTo(bx + 0.5, by - 8 * fl, bx + 2, by - 2); g.closePath(); g.fill();
  }],
  monje: [46, (g, ph, atk) => {
    const s = Math.sin(ph * TAU) * 0.6;
    const rg = g.createLinearGradient(0, -6, 0, 15); rg.addColorStop(0, '#4a3448'); rg.addColorStop(1, '#221622'); g.fillStyle = rg;
    g.beginPath(); g.moveTo(-7, -4); g.lineTo(7, -4); g.lineTo(11 + s, 15); rag(g, -11, 11, 15, s, 2.5); g.lineTo(-11 + s, 15); g.closePath(); g.fill();
    g.strokeStyle = '#1a101a'; g.lineWidth = 0.8; for (const x of [-4, 0, 4]) { g.beginPath(); g.moveTo(x * 0.5, -2); g.lineTo(x + s, 14); g.stroke(); }
    g.fillStyle = '#c9a35a'; g.fillRect(-1, -2, 2, 9); g.fillRect(-3, 0, 6, 1.6);
    g.fillStyle = '#3a2840'; g.beginPath(); g.moveTo(-8, -2); g.quadraticCurveTo(-9, -16, 0, -17); g.quadraticCurveTo(9, -16, 8, -2); g.closePath(); g.fill();
    g.fillStyle = '#0c060c'; g.beginPath(); g.ellipse(0, -7, 4.6, 5, 0, 0, TAU); g.fill();
    g.fillStyle = '#d07cff'; g.fillRect(-2.6, -8, 1.6, 1.4); g.fillRect(1, -8, 1.6, 1.4);
    // campana: se mece al andar, alzada al tañer
    const bx = 15, by = atk ? -14 : 1 + Math.sin(ph * TAU) * 1.5;
    g.strokeStyle = '#3a2840'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(6, -2); g.lineTo(bx - 2, by - 3); g.stroke();
    g.fillStyle = '#b08a3a'; g.beginPath(); g.moveTo(bx - 5, by + 4); g.quadraticCurveTo(bx - 5, by - 4, bx, by - 4); g.quadraticCurveTo(bx + 5, by - 4, bx + 5, by + 4); g.lineTo(bx + 6.5, by + 6); g.lineTo(bx - 6.5, by + 6); g.closePath(); g.fill();
    g.fillStyle = '#f0d890'; g.fillRect(bx - 3, by - 2, 1.4, 4);
    g.fillStyle = '#5a4418'; g.beginPath(); g.arc(bx + Math.sin(ph * TAU) * 1.5, by + 6.5, 1.5, 0, TAU); g.fill();
  }],
  escupidor: [46, (g, ph, atk) => {
    const s = Math.sin(ph * TAU), puff = atk ? 1.25 : 1 + s * 0.04;
    g.strokeStyle = '#2a3418'; g.lineWidth = 2.4;
    [[-8, 6, s], [-2, 8, -s], [5, 7, s]].forEach(([x, y, k]) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + k * 3, 14); g.stroke(); });
    const bg = g.createRadialGradient(-3, -4, 2, 0, 0, 15); bg.addColorStop(0, '#5a7238'); bg.addColorStop(1, '#2a3818'); g.fillStyle = bg;
    g.save(); g.scale(puff, puff); blob(g, 12.5, 16, 0.3, 211); g.fill(); g.restore();
    g.fillStyle = 'rgba(150,255,100,0.7)'; for (const [x, y] of [[-6, 2], [-2, 6], [-9, -3], [3, 3]]) { g.beginPath(); g.arc(x, y, 1.6 + (atk ? 0.6 : 0), 0, TAU); g.fill(); }
    g.fillStyle = '#4e6230'; g.beginPath(); g.ellipse(6, -7, 9, 8, 0, 0, TAU); g.fill();
    g.fillStyle = '#140a04'; g.beginPath(); g.ellipse(12, -5, 5, atk ? 5 : 3.5, 0, 0, TAU); g.fill();
    if (atk) { g.fillStyle = '#9aff6a'; g.beginPath(); g.arc(13, -5, 2.6, 0, TAU); g.fill(); }
    g.fillStyle = '#e0d870'; g.beginPath(); g.arc(4, -11, 1.6, 0, TAU); g.arc(9, -12, 1.6, 0, TAU); g.fill();
  }],
  ballestero: [44, (g, ph, atk) => {
    const s = Math.sin(ph * TAU);
    g.fillStyle = '#1a1612'; g.fillRect(-5 + s * 2, 11, 4, 4); g.fillRect(1 - s * 2, 11, 4, 4);
    const cg = g.createLinearGradient(0, -4, 0, 14); cg.addColorStop(0, '#4a4234'); cg.addColorStop(1, '#25201a'); g.fillStyle = cg;
    g.beginPath(); g.moveTo(-8, -3); g.lineTo(8, -3); g.lineTo(10 + s, 12); rag(g, -10, 10, 12, s); g.lineTo(-10 + s, 12); g.closePath(); g.fill();
    g.fillStyle = '#7a7a84'; for (let r = 0; r < 3; r++) for (let c = -2; c <= 2; c++) { g.beginPath(); g.arc(c * 2.8 + (r % 2) * 1.4, -1 + r * 3, 1.3, 0, Math.PI); g.fill(); }
    g.fillStyle = '#6a6a72'; g.beginPath(); g.arc(0, -9, 6, Math.PI, 0); g.fill(); g.fillRect(-6, -9, 12, 3);
    g.fillStyle = '#0a0a0e'; g.fillRect(-4, -8, 8, 1.4);
    g.fillStyle = '#a0a0aa'; g.fillRect(-0.6, -15, 1.2, 6);
    const ay = atk ? -7 : 2;
    g.strokeStyle = '#5a4630'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(1, ay); g.lineTo(19, ay); g.stroke();
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 2; g.beginPath(); g.arc(17, ay, 7, -1.3, 1.3); g.stroke();
    g.strokeStyle = '#c8c8d0'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(18.5, ay - 6.6); g.lineTo(atk ? 8 : 12, ay); g.lineTo(18.5, ay + 6.6); g.stroke();
    if (atk) { g.strokeStyle = '#d0d4e0'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(8, ay); g.lineTo(23, ay); g.stroke(); }
  }],
  escudero: [50, (g, ph, atk) => {
    const s = Math.sin(ph * TAU);
    g.fillStyle = '#2a2a30'; g.fillRect(-6 + s * 2, 12, 5, 5); g.fillRect(1 - s * 2, 12, 5, 5);
    const ag = g.createLinearGradient(-10, -4, 10, 14); ag.addColorStop(0, '#5a5a64'); ag.addColorStop(1, '#2a2a32'); g.fillStyle = ag;
    g.beginPath(); g.moveTo(-9, -3); g.lineTo(9, -3); g.lineTo(11, 14); g.lineTo(-11, 14); g.closePath(); g.fill();
    g.fillStyle = '#7a7a84'; for (let r = 0; r < 4; r++) g.fillRect(-9, -1 + r * 4, 18, 1);
    g.fillStyle = '#3a1418'; g.fillRect(-11, 6, 22, 9); // faldón
    g.fillStyle = '#8a8a94'; g.beginPath(); g.arc(0, -9, 6.6, 0, TAU); g.fill();
    g.fillStyle = '#121218'; g.fillRect(-5, -10, 10, 2);
    g.fillStyle = '#5a1a22'; g.beginPath(); g.moveTo(-1, -16); g.quadraticCurveTo(-6 - s, -20, -9 - s * 2, -14); g.lineTo(-1, -14); g.closePath(); g.fill(); // penacho
    // lanza corta: adelantada al cargar
    const lx = atk ? 6 : 0;
    g.strokeStyle = '#5a4630'; g.lineWidth = 2; g.beginPath(); g.moveTo(-8 + lx, 6); g.lineTo(-16 + lx * 2.5, -12); g.stroke();
    g.fillStyle = '#b0b0ba'; g.beginPath(); g.moveTo(-18 + lx * 2.5, -14); g.lineTo(-14 + lx * 2.5, -18); g.lineTo(-12.5 + lx * 2.5, -12); g.closePath(); g.fill();
  }],
  bombero: [40, (g, ph, atk) => {
    const s = Math.sin(ph * TAU);
    g.fillStyle = '#1e140e'; g.fillRect(-5 + s * 3, 11, 4, 4); g.fillRect(1 - s * 3, 11, 4, 4);
    g.fillStyle = '#4a2a1e'; g.beginPath(); g.moveTo(-7, 12); g.lineTo(7, 12); g.lineTo(5, -3); g.lineTo(-5, -3); g.closePath(); g.fill();
    g.fillStyle = '#7a6a5c'; g.beginPath(); g.arc(1, -7, 5, 0, TAU); g.fill();
    g.fillStyle = '#e8dcc4'; g.fillRect(-1, -6, 5, 1); // mueca
    g.fillStyle = '#ffdd44'; g.fillRect(-2, -9, 2, 2); g.fillRect(2, -9, 2, 2);
    g.fillStyle = '#222'; g.beginPath(); g.arc(0, 4, 7, 0, TAU); g.fill();
    g.strokeStyle = '#5a5a5a'; g.lineWidth = 0.8; g.beginPath(); g.arc(-2, 2, 4, 3.4, 4.6); g.stroke();
    g.strokeStyle = '#c9a35a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(3, -2); g.quadraticCurveTo(7, -4, 8, -8); g.stroke();
    const sp = atk ? 3.4 : 1.8 + Math.sin(ph * TAU * 3) * 0.7;
    g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(8.5, -9, sp, 0, TAU); g.fill();
    g.fillStyle = '#ff6a1a'; g.beginPath(); g.arc(8.5, -9, sp * 0.5, 0, TAU); g.fill();
  }],
  sacerdote: [48, (g, ph, atk) => {
    const s = Math.sin(ph * TAU) * 0.6;
    const rg = g.createLinearGradient(0, -6, 0, 16); rg.addColorStop(0, '#7a1420'); rg.addColorStop(1, '#3a080e'); g.fillStyle = rg;
    g.beginPath(); g.moveTo(-6, -4); g.lineTo(6, -4); g.lineTo(11 + s, 16); rag(g, -11, 11, 16, s, 2.5); g.lineTo(-11 + s, 16); g.closePath(); g.fill();
    g.fillStyle = '#e8dcc4'; g.fillRect(-1, -3, 2, 17); g.fillRect(-4, 2, 8, 2);
    g.fillStyle = '#c9a35a'; g.fillRect(-1.5, 10, 3, 1);
    g.fillStyle = '#c8b8a0'; g.beginPath(); g.arc(0, -8, 5.5, 0, TAU); g.fill();
    g.fillStyle = '#3a0a10'; g.beginPath(); g.moveTo(-7, -9); g.lineTo(0, -22); g.lineTo(7, -9); g.closePath(); g.fill();
    g.fillStyle = '#c9a35a'; g.fillRect(-0.6, -19, 1.2, 6); g.fillRect(-2, -17, 4, 1.2);
    g.fillStyle = '#1a0a0c'; g.fillRect(-3, -9, 6, 2);
    // báculo: alzado al curar
    const sy = atk ? -10 : 0;
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 15 + sy * 0.3); g.lineTo(13, -14 + sy); g.stroke();
    const glow = atk ? 4.2 : 3 + Math.sin(ph * TAU) * 0.4;
    g.fillStyle = 'rgba(255,74,90,0.35)'; g.beginPath(); g.arc(13, -16 + sy, glow + 2.5, 0, TAU); g.fill();
    g.fillStyle = '#ff4a5a'; g.beginPath(); g.arc(13, -16 + sy, glow, 0, TAU); g.fill();
  }],
  saltador: [56, (g, ph, atk) => {
    const s = Math.sin(ph * TAU), crouch = atk ? 4 : Math.max(0, s) * 1.5;
    g.strokeStyle = '#2a1a14'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(-8, 4 + crouch); g.quadraticCurveTo(-18, 2 + crouch, -16, 14); g.stroke();
    g.beginPath(); g.moveTo(8, 4 + crouch); g.quadraticCurveTo(18, 2 + crouch, 16, 14); g.stroke();
    g.strokeStyle = '#3a2a1e'; g.lineWidth = 3; g.beginPath(); g.moveTo(5, 0 + crouch); g.lineTo(12, 8 - s); g.stroke(); g.beginPath(); g.moveTo(-5, 0 + crouch); g.lineTo(-12, 8 + s); g.stroke();
    const bg = g.createLinearGradient(0, -8, 0, 8); bg.addColorStop(0, '#5e4a36'); bg.addColorStop(1, '#3a2a1e'); g.fillStyle = bg;
    g.beginPath(); g.ellipse(0, crouch, 12, 9 - crouch * 0.4, 0, 0, TAU); g.fill();
    g.fillStyle = '#2a1e14'; for (let i = -6; i <= 6; i += 3) { g.beginPath(); g.moveTo(i - 1.5, -6 + crouch); g.lineTo(i, -11 + crouch); g.lineTo(i + 1.5, -6 + crouch); g.fill(); }
    g.fillStyle = '#5a4634'; g.beginPath(); g.ellipse(9, -6 + crouch, 8, 6, -0.3, 0, TAU); g.fill();
    g.fillStyle = '#ffd23c'; g.beginPath(); g.arc(12, -8 + crouch, 1.6, 0, TAU); g.fill();
    g.fillStyle = '#e8dcc4'; g.beginPath(); g.moveTo(14, -3 + crouch); g.lineTo(15, 0 + crouch); g.lineTo(16, -3 + crouch); g.fill();
  }],
};
for (const [type, [size, fn]] of Object.entries(ANIM)) {
  for (let i = 0; i < 4; i++) SPR[type + '_' + i] = makeSprite(size, g => fn(g, i / 4, false));
  SPR[type + '_w'] = makeSprite(size, g => fn(g, 0.25, true));
  SPR[type] = SPR[type + '_0'];
}

// ---------------------------------------------------------------- Enemigos en alta definición
// Los humanos usan el mismo esqueleto que el cazador (piernas, abrigo, brazos con codo); las bestias van dibujadas a mano.
const OL7 = 'rgba(7,4,10,0.9)';
// cabezas propias de los enemigos
function headRostro(g, S, hy, eyes = true) {
  const sk = S.skin || ['#9a8a78', '#6a5a4c'];
  g.fillStyle = sk[1]; g.beginPath(); g.ellipse(1.2, hy, 4.6, 5.3, 0, 0, TAU); g.fill();
  g.fillStyle = sk[0]; g.beginPath(); g.ellipse(1.8, hy - 0.6, 3.6, 4.2, 0, 0, TAU); g.fill();
  if (!eyes) return;
  g.fillStyle = '#1a0c0c'; g.fillRect(-0.6, hy - 2.2, 6.4, 2.2);
  g.fillStyle = S.eye || '#ff5a3c'; g.fillRect(0.2, hy - 1.6, 1.4, 1); g.fillRect(3.4, hy - 1.6, 1.4, 1);
}
const EN_HEADS = {
  // pelo revuelto, barba sucia y boca abierta con dientes
  pelo(g, S) {
    const hy = -27;
    g.fillStyle = '#1e140e'; g.beginPath(); g.ellipse(-0.5, hy - 2, 6, 5.6, 0, 0, TAU); g.fill();
    headRostro(g, S, hy);
    g.fillStyle = '#100808'; g.fillRect(1.4, hy + 2, 3.6, 2.4);
    g.fillStyle = '#e2dccd'; g.fillRect(1.6, hy + 2, 0.8, 0.8); g.fillRect(3.4, hy + 2, 0.8, 0.8); g.fillRect(2.5, hy + 3.6, 0.8, 0.8);
    g.strokeStyle = '#2e2016'; g.lineWidth = 0.9;
    for (let i = 0; i < 9; i++) { const a = Math.PI + i * 0.36; g.beginPath(); g.moveTo(Math.cos(a) * 4, hy - 1 + Math.sin(a) * 4.5); g.lineTo(Math.cos(a) * 7.5 - 1, hy + Math.sin(a) * 7); g.stroke(); }
    hdLine(g, [[-2, hy + 3], [0, hy + 6], [3, hy + 6.5]], '#3a2a1c', 1.6);
  },
  // tricornio de guardia con galón dorado, bigote
  tricornio(g, S) {
    const hy = -28;
    g.fillStyle = '#2a1e18'; g.beginPath(); g.ellipse(-2.2, hy + 1.5, 3.4, 4, 0, 0, TAU); g.fill();
    headRostro(g, S, hy);
    hdLine(g, [[1.5, hy + 2.6], [5.8, hy + 2.2]], '#3a2a1c', 1.1);
    hdPoly(g, [[-8, hy - 3], [-3, hy - 5.5], [1, hy - 4.5], [6, hy - 6], [9.5, hy - 3], [6, hy - 2.6], [-5, hy - 2.4]], '#141014', 1);
    hdPoly(g, [[-4.5, hy - 4], [-3.5, hy - 10], [1, hy - 11.5], [5.5, hy - 9.5], [6, hy - 4.5]], hdLin(g, -4, hy - 11, 6, hy - 4, ['#3a3440', '#141014']), 1);
    hdLine(g, [[-8, hy - 3], [-3, hy - 5.5], [1, hy - 4.5], [6, hy - 6], [9.5, hy - 3]], S.metal[1], 0.7);
    g.fillStyle = '#a8282c'; g.beginPath(); g.arc(-3.5, hy - 6, 1.2, 0, TAU); g.fill();
  },
  // pañuelo atado y trapo sobre la boca, ojos desorbitados
  panuelo(g, S) {
    const hy = -27.5;
    headRostro(g, S, hy, false);
    g.fillStyle = '#f6f0e2'; g.fillRect(0, hy - 2, 2, 1.6); g.fillRect(3.4, hy - 2, 2, 1.6);
    g.fillStyle = S.eye || '#a8282c'; g.fillRect(0.8, hy - 1.6, 0.8, 0.8); g.fillRect(4.2, hy - 1.6, 0.8, 0.8);
    hdPoly(g, [[-5, hy - 2.5], [-4.6, hy - 6.5], [1, hy - 8.4], [6, hy - 6], [6.4, hy - 3]], hdLin(g, -5, hy - 8, 6, hy - 2, [S.scarf[0], S.scarf[1]]), 1);
    hdPoly(g, [[-5, hy - 4], [-9, hy - 1], [-8.4, hy + 1.4], [-5.4, hy - 1.6]], S.scarf[1]);
    hdPoly(g, [[-3, hy + 0.6], [6.2, hy + 0.4], [5.6, hy + 5], [-3, hy + 5.2]], hdLin(g, -3, hy, 6, hy + 5, ['#8a8478', '#4a4436']));
    hdLine(g, [[-1, hy + 2.4], [5, hy + 2.2]], 'rgba(0,0,0,0.35)', 0.6);
  },
  // capacete de hierro de ala ancha, rostro en sombra
  capacete(g, S) {
    const hy = -27.5;
    headRostro(g, S, hy);
    g.fillStyle = 'rgba(10,6,10,0.55)'; g.fillRect(-3, hy - 3, 9, 3);
    hdLine(g, [[-3, hy - 1], [-1.6, hy + 5]], '#2e2016', 0.8);
    g.fillStyle = S.metal[2]; g.beginPath(); g.ellipse(1, hy - 3.6, 10.5, 2.6, -0.05, 0, TAU); g.fill();
    g.fillStyle = S.metal[1]; g.beginPath(); g.ellipse(1, hy - 4.2, 10, 1.8, -0.05, Math.PI, 0); g.fill();
    hdPoly(g, [[-5, hy - 4], [-4.4, hy - 9], [0.8, hy - 11.2], [6, hy - 9], [6.6, hy - 4]], hdLin(g, -5, hy - 11, 6, hy - 4, [S.metal[0], S.metal[1], S.metal[2]]), 1);
    hdLine(g, [[0.8, hy - 11], [0.8, hy - 4.5]], S.metal[2], 0.8);
    hdLine(g, [[-3.6, hy - 8.4], [-1, hy - 10.4]], 'rgba(255,255,255,0.6)', 0.6);
  },
  // mitra alta carmesí con galón, rostro cadavérico y lágrimas de sangre
  mitra(g, S) {
    const hy = -27;
    headRostro(g, S, hy);
    g.fillStyle = '#a8282c'; g.fillRect(0.6, hy - 0.6, 0.7, 3); g.fillRect(3.8, hy - 0.6, 0.7, 2.2);
    hdPoly(g, [[-4.5, hy - 3.5], [-3.6, hy - 11], [1, hy - 14.5], [5.8, hy - 11], [6.6, hy - 3.5]], hdLin(g, -4, hy - 14, 6, hy - 3, ['#d4483c', '#7a1a22', '#2a080c']), 1);
    hdLine(g, [[-4.4, hy - 4.2], [6.4, hy - 4.2]], S.metal[1], 1.4);
    hdLine(g, [[1, hy - 14.2], [1, hy - 4.5]], S.metal[1], 1);
    hdLine(g, [[-1.6, hy - 9], [3.6, hy - 9]], S.metal[1], 0.8);
    g.fillStyle = S.metal[0]; g.fillRect(0.6, hy - 9.4, 0.8, 0.8);
  },
};

// armas y objetos
const EN_ITEMS = {
  antorcha(g, x, y, ang, t) {
    const c = Math.cos(ang), s = Math.sin(ang), L = 13, tx = x + c * L, ty = y + s * L;
    hdLimb(g, [[x - c * 4, y - s * 4], [tx, ty]], hdLin(g, x, y, tx, ty, ['#5c4228', '#9a7650']), 1.8);
    hdLine(g, [[tx - c * 2.5, ty - s * 2.5], [tx, ty]], '#3a2a1c', 2.8);
    const fl = 1 + Math.sin(t * TAU * 2) * 0.25, fx = tx + c * 1.5, fy = ty + s * 1.5;
    hdPoly(g, [[fx - 3, fy], [fx - 1.5, fy - 6 * fl], [fx, fy - 9.5 * fl], [fx + 1.8, fy - 5.5 * fl], [fx + 3, fy]], '#d4483c');
    hdPoly(g, [[fx - 2, fy], [fx - 0.6, fy - 6 * fl], [fx + 1.4, fy - 3.6 * fl], [fx + 2, fy]], '#ff9a3c');
    hdPoly(g, [[fx - 1, fy], [fx, fy - 3.4 * fl], [fx + 1, fy]], '#fff4c8');
  },
  mosquete(g, x, y, ang) {
    g.save(); g.translate(x, y); g.rotate(ang);
    hdPoly(g, [[-8, -1.2], [-2, -1.6], [0, -0.6], [-1, 2.4], [-8.6, 3.6], [-10, 2.6]], '#5c4228', 0.9);
    g.fillStyle = '#7a5a38'; g.fillRect(-8, -1, 6, 0.8);
    g.fillStyle = '#07040a'; g.fillRect(-2, -2.2, 24.6, 2.4);
    g.fillStyle = '#6e7480'; g.fillRect(-2, -1.8, 24, 1.6);
    g.fillStyle = '#c8ccd6'; g.fillRect(-1.5, -1.8, 23, 0.5);
    g.fillStyle = '#5c4228'; g.fillRect(0, -0.4, 15, 1.4);
    g.fillStyle = '#b08a3a'; g.fillRect(-1.4, -2.6, 2.6, 2.4); g.fillRect(8, -2, 1, 2.6); g.fillRect(15, -2, 1, 2.6);
    g.fillStyle = '#9aa0ac'; g.fillRect(22, -2.6, 1, 1);
    g.restore();
  },
  ballesta(g, x, y, ang, t, loaded = true) {
    g.save(); g.translate(x, y); g.rotate(ang);
    hdPoly(g, [[-6, -1], [10, -1.4], [10, 1], [-6, 1.6], [-7, 3.4], [-8, 1]], '#5c4228', 0.9);
    g.fillStyle = '#9a7650'; g.fillRect(-5, -1, 14, 0.6);
    g.strokeStyle = OL7; g.lineWidth = 2.6; g.beginPath(); g.moveTo(8, -9); g.quadraticCurveTo(12.5, 0, 8, 9); g.stroke();
    g.strokeStyle = '#6e7480'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(8, -9); g.quadraticCurveTo(12.5, 0, 8, 9); g.stroke();
    g.strokeStyle = '#c8c2b4'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(8, -9); g.lineTo(loaded ? 1 : 6, 0); g.lineTo(8, 9); g.stroke();
    if (loaded) { g.fillStyle = '#3a2a1c'; g.fillRect(1, -0.5, 11, 1); g.fillStyle = '#c8ccd6'; g.fillRect(12, -1, 2, 2); }
    g.restore();
  },
  botella(g, x, y, ang, t) {
    hdPoly(g, [[x - 2.4, y - 1], [x + 2.4, y - 1], [x + 2.6, y + 4.5], [x - 2.6, y + 4.5]], hdLin(g, x - 2, 0, x + 2, 0, ['#7aa84a', '#1a2a14']), 0.9);
    g.fillStyle = '#3a5a2a'; g.fillRect(x - 0.9, y - 4, 1.8, 3);
    g.fillStyle = '#c8ffa0'; g.fillRect(x - 1.6, y, 0.7, 2.6);
    const fl = 1 + Math.sin(t * TAU * 3) * 0.3;
    hdPoly(g, [[x - 2, y - 4], [x - 0.5, y - 9 * fl], [x + 0.6, y - 6 * fl], [x + 2, y - 4]], '#ff9a3c');
    hdPoly(g, [[x - 0.8, y - 4], [x, y - 6.4 * fl], [x + 0.8, y - 4]], '#fff4c8');
  },
  campana(g, x, y, ang, t) {
    hdLimb(g, [[x, y], [x, y + 3]], '#3a2a1c', 1.4);
    hdPoly(g, [[x - 2.6, y + 3], [x + 2.6, y + 3], [x + 4.4, y + 9.4], [x + 5.4, y + 10.4], [x - 5.4, y + 10.4], [x - 4.4, y + 9.4]], hdLin(g, x - 5, 0, x + 5, 0, ['#f0d890', '#b08a3a', '#5e4218']), 1);
    hdLine(g, [[x - 4.4, y + 9], [x + 4.4, y + 9]], '#5e4218', 0.7);
    g.fillStyle = '#fff4c8'; g.fillRect(x - 2.4, y + 4, 0.8, 4);
    g.fillStyle = '#3a2810'; g.beginPath(); g.arc(x + Math.sin(t * TAU) * 1.5, y + 11.2, 1.1, 0, TAU); g.fill();
  },
  maza(g, x, y, ang) {
    const c = Math.cos(ang), s = Math.sin(ang), tx = x + c * 13, ty = y + s * 13;
    hdLimb(g, [[x - c * 3, y - s * 3], [tx, ty]], '#4a4e5a', 1.6);
    g.save(); g.translate(tx, ty); g.rotate(ang);
    hdPoly(g, [[-3, -2.6], [3, -2.6], [4.4, 0], [3, 2.6], [-3, 2.6], [-4.4, 0]], hdLin(g, 0, -3, 0, 3, ['#c8ccd6', '#6e7480', '#2a2c34']), 1);
    for (const yy of [-3.6, 3.6]) { g.fillStyle = '#9aa0ac'; g.fillRect(-2, yy - 0.8, 4, 1.6); }
    g.fillStyle = '#eef0f6'; g.fillRect(-2, -2, 3, 0.6);
    g.restore();
  },
  bomba(g, x, y, ang, t) {
    g.fillStyle = OL7; g.beginPath(); g.arc(x, y + 1, 4.6, 0, TAU); g.fill();
    g.fillStyle = hdLin(g, x - 3, y - 3, x + 3, y + 4, ['#56606c', '#1a1e26', '#07040a']); g.beginPath(); g.arc(x, y + 1, 3.8, 0, TAU); g.fill();
    g.fillStyle = '#9aa6b0'; g.fillRect(x - 2, y - 1.4, 1.2, 1);
    g.fillStyle = '#3a2810'; g.fillRect(x - 1, y - 4, 2, 1.6);
    hdLine(g, [[x, y - 4], [x + 1.6, y - 6.5], [x + 3, y - 7]], '#c8b890', 0.7);
    const sp = 1 + Math.sin(t * TAU * 4) * 0.5;
    g.fillStyle = '#fff4c8'; g.fillRect(x + 2.6, y - 7.6, 1.4, 1.4);
    g.fillStyle = '#ff9a3c'; for (const [dx, dy] of [[-1, -1], [1.4, -0.8], [0.4, 1.2]]) g.fillRect(x + 3 + dx * sp, y - 7 + dy * sp, 0.8, 0.8);
  },
  incensario(g, x, y, ang, t) {
    hdLimb(g, [[x, y + 8], [x + 1, y - 22]], hdLin(g, x - 1, 0, x + 1, 0, ['#7a5a38', '#2e2016']), 1.6);
    hdPoly(g, [[x - 2, y - 22], [x + 3.6, y - 22], [x + 2.4, y - 26], [x - 0.8, y - 26]], '#b08a3a', 0.8);
    const sx = x + 5 + Math.sin(t * TAU) * 2;
    hdLine(g, [[x + 2.6, y - 23], [sx, y - 15]], '#8a6424', 0.6);
    g.fillStyle = OL7; g.beginPath(); g.arc(sx, y - 13, 3, 0, TAU); g.fill();
    g.fillStyle = '#8a6424'; g.beginPath(); g.arc(sx, y - 13, 2.3, 0, TAU); g.fill();
    g.fillStyle = '#d4483c'; g.fillRect(sx - 1.6, y - 13.4, 3.2, 1);
    g.fillStyle = '#ff8a7a'; g.fillRect(sx - 0.6, y - 13.8, 1.2, 0.8);
  },
};

// estilos de los humanos (mismo formato que los atuendos del cazador)
Object.assign(HD_STYLE, {
  e_aldeano:    { coat: ['#6a5440', '#46362a', '#1e1610'], hem: 20, open: true, vest: ['#5a4a3a', '#2e241a'], shirt: '#8a8070', pants: ['#4e4234', '#241c14'], boot: ['#3a2a1e', '#160e0a'], bootTop: 30, metal: ['#bc9a70', '#7a5a38', '#2e2016'], scarf: ['#5a4a3a', '#2e241a'], glove: ['#9a8a78', '#5a4a3c'], capelet: 0, belts: 'cordon', headFn: EN_HEADS.pelo, skin: ['#a89a84', '#6a5c4c'], eye: '#ff5a3c', ragged: true },
  e_lanzador:   { coat: ['#7a6448', '#4e3e2c', '#221a12'], hem: 16, open: true, vest: ['#7a2a22', '#3a1410'], shirt: '#a89a84', pants: ['#5a4a38', '#2a2018'], boot: ['#3a2a1e', '#160e0a'], bootTop: 28, metal: ['#bc9a70', '#7a5a38', '#2e2016'], scarf: ['#a8382c', '#4e1018'], glove: ['#9a8a78', '#5a4a3c'], capelet: 0, belts: 'cinto', headFn: EN_HEADS.panuelo, skin: ['#b8a48c', '#7a6a58'], eye: '#a8282c' },
  e_bombero:    { coat: ['#5a5040', '#3a3226', '#16120c'], hem: 10, open: true, vest: ['#3a3226', '#16120c'], shirt: '#a89a84', pants: ['#4a4030', '#1e1810'], boot: ['#2e2218', '#0e0a06'], bootTop: 27, metal: ['#d4b05a', '#8a6424', '#3a2810'], scarf: ['#2e2a24', '#0e0c0a'], glove: ['#a89a84', '#5a4a3c'], capelet: 0, belts: 'bandolera', headFn: EN_HEADS.panuelo, skin: ['#c0a890', '#7a6a58'], eye: '#ff5a3c' },
  e_tirador:    { coat: ['#4a5a4a', '#2e3a2e', '#101610'], hem: 26, open: true, vest: ['#8a2a22', '#3a1410'], shirt: '#c8c2b4', pants: ['#c8c2b4', '#7a7468'], boot: ['#2a2228', '#0e0a0c'], bootTop: 20, metal: ['#f0d890', '#b08a3a', '#5e4218'], scarf: ['#c8c2b4', '#7a7468'], glove: ['#5c4228', '#2e2016'], capelet: 0, belts: 'bandolera', headFn: EN_HEADS.tricornio, skin: ['#c8b098', '#7a6656'], eye: '#ff8a7a' },
  e_ballestero: { coat: ['#6a3a2c', '#44241a', '#1a0c08'], hem: 14, open: false, vest: ['#44241a', '#1a0c08'], shirt: '#6e7480', pants: ['#3a3c44', '#16181c'], boot: ['#4a3626', '#1a120c'], bootTop: 22, metal: ['#c8ccd6', '#6e7480', '#2a2c34'], scarf: ['#4a4e5a', '#1a1c20'], glove: ['#5c4228', '#2e2016'], capelet: 1, belts: 'cinto', headFn: EN_HEADS.capacete, skin: ['#b8a08a', '#6a5646'], eye: '#ff5a3c', studs: true },
  e_escudero:   { coat: ['#8a8e98', '#4e525c', '#1e2026'], hem: 14, open: false, vest: ['#4a4e5a', '#24262c'], shirt: '#6e7480', pants: ['#4e505a', '#1e2026'], boot: ['#9aa0ac', '#3a3c44'], bootTop: 20, metal: ['#eef0f6', '#9aa0ac', '#4a4e5a'], scarf: ['#4a4e5a', '#1a1c20'], glove: ['#8a8e98', '#30323a'], hat: 'yelmo', capelet: 0, bracer: 'hierro', belts: 'cinto', cape: 'carmesi', plates: true },
  e_monje:      { coat: ['#4a3a5a', '#2a2036', '#0e0a14'], hem: 35, open: false, vest: ['#1c1028', '#0e0814'], shirt: '#2e1a40', pants: ['#2a2036', '#0e0a14'], boot: ['#2a2036', '#0e0a14'], bootTop: 32, metal: ['#f0d890', '#b08a3a', '#5e4218'], scarf: ['#2a2036', '#0e0a14'], glove: ['#9a8a78', '#5a4a3c'], hat: 'capucha', hood: ['#5a4a6a', '#2e2238', '#0e0a14'], eye: '#c9a0ff', capelet: 1, belts: 'cordon' },
  e_sacerdote:  { coat: ['#2e2830', '#16121a', '#060408'], hem: 35, open: false, vest: ['#a8282c', '#4e1018'], shirt: '#ece4d8', pants: ['#1a161c', '#07040a'], boot: ['#1a161c', '#07040a'], bootTop: 32, metal: ['#fff4c8', '#d4b05a', '#5e4218'], scarf: ['#a8282c', '#4e1018'], glove: ['#c8c0b4', '#7a7268'], capelet: 2, belts: 'cordon', headFn: EN_HEADS.mitra, skin: ['#c8c0b4', '#7a7268'], eye: '#ff3a3a', stole: true },
});

// cuadro de un humano: pose = función que devuelve brazos, arma y balanceo
function hdHumanFrame(id, ph, atk, pose) {
  const P = pose(ph, atk);
  const k = P.k ?? Math.sin(ph * TAU), lf = P.lf ?? Math.max(0, Math.cos(ph * TAU)) * 3, lb = P.lb ?? Math.max(0, -Math.cos(ph * TAU)) * 3;
  const sw = P.sw ?? -k * 2, bob = P.bob ?? (-Math.abs(Math.cos(ph * TAU)) * 1 + 0.5), lean = P.lean ?? 0;
  const S = HD_STYLE[id];
  return makeSprite(80, g => {
    g.translate(0, 1);
    g.save(); g.translate(0, bob); g.rotate(lean);
    hdCape(g, id, sw);
    if (!P.lhFront) { hdArm(g, id, -5, -17, P.lh[0], P.lh[1], true); if (P.backItem) P.backItem(g); }
    hdCoatBack(g, id, sw);
    g.restore();
    hdLegs(g, id, k, lf, lb);
    g.translate(0, bob); g.rotate(lean);
    hdTorso(g, id, sw);
    if (S.ragged) { g.fillStyle = S.coat[2]; for (let x = -10; x <= 10; x += 2.6) g.fillRect(x + sw * 0.5, S.hem - 1 + ((x * 7) % 3), 1.4, 3); }
    if (S.plates) {
      // hombreras y peto de placas
      hdPoly(g, [[-5, -18], [6, -18], [5.5, -4], [-4.5, -4]], hdLin(g, -5, -18, 6, -4, ['#eef0f6', '#9aa0ac', '#4a4e5a']), 1);
      hdLine(g, [[0.5, -17], [0.5, -5]], '#4a4e5a', 0.7); hdLine(g, [[-3, -15], [-2, -8]], 'rgba(255,255,255,0.6)', 0.6);
    }
    if (S.studs) for (let y = -16; y < 10; y += 3.2) for (let x = -5; x <= 6; x += 3.4) { g.fillStyle = '#9aa0ac'; g.fillRect(x, y, 0.8, 0.8); }
    if (S.stole) { hdPoly(g, [[-1.4, -19], [1.6, -19], [2, 30], [-1, 30]], hdLin(g, 0, -19, 0, 30, ['#d4483c', '#7a1a22'])); for (const y of [0, 14, 26]) { g.fillStyle = S.metal[1]; g.fillRect(-0.8, y, 2.4, 0.8); g.fillRect(0, y - 0.8, 0.8, 2.4); } }
    if (P.lhFront) { hdArm(g, id, -3, -17, P.lh[0], P.lh[1], false); }
    if (P.itemBehind) P.item(g);
    hdArm(g, id, 6, -17, P.rh[0], P.rh[1], false);
    if (!P.itemBehind && P.item) P.item(g);
    hdCapelet(g, id, sw);
    hdHead(g, id);
    if (P.after) P.after(g);
  });
}

// poses de cada humano
const HD_HUMANS = {
  aldeano: ['e_aldeano', (ph, atk) => {
    const s = Math.sin(ph * TAU), ay = atk ? -30 : -6 + s;
    return { lean: 0.1, rh: atk ? [9, -27] : [11, -5 + s], lh: [-9, 3 - s], item: g => EN_ITEMS.antorcha(g, atk ? 9 : 11, atk ? -27 : -5 + s, -1.45, ph) };
  }],
  lanzador: ['e_lanzador', (ph, atk) => {
    const s = Math.sin(ph * TAU);
    return { lean: 0.05, rh: atk ? [3, -31] : [11, -3 + s], lh: [-9, 2], item: g => EN_ITEMS.botella(g, atk ? 3 : 11, atk ? -33 : -5 + s, 0, ph) };
  }],
  bombero: ['e_bombero', (ph, atk) => {
    const s = Math.sin(ph * TAU);
    return { lean: 0.16, k: s * 1.25, sw: -s * 3, rh: atk ? [10, -29] : [13, -9 + s * 2], lh: [-10, -4 - s * 2], item: g => EN_ITEMS.bomba(g, atk ? 10 : 13, atk ? -31 : -11 + s * 2, 0, ph) };
  }],
  tirador: ['e_tirador', (ph, atk) => {
    const s = Math.sin(ph * TAU);
    if (atk) return { k: 0.3, lf: 0, lb: 0, sw: 0, bob: 0, rh: [6, -14], lh: [14, -15], lhFront: true, itemBehind: true, item: g => EN_ITEMS.mosquete(g, 4, -15, -0.04) };
    return { rh: [9, -8 + s * 0.5], lh: [5, -16], lhFront: true, itemBehind: true, item: g => EN_ITEMS.mosquete(g, 8, -6 + s * 0.5, -1.15) };
  }],
  ballestero: ['e_ballestero', (ph, atk) => {
    const s = Math.sin(ph * TAU);
    if (atk) return { k: 0.25, lf: 0, lb: 0, sw: 0, bob: 0, rh: [5, -15], lh: [13, -14], lhFront: true, itemBehind: true, item: g => EN_ITEMS.ballesta(g, 4, -15, 0, ph, true) };
    return { rh: [9, -2 + s * 0.5], lh: [-9, 2], item: g => EN_ITEMS.ballesta(g, 9, -2 + s * 0.5, 1.2, ph, true) };
  }],
  escudero: ['e_escudero', (ph, atk) => {
    const s = Math.sin(ph * TAU) * 0.7;
    return { k: s, rh: atk ? [4, -28] : [10, 0 + s], lh: [9, -10], lhFront: true, item: g => EN_ITEMS.maza(g, atk ? 4 : 10, atk ? -28 : s, atk ? -2.3 : 1.1) };
  }],
  monje: ['e_monje', (ph, atk) => {
    const s = Math.sin(ph * TAU) * 0.5;
    return { k: s, sw: -s, rh: atk ? [8, -30] : [10, -6], lh: [-8, 0], item: g => EN_ITEMS.campana(g, atk ? 8 : 10, atk ? -30 : -6, 0, ph) };
  }],
  sacerdote: ['e_sacerdote', (ph, atk) => {
    const s = Math.sin(ph * TAU) * 0.5;
    return { k: s, sw: -s, rh: atk ? [8, -18] : [9, 2], lh: atk ? [-6, -24] : [-8, 0], itemBehind: true, item: g => EN_ITEMS.incensario(g, atk ? 8 : 9, atk ? -18 : 2, 0, ph),
      after: atk ? g => { g.fillStyle = 'rgba(255,60,60,0.5)'; g.beginPath(); g.arc(-6, -25, 3.5, 0, TAU); g.fill(); g.fillStyle = '#ff8a7a'; g.fillRect(-7, -26, 2, 2); } : null };
  }],
};

// --- bestias
function hdQuadLeg(g, x, y, fx, fy, w, cols, claw = '#e2dccd', knee = 1) {
  const kx = (x + fx) / 2 - 2 * knee, ky = (y + fy) / 2 + 0.5;
  hdLimb(g, [[x, y], [kx, ky]], hdLin(g, x - 3, y, x + 3, y, cols), w);
  hdLimb(g, [[kx, ky], [fx, fy]], cols[1], w * 0.7);
  g.fillStyle = claw; for (let i = 0; i < 3; i++) g.fillRect(fx + 0.4 + i * 1.1, fy + 0.6, 0.7, 1.2);
}
const HD_BEASTS = {
  // sabueso famélico: costillas marcadas, lomo de espinas y fauces largas
  sabueso: [64, 22, 16, (g, ph, atk) => {
    const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU), cr = atk ? 3 : 0, by = 2 + cr + c * 0.8;
    const F = ['#7a4438', '#3a1c16'];
    hdQuadLeg(g, -11, by + 2, -13 - s * 5, 21, 3.4, ['#5a2e26', '#2a1410']);
    hdQuadLeg(g, 9, by + 2, 8 + s * 5, 21, 3.4, ['#5a2e26', '#2a1410'], '#e2dccd', -1);
    hdLimb(g, [[-15, by - 1], [-21, by - 6 + c * 2], [-22, by - 12 + c * 3]], '#4a2620', 2.2);
    g.fillStyle = OL7; g.beginPath(); g.ellipse(-1, by, 16, 7.6, -0.05, 0, TAU); g.fill();
    g.fillStyle = hdLin(g, 0, by - 7, 0, by + 7, [F[0], F[1]]); g.beginPath(); g.ellipse(-1, by, 15, 6.8, -0.05, 0, TAU); g.fill();
    for (const x of [-7, -4, -1, 2, 5]) hdLine(g, [[x, by - 4], [x + 1.2, by + 1], [x, by + 5]], 'rgba(20,6,4,0.65)', 0.8);
    for (const x of [-6, -3, 0, 3]) hdLine(g, [[x + 0.8, by - 3.6], [x + 1.6, by + 0.6]], 'rgba(255,190,170,0.25)', 0.6);
    g.fillStyle = '#2a1410'; for (let i = -12; i <= 8; i += 2.6) { g.beginPath(); g.moveTo(i - 1.4, by - 5.4); g.lineTo(i + 0.4, by - 11 - (i % 3)); g.lineTo(i + 1.6, by - 5.4); g.fill(); }
    hdQuadLeg(g, -8, by + 3, -9 + s * 5, 22, 3.8, F);
    hdQuadLeg(g, 12, by + 3, 12 - s * 5, 22, 3.8, F, '#e2dccd', -1);
    // cabeza
    const hx = 17, hy = by - 4 + (atk ? 2 : 0);
    hdPoly(g, [[hx - 6, hy - 5], [hx + 2, hy - 6], [hx + 12, hy - 1.5], [hx + 12, hy + 2], [hx + 2, hy + 4.5], [hx - 6, hy + 4]], hdLin(g, hx - 6, hy - 6, hx + 12, hy + 4, ['#8a5040', '#4a2620']), 1);
    hdPoly(g, [[hx - 3, hy - 4.6], [hx - 1, hy - 12], [hx + 2.4, hy - 5]], '#3a1c16', 0.8);
    g.fillStyle = '#ffd23c'; g.fillRect(hx + 2, hy - 3, 2, 1.4); g.fillStyle = '#fff4c8'; g.fillRect(hx + 2.4, hy - 3, 0.8, 0.8);
    const jaw = atk ? 4 : 1.2;
    hdPoly(g, [[hx + 1, hy + 1.6], [hx + 12, hy + 1.6], [hx + 10, hy + 2 + jaw], [hx + 1, hy + 4.4]], '#140806');
    hdPoly(g, [[hx + 1, hy + 2 + jaw * 0.6], [hx + 10, hy + 2 + jaw], [hx + 9, hy + 3.6 + jaw], [hx + 1, hy + 5 + jaw * 0.4]], '#4a2620', 0.8);
    g.fillStyle = '#e2dccd'; for (let x = hx + 3; x < hx + 11; x += 2) { g.fillRect(x, hy + 1.6, 0.8, 1.6); g.fillRect(x + 1, hy + 2 + jaw - 1, 0.8, 1.4); }
    g.fillStyle = '#07040a'; g.fillRect(hx + 11, hy - 1.4, 1.4, 1.2);
  }],
  // bestia de la niebla: erguida, encorvada, brazos largos con garras y pelaje en mechones
  bestia: [96, 32, 44, (g, ph, atk) => {
    const s = Math.sin(ph * TAU), up = atk ? -14 : 0;
    const F = ['#7a5e48', '#4a3628', '#1e140e'];
    hdQuadLeg(g, -6, 10, -8 - s * 4, 30, 6, ['#4a3628', '#241a12'], '#e2dccd', 1);
    hdLimb(g, [[-10, -10], [-19 + s * 2, 2 + up], [-20 + s * 3, 16 + up]], hdLin(g, -20, 0, -10, 0, [F[1], F[2]]), 5.4);
    g.fillStyle = '#e2dccd'; for (let i = 0; i < 4; i++) g.fillRect(-22 + s * 3 + i * 1.4, 17 + up, 0.9, 3);
    // tronco peludo
    const pts = [];
    for (let i = 0; i <= 24; i++) { const a = i / 24 * TAU, r = (i % 2 ? 15 : 17.5) + Math.sin(i * 1.7) * 1.2; pts.push([Math.cos(a) * r * 0.85, -4 + Math.sin(a) * r * 1.05 + s * 0.4]); }
    hdPoly(g, pts, hdLin(g, -14, -20, 14, 14, F), 1.2);
    for (let i = 0; i < 16; i++) { const a = -2.6 + i * 0.32, r = 6 + (i % 3) * 3; hdLine(g, [[Math.cos(a) * r * 0.7, -6 + Math.sin(a) * r], [Math.cos(a) * (r + 6) * 0.8, -4 + Math.sin(a) * (r + 6)]], i % 2 ? 'rgba(20,12,8,0.7)' : 'rgba(200,160,120,0.25)', 0.8); }
    hdQuadLeg(g, 5, 10, 6 + s * 4, 31, 6.4, F, '#e2dccd', -1);
    // brazo delantero
    hdLimb(g, [[9, -11], [20 - s * 2, -1 + up * 1.2], [22 - s * 3, 13 + up * 1.3]], hdLin(g, 9, 0, 22, 0, F), 6);
    g.fillStyle = '#e2dccd'; for (let i = 0; i < 4; i++) { g.fillRect(20 - s * 3 + i * 1.6, 15 + up * 1.3, 1, 4); g.fillRect(20 - s * 3 + i * 1.6, 18.5 + up * 1.3, 0.6, 1); }
    // cabeza con cuernos y fauces
    const hx = 9, hy = -22 + s * 0.5 + (atk ? -2 : 0);
    hdPoly(g, [[hx - 2, hy - 4], [hx - 6, hy - 14], [hx - 7, hy - 22], [hx - 3, hy - 13], [hx + 1, hy - 6]], '#c8c2b4', 0.9);
    hdPoly(g, [[hx + 4, hy - 6], [hx + 7, hy - 15], [hx + 11, hy - 20], [hx + 8, hy - 12], [hx + 7, hy - 5]], '#aaa496', 0.9);
    g.fillStyle = OL7; g.beginPath(); g.ellipse(hx + 2, hy, 9.6, 8, 0, 0, TAU); g.fill();
    g.fillStyle = hdLin(g, hx - 6, hy - 7, hx + 9, hy + 7, ['#8a6a52', '#4a3628']); g.beginPath(); g.ellipse(hx + 2, hy, 8.8, 7.2, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffd23c'; g.fillRect(hx + 2, hy - 3, 2.4, 1.6); g.fillRect(hx + 6.4, hy - 2.6, 2.2, 1.6);
    g.fillStyle = '#fff4c8'; g.fillRect(hx + 2.4, hy - 3, 0.8, 0.8); g.fillRect(hx + 6.8, hy - 2.6, 0.8, 0.8);
    const jaw = atk ? 5 : 2.4;
    hdPoly(g, [[hx + 1, hy + 2], [hx + 11, hy + 1], [hx + 10, hy + 2 + jaw], [hx + 2, hy + 3 + jaw]], '#140806');
    g.fillStyle = '#e2dccd'; for (let x = hx + 2; x < hx + 10; x += 1.8) { g.fillRect(x, hy + 1.6, 0.9, 1.8); g.fillRect(x + 0.8, hy + 1.6 + jaw, 0.9, 1.6); }
  }],
  // bestia desollada: músculo al aire, tendones y espinas de hueso
  desollado: [72, 23, 14, (g, ph, atk) => {
    const s = Math.sin(ph * TAU), cr = atk ? 3 : 0, by = 4 + cr;
    const M = ['#c8504e', '#8a2a2c', '#3a0c10'];
    hdQuadLeg(g, -12, by + 2, -14 - s * 5, 22, 4, ['#7a2224', '#3a0c10'], '#e2dccd');
    hdQuadLeg(g, 10, by + 2, 9 + s * 5, 22, 4, ['#7a2224', '#3a0c10'], '#e2dccd', -1);
    g.fillStyle = OL7; g.beginPath(); g.ellipse(-1, by, 17, 8.4, -0.08, 0, TAU); g.fill();
    g.fillStyle = hdLin(g, 0, by - 8, 0, by + 8, M); g.beginPath(); g.ellipse(-1, by, 16, 7.6, -0.08, 0, TAU); g.fill();
    for (const x of [-10, -6, -2, 2, 6]) { hdLine(g, [[x, by - 6], [x + 2.4, by], [x + 0.6, by + 6]], '#e8ccb0', 0.8); hdLine(g, [[x + 1, by - 5], [x + 3, by + 0.5]], 'rgba(255,160,150,0.5)', 0.5); }
    for (let x = -13; x <= 7; x += 3.4) hdPoly(g, [[x - 1.2, by - 6.6], [x + 0.6, by - 14 - (x % 2)], [x + 1.6, by - 6.6]], '#e2dccd', 0.6);
    hdQuadLeg(g, -9, by + 3, -10 + s * 5, 23, 4.6, M, '#e2dccd');
    hdQuadLeg(g, 13, by + 3, 13 - s * 5, 23, 4.6, M, '#e2dccd', -1);
    const hx = 17, hy = by - 5;
    hdPoly(g, [[hx - 5, hy - 5], [hx + 4, hy - 6], [hx + 11, hy - 1], [hx + 10, hy + 3], [hx + 1, hy + 5], [hx - 5, hy + 4]], hdLin(g, hx - 5, hy - 5, hx + 11, hy + 4, ['#d4605a', '#7a2224']), 1);
    g.fillStyle = '#e2dccd'; g.beginPath(); g.ellipse(hx + 4, hy - 2, 3, 2.4, 0, 0, TAU); g.fill();
    g.fillStyle = '#ff4040'; g.fillRect(hx + 4, hy - 2.6, 1.4, 1.2);
    const jaw = atk ? 4 : 1.4;
    hdPoly(g, [[hx + 2, hy + 1.4], [hx + 11, hy + 0.6], [hx + 9.6, hy + 1.6 + jaw], [hx + 2, hy + 3.6 + jaw * 0.5]], '#1a0406');
    g.fillStyle = '#f6f0e2'; for (let x = hx + 3; x < hx + 10; x += 1.7) { g.fillRect(x, hy + 1, 0.8, 1.6); g.fillRect(x + 0.6, hy + 0.6 + jaw, 0.8, 1.4); }
  }],
  // bestia saltadora: ancas enormes plegadas, lista para brincar
  saltador: [72, 23, 16, (g, ph, atk) => {
    const s = Math.sin(ph * TAU), cr = atk ? 5 : Math.max(0, s) * 2, by = 2 + cr;
    const F = ['#7a6248', '#4e3c2a', '#1e160e'];
    // anca trasera lejana
    hdLimb(g, [[-6, by + 2], [-16, by + 1], [-14, 20], [-8, 21]], hdLin(g, -16, 0, -6, 0, [F[1], F[2]]), 5);
    g.fillStyle = OL7; g.beginPath(); g.ellipse(0, by, 14.5, 11 - cr * 0.3, 0, 0, TAU); g.fill();
    g.fillStyle = hdLin(g, -10, by - 10, 10, by + 10, F); g.beginPath(); g.ellipse(0, by, 13.6, 10.2 - cr * 0.3, 0, 0, TAU); g.fill();
    for (let i = -8; i <= 8; i += 2.4) hdPoly(g, [[i - 1.3, by - 8], [i + 0.3, by - 13.5 - (i % 2)], [i + 1.4, by - 8]], '#2a1e14', 0.6);
    g.fillStyle = 'rgba(200,170,120,0.3)'; for (let i = 0; i < 6; i++) g.fillRect(-7 + i * 2.4, by - 2 + (i % 2) * 3, 1.4, 0.8);
    // anca cercana, enorme
    hdLimb(g, [[-2, by + 3], [-12, by + 4], [-9, 21], [-1, 22]], hdLin(g, -12, 0, -2, 0, F), 6.4);
    g.fillStyle = '#e2dccd'; for (let i = 0; i < 3; i++) g.fillRect(-1 + i * 1.2, 22.4, 0.8, 1.4);
    hdQuadLeg(g, 7, by + 4, 12 + s * 2, 21, 3.4, F, '#e2dccd', -1);
    const hx = 12, hy = by - 6;
    hdPoly(g, [[hx - 5, hy - 5], [hx + 4, hy - 5.4], [hx + 10, hy - 1], [hx + 9, hy + 3.6], [hx - 4, hy + 4]], hdLin(g, hx - 5, hy - 5, hx + 10, hy + 4, ['#8a7258', '#4e3c2a']), 1);
    g.fillStyle = '#ffd23c'; g.fillRect(hx + 1.6, hy - 3, 2, 1.6); g.fillStyle = '#fff4c8'; g.fillRect(hx + 2, hy - 3, 0.8, 0.8);
    hdPoly(g, [[hx + 2, hy + 1], [hx + 10, hy], [hx + 9, hy + 1.6 + (atk ? 3 : 1)], [hx + 2, hy + 2.6]], '#140806');
    g.fillStyle = '#e2dccd'; for (let x = hx + 3; x < hx + 9; x += 1.8) g.fillRect(x, hy + 0.6, 0.8, 1.4);
  }],
  // escupidor de bilis: saco hinchado, pústulas que brillan
  escupidor: [64, 21, 18, (g, ph, atk) => {
    const s = Math.sin(ph * TAU), puff = atk ? 1.18 : 1 + s * 0.04;
    const F = ['#7a9a4a', '#4a6230', '#1a2a14'];
    for (const [x, k] of [[-9, s], [-2, -s], [6, s]]) hdQuadLeg(g, x, 10, x + k * 3, 21, 3.2, ['#3a4a24', '#1a2a14'], '#c8c2b4');
    g.save(); g.scale(puff, puff);
    const pts = []; for (let i = 0; i <= 20; i++) { const a = i / 20 * TAU; pts.push([Math.cos(a) * (14 + Math.sin(i * 2.3) * 1.2), 1 + Math.sin(a) * (12 + Math.cos(i * 1.7))]); }
    hdPoly(g, pts, hdLin(g, -12, -10, 12, 12, F), 1.2);
    for (const [x, y, r] of [[-6, 2, 2.2], [-2, 7, 1.6], [-9, -3, 1.8], [3, 4, 1.4], [-4, -6, 1.2], [6, 8, 1.2]]) {
      g.fillStyle = '#2a3a18'; g.beginPath(); g.arc(x, y, r + 0.6, 0, TAU); g.fill();
      g.fillStyle = atk ? '#c8ffa0' : '#9ad86a'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = '#f6ffe8'; g.fillRect(x - r * 0.5, y - r * 0.6, 0.8, 0.8);
    }
    g.restore();
    const hx = 9, hy = -8;
    g.fillStyle = OL7; g.beginPath(); g.ellipse(hx, hy, 8.6, 7.6, 0, 0, TAU); g.fill();
    g.fillStyle = hdLin(g, hx - 6, hy - 6, hx + 6, hy + 6, ['#8aa858', '#4a6230']); g.beginPath(); g.ellipse(hx, hy, 7.8, 6.8, 0, 0, TAU); g.fill();
    g.fillStyle = '#e0d870'; g.fillRect(hx - 3, hy - 4, 2, 1.6); g.fillRect(hx + 1.6, hy - 4.6, 2, 1.6);
    g.fillStyle = '#140a04'; g.beginPath(); g.ellipse(hx + 5, hy + 1.6, 3.4, atk ? 4 : 2.4, 0, 0, TAU); g.fill();
    if (atk) { g.fillStyle = '#9aff6a'; g.beginPath(); g.arc(hx + 6, hy + 1.6, 2, 0, TAU); g.fill(); }
    hdLine(g, [[hx + 3, hy + 4], [hx + 3.6, hy + 7]], '#9ad86a', 0.8);
  }],
};

// tabla de dibujo: tamaño del lienzo, dónde están los pies y dónde la cabeza (para la barra de vida)
const HD_EN = {};
for (const [type, [id, pose]] of Object.entries(HD_HUMANS)) {
  HD_EN[type] = { size: 80, feet: 37, top: 40 };
  for (let i = 0; i < 4; i++) { SPR[type + '_' + i] = hdHumanFrame(id, i / 4, false, pose); SPR[type + '_' + i].hd = true; }
  SPR[type + '_w'] = hdHumanFrame(id, 0.25, true, pose); SPR[type + '_w'].hd = true;
  SPR[type] = SPR[type + '_0'];
}
for (const [type, [size, feet, top, fn]] of Object.entries(HD_BEASTS)) {
  HD_EN[type] = { size, feet, top };
  for (let i = 0; i < 4; i++) { SPR[type + '_' + i] = makeSprite(size, g => fn(g, i / 4, false)); SPR[type + '_' + i].hd = true; }
  SPR[type + '_w'] = makeSprite(size, g => fn(g, 0.25, true)); SPR[type + '_w'].hd = true;
  SPR[type] = SPR[type + '_0'];
}
// dibujo de un enemigo HD: tamaño y desplazamiento para que los pies queden en el suelo
function hdEnemyDraw(e, T) {
  const H = HD_EN[e.type];
  if (!H || e.sprite) return null;
  const k = (e.size || T.size) / T.size;
  return { size: H.size * k, oy: e.r * 0.6 - H.feet * k, top: e.r * 0.6 - (H.feet + H.top) * k };
}

function tintOf(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(200,20,40,0.38)'; g.fillRect(0, 0, c.width, c.height);
  return c;
}
const FLASH = {}, TINT = {};
// todo el arte pasa por la misma terminación fina: un píxel por unidad y la paleta HD
for (const k of Object.keys(SPR)) SPR[k] = SPR[k].hd ? pixelArt(SPR[k], 1, HD_PAL, 0.16, 7) : pixelArt(SPR[k], 1, HD_PAL, 0.22, 10);
for (const k of Object.keys(SPR)) { FLASH[k] = flashOf(SPR[k]); TINT[k] = tintOf(SPR[k]); }
// el cazador aliado: mismo porte, teñido de azul espectral
const ALLY_SPR = (() => {
  const c = document.createElement('canvas'); c.width = SPR.player.width; c.height = SPR.player.height;
  const g = c.getContext('2d'); g.drawImage(SPR.player, 0, 0);
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(110,170,255,0.45)'; g.fillRect(0, 0, c.width, c.height);
  return c;
})();

// Suelo empedrado (patrón que se repite sin costuras)
const ground = document.createElement('canvas');
ground.width = ground.height = 160;
(function buildGround() {
  const g = ground.getContext('2d');
  g.fillStyle = '#121016'; g.fillRect(0, 0, 160, 160);
  const shades = ['#1b1820', '#1e1a23', '#211c26', '#19161d', '#231e28'];
  for (let row = 0; row < 8; row++) {
    for (let col = -1; col <= 8; col++) {
      const x = col * 20 + (row % 2 ? 10 : 0), y = row * 20;
      const h = hash((col + 8) % 8, row);
      g.fillStyle = shades[h % shades.length];
      const r = 4;
      g.beginPath();
      g.moveTo(x + 1 + r, y + 1); g.arcTo(x + 19, y + 1, x + 19, y + 19, r); g.arcTo(x + 19, y + 19, x + 1, y + 19, r);
      g.arcTo(x + 1, y + 19, x + 1, y + 1, r); g.arcTo(x + 1, y + 1, x + 19, y + 1, r); g.closePath(); g.fill();
      if (h % 7 === 0) { g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 5, y + 6); g.lineTo(x + 11, y + 12); g.lineTo(x + 15, y + 11); g.stroke(); }
    }
  }
})();
const groundPattern = ctx.createPattern(ground, 'repeat');

// ---------------------------------------------------------------- Definiciones
const ETYPES = {
  aldeano:    { name: 'Aldeano poseído', r: 11, hp: 10, speed: 52, dmg: 6, xp: 1, size: 40, cat: 'humano' },
  sabueso:    { name: 'Sabueso famélico', r: 11, hp: 9, speed: 100, dmg: 7, xp: 2, size: 44, lunge: true, cat: 'bestia' },
  murcielago: { name: 'Murciélago de campanario', r: 8, hp: 5, speed: 115, dmg: 5, xp: 1, size: 36, cat: 'bestia' },
  bestia:     { name: 'Bestia de la niebla', r: 18, hp: 55, speed: 46, dmg: 14, xp: 4, size: 64, lunge: true, cat: 'bestia' },
  coloso:     { name: 'Coloso astado', r: 32, hp: 520, speed: 40, dmg: 24, xp: 30, size: 104, elite: true, lunge: true, cat: 'bestia' },
  desollado:  { name: 'Bestia desollada', r: 13, hp: 30, speed: 95, dmg: 12, xp: 3, size: 52, lunge: true, cat: 'bestia' },
  sepulturero: { name: 'El Sepulturero hueco', r: 42, hp: 3600, speed: 40, dmg: 26, xp: 70, size: 130, elite: true, boss: true, lunge: true, cat: 'humano' },
  campanario: { name: 'Bestia del Campanario Rojo', r: 48, hp: 5200, speed: 44, dmg: 30, xp: 80, size: 150, elite: true, boss: true, lunge: true, cat: 'bestia' },
  // horrores cósmicos: solo salen durante las grietas (o con Lucidez muy alta)
  larva:      { name: 'Larva abisal', r: 7, hp: 6, speed: 125, dmg: 4, xp: 1, size: 34, eldritch: true, lucid: 0.012 },
  ojo:        { name: 'Ojo errante', r: 13, hp: 32, speed: 62, dmg: 8, xp: 4, size: 46, eldritch: true, lucid: 0.15, shooter: true },
  tentaculo:  { name: 'Engendro tentacular', r: 20, hp: 95, speed: 38, dmg: 16, xp: 8, size: 70, eldritch: true, lucid: 0.35, lunge: true },
  heraldo:    { name: 'Heraldo sin rostro', r: 40, hp: 1400, speed: 34, dmg: 28, xp: 50, size: 130, eldritch: true, elite: true, lucid: 1, lucidN: 5, summoner: true, lunge: true },
  // a distancia (modo normal)
  tirador:    { name: 'Vigilante con mosquete', r: 11, hp: 16, speed: 55, dmg: 6, xp: 3, size: 44, cat: 'humano', ranged: 'shot' },
  lanzador:   { name: 'Aldeano incendiario', r: 11, hp: 14, speed: 50, dmg: 6, xp: 2, size: 40, cat: 'humano', ranged: 'fire' },
  // con patrones y roles (inspirados en el diseño de enemigos de los shooters de mazmorras)
  monje:      { name: 'Monje de la campana', r: 12, hp: 26, speed: 30, dmg: 6, xp: 3, size: 46, cat: 'humano', ranged: 'ring' },
  escupidor:  { name: 'Escupidor de bilis', r: 12, hp: 22, speed: 45, dmg: 6, xp: 3, size: 46, cat: 'bestia', ranged: 'spit' },
  ballestero: { name: 'Ballestero de la guardia', r: 11, hp: 18, speed: 50, dmg: 6, xp: 3, size: 44, cat: 'humano', ranged: 'bolt' },
  escudero:   { name: 'Escudero con pavés', r: 14, hp: 45, speed: 42, dmg: 12, xp: 4, size: 50, cat: 'humano', shield: true, lunge: true },
  bombero:    { name: 'Fanático de la pólvora', r: 10, hp: 10, speed: 125, dmg: 0, xp: 2, size: 40, cat: 'humano', bomber: true },
  sacerdote:  { name: 'Sacerdote de sangre', r: 12, hp: 30, speed: 45, dmg: 5, xp: 5, size: 48, cat: 'humano', healer: true },
  saltador:   { name: 'Bestia saltadora', r: 15, hp: 40, speed: 55, dmg: 14, xp: 4, size: 56, cat: 'bestia', leaper: true },
  // jefes del modo normal (cada 6 niveles)
  caido:      { name: 'El Cazador Caído', r: 20, hp: 1700, speed: 80, dmg: 13, xp: 60, size: 70, elite: true, boss: true, lunge: true, cat: 'humano' },
  hambre:     { name: 'El Hambre del Matadero', r: 26, hp: 3000, speed: 95, dmg: 14, xp: 70, size: 96, elite: true, boss: true, lunge: true, cat: 'bestia' },
  penitente:  { name: 'La Penitente de Ceniza', r: 44, hp: 6500, speed: 62, dmg: 26, xp: 90, size: 150, elite: true, boss: true, lunge: true, cat: 'bestia' },
  durmiente:  { name: 'La Durmiente del Lago', r: 40, hp: 6000, speed: 22, dmg: 20, xp: 90, size: 130, elite: true, boss: true, eldritch: true, lucid: 1, lucidN: 4 },
  eclipse:    { name: 'El Señor del Eclipse', r: 34, hp: 8500, speed: 70, dmg: 24, xp: 120, size: 130, elite: true, boss: true, eldritch: true, lucid: 1, lucidN: 6, lunge: true },
  acechante:  { name: 'Acechador del velo', r: 16, hp: 70, speed: 58, dmg: 20, xp: 6, size: 64, eldritch: true, hidden: true, lucid: 0.5 },
};

const RARITIES = [
  { name: 'Común',      color: '#b8b0a0', w: 52 },
  { name: 'Poco común', color: '#5fbf6a', w: 27 },
  { name: 'Raro',       color: '#4f8fe0', w: 13 },
  { name: 'Legendario', color: '#e0a030', w: 6 },
  { name: 'Mítico',     color: '#c24fe0', w: 2 },
];
const NEUTRAL = '#8a6a5a';

// Armas de fuego: disparan balas a lo que entre en el radio de detección
const GUNS = {
  chispa:   { name: 'Pistola de chispa',      icon: '🔫', rarity: 0, dmg: 11, cd: 0.85, count: 1, pierce: 1, spread: 0.12, speed: 560, life: 0.9, elem: 'fuego', ammo: 1, desc: 'Fiable pero lenta. Sus chispas queman.' },
  revolver: { name: 'Revólver de plata',      icon: '🔫', rarity: 1, dmg: 15, cd: 0.6,  count: 1, pierce: 1, spread: 0.1,  speed: 620, life: 0.9, elem: 'bendito', ammo: 1, desc: 'Balas de plata bendita y recarga ágil.' },
  escopeta: { name: 'Escopeta recortada',     icon: '💥', rarity: 2, dmg: 9,  cd: 1.05, count: 5, pierce: 1, spread: 0.55, speed: 520, life: 0.5, short: true, elem: 'dentado', ammo: 2, desc: 'Perdigones que desgarran a corta distancia.' },
  carabina: { name: 'Carabina de repetición', icon: '🎯', rarity: 3, dmg: 17, cd: 0.3,  count: 1, pierce: 3, spread: 0.06, speed: 720, life: 1.0, elem: 'fisico', ammo: 0.34, desc: 'Cadencia altísima y gasta poca munición; atraviesa 3 bestias.' },
  eter:     { name: 'Trueno de éter',         icon: '⚡', rarity: 4, dmg: 28, cd: 0.7,  count: 2, pierce: 2, spread: 0.15, speed: 600, life: 1.0, boom: 55, elem: 'rayo', ammo: 2, desc: 'Balas que estallan en descargas de rayo.' },
};
function gunStats(w) {
  const d = GUNS[w.id], l = w.level;
  return applyMods('gun', {
    dmg: d.dmg * (1 + 0.2 * (l - 1)), cd: d.cd * (1 - 0.06 * (l - 1)),
    count: d.count + Math.floor((l - 1) / 2) * (d.count >= 5 ? 2 : 1),
    pierce: d.pierce + (l >= 4 ? 1 : 0), spread: d.spread, speed: d.speed, life: d.life, short: !!d.short, boom: d.boom || 0, elem: d.elem, ammo: d.ammo,
  });
}
// Gemas engarzadas y papeles alteran daño, recarga y tipo de daño del arma
function applyMods(kind, s) {
  if (!G || !G.sock) return s;
  const gs = G.sock[kind], paper = G.player.paper;
  s.dmg *= 1 + 0.06 * plusOf(G.player[kind].id); // mejora permanente +1..+10 del refugio
  s.dmg *= 1 + gs.dmg / 100;
  s.cd *= 1 - gs.cdr / 100;
  if (gs.conv) s.elem = gs.conv;
  if (paper) { s.elem = paper.elem; s.dmg *= 1.2; }
  return s;
}

// Armas cuerpo a cuerpo transformables: golpean solas cuando una bestia se acerca.
// Cada una tiene dos formas; con Espacio se alterna y el primer golpe tras transformar pega más.
const MELEES = {
  cuchillo: { name: 'Cuchillo de carnicero', icon: '🔪', rarity: 0, desc: 'Se despliega en un machete largo.', forms: [
    { name: 'Cuchillo', elem: 'fisico', dmg: 14, cd: 0.55, reach: 62, arc: 1.7, kb: 120 },
    { name: 'Machete desplegado', elem: 'dentado', dmg: 22, cd: 0.8, reach: 86, arc: 2.0, kb: 180 }] },
  hacha: { name: 'Hacha de leñador', icon: '🪓', rarity: 1, desc: 'El mango se extiende para barrer en círculo.', forms: [
    { name: 'Hacha corta', elem: 'fisico', dmg: 24, cd: 0.85, reach: 74, arc: 2.1, kb: 240 },
    { name: 'Hacha de asta larga', elem: 'dentado', dmg: 30, cd: 1.1, reach: 104, arc: 4.4, kb: 280 }] },
  estoque: { name: 'Estoque de plata', icon: '🤺', rarity: 2, desc: 'Se encastra en su vaina y se vuelve una maza.', forms: [
    { name: 'Estoque', elem: 'bendito', dmg: 18, cd: 0.3, reach: 86, arc: 0.8, kb: 80 },
    { name: 'Maza envainada', elem: 'fisico', dmg: 34, cd: 0.75, reach: 70, arc: 2.3, kb: 340 }] },
  guadana: { name: 'Guadaña ritual', icon: '🌙', rarity: 3, desc: 'De hoz doble a guadaña completa.', forms: [
    { name: 'Hoz doble', elem: 'dentado', dmg: 20, cd: 0.38, reach: 72, arc: 2.5, kb: 120 },
    { name: 'Guadaña desplegada', elem: 'arcano', dmg: 28, cd: 0.7, reach: 98, arc: TAU, kb: 200 }] },
  eclipse: { name: 'Espadón del eclipse', icon: '🗡️', rarity: 4, desc: 'Desenvainado, libera ondas de rayo.', forms: [
    { name: 'Espada envainada', elem: 'bendito', dmg: 36, cd: 0.5, reach: 90, arc: 2.0, kb: 220 },
    { name: 'Espadón liberado', elem: 'rayo', dmg: 52, cd: 0.85, reach: 118, arc: 2.8, kb: 320, wave: true }] },
};
function meleeStats(w) {
  const f = MELEES[w.id].forms[w.form || 0], l = w.level;
  return applyMods('melee', { name: f.name, dmg: f.dmg * (1 + 0.22 * (l - 1)), cd: f.cd * 1.3 * D().meleeCd * (1 - 0.05 * (l - 1)), reach: f.reach * (1 + 0.06 * (l - 1)), arc: Math.min(TAU, f.arc * (1 + 0.08 * (l - 1))), kb: f.kb * 0.35, wave: !!f.wave, elem: f.elem });
}
const CATALOG = { gun: GUNS, melee: MELEES };

// Tipos de daño y debilidades por familia de enemigo
const ELEMENTS = {
  fisico:  { name: 'Físico',  icon: '⚔' },
  fuego:   { name: 'Fuego',   icon: '🔥' },
  rayo:    { name: 'Rayo',    icon: '⚡' },
  arcano:  { name: 'Arcano',  icon: '✴' },
  dentado: { name: 'Dentado', icon: '🦷' },
  bendito: { name: 'Bendito', icon: '✝' },
};
const WEAK = {
  humano: { bendito: 1.4, fuego: 1.2 },
  bestia: { fuego: 1.5, dentado: 1.35, bendito: 0.85 },
  horror: { rayo: 1.5, bendito: 1.15, fuego: 0.8, arcano: 0.6 },
};
const CAT_LABEL = { humano: 'humanos', bestia: 'bestias', horror: 'horrores' };
function enemyCat(type) { const T = ETYPES[type]; return T.cat || (T.eldritch ? 'horror' : 'bestia'); }
function effMul(e, elem) { const w = WEAK[enemyCat(e.type)]; return (w && elem && w[elem]) || 1; }
function elemTag(elem) {
  if (!elem) return '';
  const el = ELEMENTS[elem];
  const strong = Object.keys(WEAK).filter(c => (WEAK[c][elem] || 1) > 1).map(c => CAT_LABEL[c]);
  return `<span class="elem">${el.icon} ${el.name}${strong.length ? ' · fuerte contra ' + strong.join(' y ') : ''}</span>`;
}
const KIND_LABEL = { gun: 'arma de fuego', melee: 'arma cuerpo a cuerpo' };

// Herramientas: armas secundarias (hasta 3) que suben de nivel
const TOOL_DEFS = {
  farol: {
    name: 'Faroles errantes', icon: '🏮',
    desc: ['Llamas que orbitan a tu alrededor.', '+1 llama.', '+40% daño y mayor radio.', '+1 llama.', '+1 llama y giran más rápido.'],
    stats: l => ({ count: [1, 2, 2, 3, 4][l - 1], dmg: [8, 8, 11, 11, 13][l - 1], radius: [58, 58, 72, 72, 78][l - 1], spin: [2.6, 2.6, 2.8, 2.8, 3.6][l - 1] }),
  },
  campana: {
    name: 'Campana del vigía', icon: '🔔',
    desc: ['Una onda sagrada empuja y daña todo a tu alrededor.', '+25% radio.', '+50% daño.', 'Suena más seguido.', '+30% radio y +40% daño.'],
    stats: l => ({ radius: [95, 120, 120, 120, 155][l - 1], dmg: [14, 14, 21, 21, 30][l - 1], cd: [3.6, 3.6, 3.6, 2.7, 2.5][l - 1] }),
  },
  fuego: {
    name: 'Frascos de brea', icon: '🧪',
    desc: ['Arroja frascos que dejan charcos de fuego.', '+1 frasco.', 'Charcos más grandes y duraderos.', '+1 frasco.', '+60% daño del fuego.'],
    stats: l => ({ count: [1, 2, 2, 3, 3][l - 1], dps: [14, 14, 14, 14, 22][l - 1], radius: [38, 38, 50, 50, 54][l - 1], dur: [2.4, 2.4, 3.4, 3.4, 3.6][l - 1], cd: [2.8, 2.6, 2.6, 2.4, 2.2][l - 1] }),
  },
};
const MAX_TOOLS = 3, MAX_LEVEL = 5;

// Reliquias y armaduras: cada una sale con una rareza que define su potencia
const RELICS = {
  vigor:    { name: 'Corazón de roble',  icon: '❤️', vals: [15, 25, 40, 60, 90],       fmt: v => `+${v} vida máxima y cura lo mismo.`, apply: (p, v) => { p.maxHp += v; p.hp = Math.min(p.maxHp, p.hp + v); } },
  botas:    { name: 'Botas de cuero',    icon: '👢', vals: [6, 10, 15, 22, 32],         fmt: v => `+${v}% velocidad de movimiento.`, apply: (p, v) => { p.speed *= 1 + v / 100; } },
  filo:     { name: 'Piedra de afilar',  icon: '⚔️', vals: [8, 13, 20, 30, 45],         fmt: v => `+${v}% daño de todas las armas.`, apply: (p, v) => { p.dmgMul += v / 100; } },
  reloj:    { name: 'Reloj de bolsillo', icon: '⏳', vals: [5, 8, 12, 17, 24],          fmt: v => `-${v}% tiempo de recarga.`, apply: (p, v) => { p.cdMul *= 1 - v / 100; } },
  brujula:  { name: 'Brújula lunar',     icon: '🧭', vals: [20, 35, 55, 80, 120],       fmt: v => `+${v}% radio para juntar fragmentos.`, apply: (p, v) => { p.magnet *= 1 + v / 100; } },
  hueso:    { name: 'Amuleto de hueso',  icon: '🦴', vals: [0.4, 0.7, 1.1, 1.6, 2.5],   fmt: v => `Regenera ${String(v).replace('.', ',')} de vida por segundo.`, apply: (p, v) => { p.regen += v; } },
  capa:     { name: 'Capa de cazador',   icon: '🧥', vals: [1, 2, 3, 4, 6],             fmt: v => `Armadura: reduce en ${v} el daño recibido.`, apply: (p, v) => { p.armor += v; } },
  catalejo: { name: 'Catalejo de vigía', icon: '🔭', vals: [12, 20, 30, 45, 65],        fmt: v => `+${v}% radio de detección del arma de fuego.`, apply: (p, v) => { p.range *= 1 + v / 100; } },
  ojo:      { name: 'Ojo de cristal',    icon: '👁️', vals: [1, 2, 3, 5, 8],             fmt: v => `+${v} de Lucidez.`, apply: (p, v) => { addLucidez(v); } },
};

// Atuendos: un conjunto puesto a la vez, con resistencias por tipo de daño
//   físico = golpes de bestias · arcano = orbes · abismal = contacto de horrores cósmicos
const ATTIRES = {
  viaje:  { name: 'Ropa de viaje',            icon: '👕', rarity: -1, res: { fisico: 0, arcano: 0, abismo: 0 }, desc: 'Ropa común, sin protección.' },
  sereno: { name: 'Capote de sereno',         icon: '🧣', rarity: 0, res: { fisico: 8, arcano: 0, abismo: 0 }, desc: 'Abrigo grueso de los guardias nocturnos.' },
  gaban:  { name: 'Gabán de rastreador',      icon: '🎩', rarity: 1, res: { fisico: 14, arcano: 6, abismo: 6 }, speed: 5, desc: 'Liviano y resistente.' },
  habito: { name: 'Hábito de la capilla',     icon: '🥼', rarity: 2, res: { fisico: 10, arcano: 28, abismo: 14 }, regen: 0.3, desc: 'Bendecido por manos piadosas.' },
  vigia:  { name: 'Coraza del vigía de hierro', icon: '🛡️', rarity: 3, res: { fisico: 35, arcano: 12, abismo: 12 }, speed: -6, desc: 'Pesada, pero casi nada la atraviesa.' },
  velo:   { name: 'Velo del observatorio',    icon: '🕸️', rarity: 4, res: { fisico: 18, arcano: 35, abismo: 45 }, lucid: 3, desc: 'Tejido por quienes miraron demasiado al cielo.' },
};
const RES_LABEL = { fisico: 'física', arcano: 'arcana', abismo: 'abismal' };
function attireDesc(a) {
  const parts = Object.entries(a.res).filter(([, v]) => v > 0).map(([k, v]) => `${v}% ${RES_LABEL[k]}`);
  let s = parts.length ? 'Resistencia ' + parts.join(', ') + '.' : 'Sin resistencias.';
  if (a.speed) s += ` ${a.speed > 0 ? '+' : ''}${a.speed}% velocidad.`;
  if (a.regen) s += ` Regenera ${String(a.regen).replace('.', ',')} vida/s.`;
  if (a.lucid) s += ` +${a.lucid} Lucidez al ponértelo.`;
  return s;
}

// Amuletos grabados: 3 ranuras; si están llenas, elegís cuál reemplazar
const AMULET_SLOTS = 3;
const AMULETS = {
  marea:     { name: 'Sello de la marea',      icon: '🌊', stat: 'rally',    vals: [20, 35, 55, 80, 120], fmt: v => `+${v}% vida recuperada al contraatacar.` },
  juramento: { name: 'Sello del juramento',    icon: '🕯️', stat: 'gun',      vals: [8, 13, 20, 30, 45],   fmt: v => `+${v}% daño de armas de fuego.` },
  sangre:    { name: 'Sello de la hoja roja',  icon: '🩸', stat: 'melee',    vals: [8, 13, 20, 30, 45],   fmt: v => `+${v}% daño cuerpo a cuerpo.` },
  aliento:   { name: 'Sello del aliento',      icon: '🌬️', stat: 'speed',    vals: [4, 7, 10, 14, 20],    fmt: v => `+${v}% velocidad de movimiento.` },
  frio:      { name: 'Sello de la sangre fría', icon: '❄️', stat: 'visceral', vals: [20, 35, 55, 80, 120], fmt: v => `+${v}% daño visceral y aturdimientos más largos.` },
  pergamino: { name: 'Sello del estudioso',    icon: '📜', stat: 'xp',       vals: [8, 13, 20, 30, 45],   fmt: v => `+${v}% experiencia de los fragmentos.` },
  plenilunio:{ name: 'Sello del plenilunio',   icon: '🌕', stat: 'regen',    vals: [0.3, 0.5, 0.8, 1.2, 1.8], fmt: v => `Regenera ${String(v).replace('.', ',')} de vida por segundo.` },
  velado:    { name: 'Sello del ojo velado',   icon: '🧿', stat: 'horror',   vals: [12, 20, 30, 45, 65],  fmt: v => `+${v}% daño contra horrores cósmicos.` },
};
function recalcAmulets() {
  const am = { rally: 0, gun: 0, melee: 0, speed: 0, visceral: 0, xp: 0, regen: 0, horror: 0 };
  for (const a of G.amulets) { const d = AMULETS[a.id]; am[d.stat] += d.vals[a.rarity]; }
  G.am = am;
}

// ---------------------------------------------------------------- Gemas (2 ranuras por categoría de arma)
// Las ranuras pertenecen a la categoría (fuego / cuerpo a cuerpo): si cambiás de arma, las gemas se quedan.
const GEM_SLOTS = 2;
const GEMS = {
  filo:     { name: 'Gema de filo',      icon: '🔶', stat: 'dmg',    vals: [6, 10, 15, 22, 32],  fmt: v => `+${v}% daño de esta arma.` },
  caza:     { name: 'Gema del cazador',  icon: '🟤', stat: 'beast',  vals: [10, 16, 24, 35, 50], fmt: v => `+${v}% daño contra bestias.` },
  votiva:   { name: 'Gema votiva',       icon: '🟣', stat: 'horror', vals: [10, 16, 24, 35, 50], fmt: v => `+${v}% daño contra horrores.` },
  marea:    { name: 'Gema de la marea',  icon: '🔵', stat: 'rally',  vals: [15, 25, 40, 60, 90], fmt: v => `+${v}% vida recuperada con esta arma.` },
  pulso:    { name: 'Gema del pulso',    icon: '⚪', stat: 'cdr',    vals: [4, 7, 10, 14, 20],   fmt: v => `-${v}% recarga de esta arma.` },
  veneno:   { name: 'Gema ponzoñosa',    icon: '🟢', stat: 'poison', vals: [8, 12, 18, 26, 36],  fmt: v => `Cada golpe acumula ${v} de veneno en el enemigo.` },
  ignea:    { name: 'Gema ígnea',        icon: '🔴', stat: 'dmg', conv: 'fuego',  vals: [5, 8, 12, 17, 24], fmt: v => `Convierte el daño en 🔥 Fuego y +${v}% daño.` },
  tormenta: { name: 'Gema de tormenta',  icon: '🟡', stat: 'dmg', conv: 'rayo',   vals: [5, 8, 12, 17, 24], fmt: v => `Convierte el daño en ⚡ Rayo y +${v}% daño.` },
  arcana:   { name: 'Gema arcana',       icon: '💠', stat: 'dmg', conv: 'arcano', vals: [5, 8, 12, 17, 24], fmt: v => `Convierte el daño en ✴ Arcano y +${v}% daño.` },
};
function recalcSockets() {
  const r = {};
  for (const k of ['gun', 'melee']) {
    const s = { dmg: 0, beast: 0, horror: 0, rally: 0, cdr: 0, poison: 0, conv: null };
    for (const gm of G.sockets[k]) if (gm) { const d = GEMS[gm.id]; s[d.stat] += d.vals[gm.rarity]; if (d.conv) s.conv = d.conv; }
    r[k] = s;
  }
  G.sock = r;
}
const gemLabel = gm => `${GEMS[gm.id].icon} ${GEMS[gm.id].name} (${RARITIES[gm.rarity].name})`;

// ---------------------------------------------------------------- Artes ocultas (E): una equipada, gastan balas
const ARTS = {
  rugido:   { name: 'Rugido bestial',               icon: '🐺', rarity: 0, cost: 2, cd: 4,  desc: 'Onda que daña y aparta a todo lo que te rodea, y disuelve orbes.' },
  caja:     { name: 'Caja de música rota',          icon: '🎶', rarity: 1, cost: 2, cd: 12, desc: 'Su melodía aturde a las bestias y humanos cercanos.' },
  llamado:  { name: 'Llamado de las profundidades', icon: '🦑', rarity: 2, cost: 1, cd: 3,  desc: 'Tentáculos arcanos brotan del suelo frente a vos.' },
  viento:   { name: 'Pluma del viento',             icon: '🪶', rarity: 3, cost: 1, cd: 15, desc: 'Durante 8 s esquivás sin ser visto: esquivas más largas, más baratas y +25% velocidad.' },
  andanada: { name: 'Andanada estelar',             icon: '🌠', rarity: 4, cost: 3, cd: 5,  desc: 'Ocho proyectiles arcanos buscan a los enemigos.' },
};
const ART_MAX = 3;

// ---------------------------------------------------------------- Cinturón de objetos (F usar, C cambiar)
const ITEMS = {
  molotov:    { name: 'Cóctel incendiario',    icon: '🍾', desc: 'Deja un charco de fuego donde cae.' },
  cuchillos:  { name: 'Cuchillos arrojadizos', icon: '🗡', desc: 'Tres cuchillos dentados en abanico.' },
  apestoso:   { name: 'Cóctel apestoso',       icon: '🧴', desc: 'Atrae a los enemigos comunes a donde cae durante 8 s.' },
  papelFuego: { name: 'Papel ígneo',           icon: '🧧', desc: '30 s: tus armas hacen 🔥 Fuego y +20% daño.' },
  papelRayo:  { name: 'Papel de tormenta',     icon: '🎫', desc: '30 s: tus armas hacen ⚡ Rayo y +20% daño.' },
  sedante:    { name: 'Sedante',               icon: '💊', desc: 'Cura la locura y el veneno; 10 s de calma.' },
  bestial:    { name: 'Sangre de bestia',      icon: '🫀', desc: '30 s de bestialidad: más daño cuerpo a cuerpo que crece con cada golpe, pero recibís +30% daño.' },
  campana:    { name: 'Campana de llamada',    icon: '🛎️', desc: 'Invoca a un cazador aliado que pelea a tu lado durante 30 s.' },
};
const BELT = Object.keys(ITEMS);
const ITEM_DROP = [['molotov', 4], ['cuchillos', 4], ['apestoso', 2], ['papelFuego', 1.5], ['papelRayo', 1.5], ['sedante', 2.5], ['bestial', 1], ['campana', 0.4]];
function randomItem() {
  let tot = 0; for (const [, w] of ITEM_DROP) tot += w;
  let x = Math.random() * tot;
  for (const [id, w] of ITEM_DROP) { if ((x -= w) <= 0) return id; }
  return 'molotov';
}

// ---------------------------------------------------------------- Atuendos por piezas
const PIECES = { cabeza: 'Cabeza', torso: 'Torso', brazos: 'Brazos', piernas: 'Piernas' };
const PIECE_IDS = Object.keys(PIECES);
function outfitRes(type) { let s = 0; for (const k of PIECE_IDS) s += (ATTIRES[G.player.outfit[k]].res[type] || 0) / 4; return s; }
function fullSet() {
  const o = G.player.outfit, id = o.cabeza;
  return id !== 'viaje' && PIECE_IDS.every(k => o[k] === id) ? id : null;
}
function setBonus(stat) { const id = fullSet(); return id ? (ATTIRES[id][stat] || 0) : 0; }
function setCount(id) { return PIECE_IDS.filter(k => G.player.outfit[k] === id).length; }

// ---------------------------------------------------------------- Progreso entre partidas (guardado local)
const SAVE_KEY = 'vellmoor_save_v1';
const ATTRS = {
  vit: { name: 'Vitalidad', icon: '❤', desc: '+8 de vida máxima por punto.' },
  agu: { name: 'Aguante',   icon: '🫁', desc: '+6 de aguante máximo y recuperación más rápida.' },
  fue: { name: 'Fuerza',    icon: '💪', desc: '+4% daño cuerpo a cuerpo.' },
  des: { name: 'Destreza',  icon: '🎯', desc: '+4% daño de armas de fuego.' },
  san: { name: 'Sangre',    icon: '🩸', desc: '+1 de munición máxima y +3% vida recuperada.' },
  arc: { name: 'Arcano',    icon: '✴', desc: '+4% poder de artes y herramientas y algo más de suerte.' },
};
const PROVISIONS = [
  { id: 'vials',   icon: '⚗', name: '+3 viales iniciales',          cost: 60 },
  { id: 'molotov', icon: '🍾', name: '+2 cócteles incendiarios',      cost: 40 },
  { id: 'sedante', icon: '💊', name: '+1 sedante',                    cost: 50 },
  { id: 'campana', icon: '🛎️', name: 'Campana de llamada (aliado)',  cost: 120 },
];
// Dificultad: cambia mucho más que la vida de los enemigos
const DIFFS = {
  cazador:   { name: 'Cazador', icon: '🗡', desc: 'Ya es exigente: enemigos más duros y rápidos, menos invulnerabilidad tras un golpe.',
               hp: 1.25, dmg: 1.3, spd: 1.08, count: 1.15, invuln: 0.42, rallyDelay: 0.6, rallyDecay: 30, meleeCd: 1.15, heal: 0.08, vials: 3, elite: 1.3, eliteFrom: 3, ai: 0, bullet: 1.1, reward: 1 },
  pesadilla: { name: 'Pesadilla', icon: '💀', desc: 'Élites desde el nivel 1, IA un escalón más astuta, casi sin curación entre niveles y balas más rápidas.',
               hp: 1.6, dmg: 1.6, spd: 1.15, count: 1.3, invuln: 0.32, rallyDelay: 0.5, rallyDecay: 40, meleeCd: 1.3, heal: 0.04, vials: 2, elite: 2, eliteFrom: 1, ai: 1, bullet: 1.2, reward: 1.6 },
  sangre:    { name: 'Sangre de luna', icon: '🩸', desc: 'Lo más difícil posible: el doble de vida y daño enemigo, IA al máximo desde el principio, sin curación entre niveles y un solo vial.',
               hp: 2.0, dmg: 2.0, spd: 1.22, count: 1.45, invuln: 0.25, rallyDelay: 0.4, rallyDecay: 55, meleeCd: 1.45, heal: 0, vials: 1, elite: 3, eliteFrom: 1, ai: 3, bullet: 1.3, reward: 2.4 },
};
function D() { return DIFFS[(typeof SAVE !== 'undefined' && SAVE.difficulty) || 'pesadilla'] || DIFFS.pesadilla; }

function defaultSave() {
  return {
    essence: 0, fragments: 0, lost: 0, checkpoint: 1, difficulty: 'pesadilla',
    attrs: { vit: 0, agu: 0, fue: 0, des: 0, san: 0, arc: 0 },
    plus: {}, unlocked: { gun: ['chispa'], melee: ['cuchillo'] }, startGun: 'chispa', startMelee: 'cuchillo',
    next: { vials: 0, molotov: 0, sedante: 0, campana: 0 },
    stats: { runs: 0, wins: 0, best: 0, bosses: 0, kills: 0 },
  };
}
let SAVE = defaultSave();
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) { const s = JSON.parse(raw), d = defaultSave(); SAVE = { ...d, ...s, attrs: { ...d.attrs, ...s.attrs }, next: { ...d.next, ...s.next }, stats: { ...d.stats, ...s.stats }, unlocked: { ...d.unlocked, ...s.unlocked }, plus: s.plus || {} }; }
    else SAVE = defaultSave();
  } catch (e) { SAVE = defaultSave(); }
}
function storeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { /* sin almacenamiento: el progreso dura la sesión */ } }
loadSave();
const attrTotal = () => Object.values(SAVE.attrs).reduce((a, b) => a + b, 0);
const attrCost = () => Math.round(50 * Math.pow(1.13, attrTotal()));
const plusOf = id => SAVE.plus[id] || 0;
const plusCost = id => plusOf(id) + 1;
function unlockWeapon(kind, id) {
  if (!SAVE.unlocked[kind].includes(id)) { SAVE.unlocked[kind].push(id); storeSave(); return true; }
  return false;
}

function xpFor(l) { return Math.floor(4 + (l - 1) * 3 + Math.pow(l - 1, 1.5) * 1.2); }

// ---------------------------------------------------------------- Estado
let state = 'menu';
let G = null;
// Escala de poder: en la noche es el reloj; en las criptas depende de la profundidad y la sala
function ST() { return G && G.mode === 'stage' ? (G.stage.n - 1) * 26 : G ? G.t : 0; }
let EID = 0;

function newRun(real = true) {
  G = {
    t: 0, kills: 0, shake: 0, lucidFlash: 0,
    cam: { x: 0, y: 0 },
    player: {
      x: 0, y: 0, r: 12, speed: 160, hp: 100, maxHp: 100, xp: 0, level: 1, nextXp: xpFor(1),
      invuln: 0, face: 1, dirX: 1, dirY: 0, magnet: 120, range: 260, alert: false, dmgMul: 1, cdMul: 1, regen: 0, armor: 0,
      lucidez: 0, moving: false, anim: 0, rally: 0, rallyDelay: 0,
      stamina: 100, maxStamina: 100, stamDelay: 0, dodgeT: 0, dodgeX: 0, dodgeY: 0,
      vials: 5, maxVials: 20, vialCd: 0, ammo: 20, maxAmmo: 20, bloodCd: 0,
      art: null, windT: 0, paper: null, beastT: 0, beastStacks: 0, sedT: 0,
      madness: 0, poison: 0, poisonT: 0,
      belt: { molotov: 2, cuchillos: 0, apestoso: 0, papelFuego: 0, papelRayo: 0, sedante: 1, bestial: 0, campana: 0 }, beltSel: 0,
      gun: { id: SAVE.startGun, level: 1, timer: 0.4 },
      melee: { id: SAVE.startMelee, level: 1, timer: 0, form: 0, bonus: false, trickCd: 0 },
      outfit: { cabeza: 'viaje', torso: 'viaje', brazos: 'viaje', piernas: 'viaje' },
      tools: [],
      meleeMul: 1, gunMul: 1, arcMul: 1, rallyMul: 1, stamRegen: 1,
    },
    essence: 0, fragments: 0, allies: [], trace: null, lostAtStart: SAVE.lost,
    enemies: [], projectiles: [], ebullets: [], gems: [], pickups: [], effects: [], pools: [], particles: [], texts: [],
    relics: [], amulets: [], am: null, replacing: null, muzzle: null,
    hazards: [], ghosts: [], phase: 0, bossSpawned: false, bossKilled: false,
    sockets: { gun: [null, null], melee: [null, null] }, sock: null, gemQueue: [], modal: null,
    lure: null, lurkAcc: 0,
    spawnAcc: 0, nextElite: 120, hordes: [180, 300, 420],
    rift: { active: false, next: 75, end: 0, count: 0, acc: 0 },
    pendingLevels: 0, options: [], banner: null,
  };
  recalcAmulets();
  recalcSockets();
  // atributos del refugio
  const p = G.player, A = SAVE.attrs;
  p.maxHp = p.hp = 100 + 8 * A.vit;
  p.maxStamina = p.stamina = 100 + 6 * A.agu; p.stamRegen = 1 + 0.04 * A.agu;
  p.meleeMul = 1 + 0.04 * A.fue; p.gunMul = 1 + 0.04 * A.des;
  p.maxAmmo = p.ammo = 20 + A.san; p.rallyMul = 1 + 0.03 * A.san;
  p.arcMul = 1 + 0.04 * A.arc;
  if (!real) return; // escena de fondo del menú: no consume provisiones ni rastro
  // provisiones compradas para esta partida
  const N = SAVE.next;
  p.vials += N.vials; p.belt.molotov += N.molotov; p.belt.sedante += N.sedante; p.belt.campana += N.campana;
  SAVE.next = { vials: 0, molotov: 0, sedante: 0, campana: 0 };
  // rastro de la esencia perdida en la muerte anterior
  if (SAVE.lost > 0) {
    const a = rand(0, TAU), d = rand(500, 850);
    G.trace = { x: Math.cos(a) * d, y: Math.sin(a) * d, amount: SAVE.lost };
    SAVE.lost = 0; // si no lo recuperás en esta partida, se pierde para siempre
  }
  storeSave();
  setBanner(G.trace ? 'Tu rastro de sangre te espera en algún lugar de la ciudad…' : 'La cacería comienza. Sobreviví hasta el amanecer.', 4);
}

// Espacio: transforma el arma cuerpo a cuerpo
function transformMelee() {
  const w = G.player.melee;
  if (w.trickCd > 0) return;
  w.form = w.form ? 0 : 1;
  w.bonus = true;
  w.timer = Math.min(w.timer, 0.05);
  w.trickCd = 0.5;
  const p = G.player;
  addText(p.x, p.y - 30, meleeStats(w).name, '#e8dcc4');
  G.effects.push({ kind: 'trick', life: 0.3, max: 0.3 });
  sfx('trick');
}

// Shift: esquiva rápida (gasta aguante, breve invulnerabilidad)
function dodge() {
  const p = G.player;
  const wind = p.windT > 0, cost = wind ? 15 : 25;
  if (p.dodgeT > 0 || p.stamina < cost) return;
  p.stamina -= cost; p.stamDelay = 0.6;
  let dx = p.dirX, dy = p.dirY;
  if (!p.moving) { dx = p.face; dy = 0; }
  p.dodgeX = dx; p.dodgeY = dy; p.dodgeT = wind ? 0.28 : 0.2;
  p.invuln = Math.max(p.invuln, wind ? 0.55 : 0.3);
  sfx('dodge');
}

// Q: vial curativo (40% de la vida máxima)
function useVial() {
  const p = G.player;
  if (p.vials <= 0 || p.vialCd > 0 || p.hp >= p.maxHp) return;
  p.vials--; p.vialCd = 0.6;
  const heal = Math.min(p.maxHp - p.hp, p.maxHp * 0.4);
  p.hp += heal;
  addText(p.x, p.y - 30, '+' + Math.round(heal), '#7be38a');
  burst(p.x, p.y, 10, '#c4304a');
  sfx('vial');
}

// R: balas de sangre (30% de la vida máxima a cambio de 5 balas; esa vida se puede recuperar contraatacando)
function bloodBullets() {
  const p = G.player;
  if (p.bloodCd > 0 || p.ammo >= p.maxAmmo) return;
  const cost = p.maxHp * 0.3;
  if (p.hp <= cost + 1) { addText(p.x, p.y - 30, 'Muy poca vida', '#ff8a8a'); sfx('empty'); return; }
  p.hp -= cost;
  p.rally = Math.min(p.rally + cost, p.maxHp - p.hp); p.rallyDelay = 1.5;
  p.ammo = Math.min(p.maxAmmo, p.ammo + 5);
  p.bloodCd = 0.8;
  addText(p.x, p.y - 30, '+5 balas', '#ff6a6a');
  burst(p.x, p.y, 14, '#9a0f22');
  sfx('reload');
}

// Puede verse este enemigo? (los acechadores del velo solo con Lucidez 10+)
function canSee(e) { return !ETYPES[e.type].hidden || G.player.lucidez >= 10; }

function facingTarget(range) {
  const p = G.player, t = nearestEnemies(p.x, p.y, 1, range)[0];
  if (t) return { x: t.x, y: t.y, ang: Math.atan2(t.y - p.y, t.x - p.x) };
  const ang = Math.atan2(p.dirY, p.dirX);
  return { x: p.x + Math.cos(ang) * 160, y: p.y + Math.sin(ang) * 160, ang };
}

// E: arte oculta equipada
function useArt() {
  const p = G.player, a = p.art;
  if (!a || a.cd > 0) return;
  const d = ARTS[a.id];
  if (p.ammo < d.cost) { addText(p.x, p.y - 30, `Faltan balas (${d.cost})`, '#ff8a8a'); sfx('empty'); return; }
  p.ammo -= d.cost;
  a.cd = d.cd * (1 - 0.15 * (a.level - 1));
  const pw = (1 + 0.35 * (a.level - 1)) * (1 + p.lucidez * 0.03) * (1 + ST() / 400);
  if (a.id === 'rugido') {
    for (const e of G.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x, dy = e.y - p.y, dd = Math.hypot(dx, dy) || 1;
      if (dd < 150 + e.r) hurtEnemy(e, 30 * pw, dx / dd, dy / dd, 520, 'art', undefined, 'fisico');
    }
    for (const b of G.ebullets) if (dist2(b.x, b.y, p.x, p.y) < 150 * 150) b.dead = true;
    damageStructures(p.x, p.y, 150, 30 * pw);
    G.effects.push({ kind: 'roar', x: p.x, y: p.y, r: 150, life: 0.35, max: 0.35 });
    G.shake = 0.3; sfx('elite');
  } else if (a.id === 'caja') {
    for (const e of G.enemies) {
      if (e.dead || enemyCat(e.type) === 'horror') continue;
      if (dist2(e.x, e.y, p.x, p.y) < 240 * 240) { e.wind = 0; e.dash = 0; e.stun = e.elite ? 0.8 : 2.2; }
    }
    G.effects.push({ kind: 'notes', x: p.x, y: p.y, life: 1.2, max: 1.2 });
    sfx('bell');
  } else if (a.id === 'llamado') {
    const tg = facingTarget(320), ux = Math.cos(tg.ang), uy = Math.sin(tg.ang);
    for (let i = 0; i < 5; i++) {
      const tx = p.x + ux * (50 + i * 45) + rand(-12, 12), ty = p.y + uy * (50 + i * 45) + rand(-12, 12);
      G.effects.push({ kind: 'tentacle', x: tx, y: ty, life: 0.5, max: 0.5 });
      for (const e of G.enemies) if (!e.dead && dist2(e.x, e.y, tx, ty) < (38 + e.r) ** 2) hurtEnemy(e, 32 * pw, ux, uy, 200, 'art', undefined, 'arcano');
    }
    sfx('rift');
  } else if (a.id === 'viento') {
    p.windT = 8;
    addText(p.x, p.y - 30, 'Pluma del viento', '#d8f0ff');
    sfx('trick');
  } else if (a.id === 'andanada') {
    const ts = nearestEnemies(p.x, p.y, 8, 520);
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * TAU;
      G.projectiles.push({ kind: 'astral', x: p.x, y: p.y, vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260, target: ts.length ? ts[i % ts.length] : null, dmg: 35 * pw, life: 1.8, r: 7 });
    }
    sfx('lucid');
  }
}

// F: usar el objeto seleccionado del cinturón · C: cambiar de objeto
function cycleItem() {
  const p = G.player;
  for (let i = 1; i <= BELT.length; i++) {
    const idx = (p.beltSel + i) % BELT.length;
    if (p.belt[BELT[idx]] > 0) { p.beltSel = idx; return; }
  }
}
function useItem() {
  const p = G.player;
  let id = BELT[p.beltSel];
  if (!p.belt[id]) { cycleItem(); id = BELT[p.beltSel]; if (!p.belt[id]) { sfx('empty'); return; } }
  p.belt[id]--;
  const lvl = 1 + ST() / 300;
  if (id === 'molotov') {
    const tg = facingTarget(300);
    G.projectiles.push({ kind: 'frasco', sx: p.x, sy: p.y, x: p.x, y: p.y, tx: tg.x, ty: tg.y, t: 0, dur: 0.55, s: { radius: 55, dur: 3, dps: 25 * lvl }, spin: 0 });
    sfx('toss');
  } else if (id === 'cuchillos') {
    const tg = facingTarget(360);
    for (const off of [-0.18, 0, 0.18]) {
      const ang = tg.ang + off;
      G.projectiles.push({ kind: 'bala', knife: true, x: p.x, y: p.y, vx: Math.cos(ang) * 520, vy: Math.sin(ang) * 520, ang, dmg: 18 * lvl, pierce: 2, life: 0.8, r: 6, hit: new Set(), boom: 0, elem: 'dentado', src: 'item' });
    }
    sfx('toss');
  } else if (id === 'apestoso') {
    const ang = Math.atan2(p.dirY, p.dirX);
    G.lure = { x: p.x + Math.cos(ang) * 200, y: p.y + Math.sin(ang) * 200, t: 8 };
    sfx('toss');
  } else if (id === 'papelFuego' || id === 'papelRayo') {
    p.paper = { elem: id === 'papelFuego' ? 'fuego' : 'rayo', t: 30 };
    addText(p.x, p.y - 30, ITEMS[id].name, '#ffe07a'); sfx('trick');
  } else if (id === 'sedante') {
    p.madness = 0; p.poison = 0; p.poisonT = 0; p.sedT = 10;
    addText(p.x, p.y - 30, 'Calma', '#a8e0ff'); sfx('heal');
  } else if (id === 'bestial') {
    p.beastT = 30; p.beastStacks = 0;
    addText(p.x, p.y - 30, '¡Bestialidad!', '#ff5a3a'); sfx('elite'); G.shake = 0.3;
  } else if (id === 'campana') {
    G.allies.push({ x: p.x - 40, y: p.y, t: 30, face: 1, shotT: 0.5, slashT: 0, anim: 0 });
    setBanner('Un cazador responde a la campana', 2.5, '#9ac8ff');
    sfx('bell');
  }
  if (!p.belt[id]) cycleItem();
}

// Ventana de gemas: elegir en qué ranura engarzar la gema encontrada
function openGemModal() {
  G.modal = 'gem';
  setState('levelup');
  renderGemModal();
}
function renderGemModal() {
  const gm = G.gemQueue[0], d = GEMS[gm.id];
  $('luTitle').textContent = `Encontraste ${gemLabel(gm)}`;
  const opts = [];
  for (const kind of ['gun', 'melee']) for (let s = 0; s < GEM_SLOTS; s++) {
    const cur = G.sockets[kind][s];
    opts.push({ type: 'socket', kind, slot: s, icon: d.icon, name: `${kind === 'gun' ? 'Arma de fuego' : 'Cuerpo a cuerpo'} · ranura ${s + 1}`, rarity: gm.rarity,
      tag: cur ? 'Reemplazar' : 'Ranura vacía', desc: d.fmt(d.vals[gm.rarity]) + `<div class="repl">${cur ? 'Sale: ' + gemLabel(cur) : 'Nada que reemplazar'}</div>` });
  }
  opts.push({ type: 'discard', icon: '✋', name: 'Descartar', rarity: -1, tag: 'Dejarla', desc: 'Seguir sin engarzarla.' });
  G.options = opts;
  renderCards(opts);
}

// T: tienda del velo (se paga con Lucidez)
const SHOP = [
  { id: 'vial',    icon: '⚗', name: 'Vial curativo',         cost: 1, desc: '+1 vial.' },
  { id: 'balas',   icon: '⁍', name: 'Diez balas',            cost: 1, desc: '+10 balas.' },
  { id: 'molotov', icon: '🍾', name: 'Dos cócteles incendiarios', cost: 1, desc: '+2 cócteles.' },
  { id: 'sedante', icon: '💊', name: 'Sedante',               cost: 2, desc: '+1 sedante.' },
  { id: 'papel',   icon: '🎫', name: 'Papel de tormenta',     cost: 2, desc: '+1 papel de tormenta.' },
  { id: 'gema',    icon: '💎', name: 'Gema del velo',         cost: 5, desc: 'Una gema al azar, rara o mejor.' },
  { id: 'arte',    icon: '✴', name: 'Saber oculto',          cost: 6, desc: 'Una arte oculta nueva, o mejora la tuya.' },
];
function openShop() {
  G.modal = 'shop';
  setState('levelup');
  renderShop();
}
function renderShop() {
  const p = G.player;
  $('luTitle').textContent = `Mensajeros del velo · tenés 👁 ${p.lucidez} de Lucidez`;
  const opts = SHOP.map(s => ({ type: 'buy', item: s, icon: s.icon, name: s.name, rarity: p.lucidez >= s.cost ? 2 : -1,
    tag: `Cuesta ${s.cost} de Lucidez`, desc: s.desc + (p.lucidez >= s.cost ? '' : '<div class="repl">No te alcanza</div>') }));
  opts.push({ type: 'exit', icon: '🚪', name: 'Volver a la cacería', rarity: -1, tag: 'T / Esc', desc: 'Gastar Lucidez baja su bonus de daño y suerte, pero también calma a los horrores.' });
  G.options = opts;
  renderCards(opts);
}
function buy(s) {
  const p = G.player;
  if (p.lucidez < s.cost) { sfx('empty'); return; }
  p.lucidez -= s.cost;
  if (s.id === 'vial') p.vials = Math.min(p.maxVials, p.vials + 1);
  else if (s.id === 'balas') p.ammo = Math.min(p.maxAmmo, p.ammo + 10);
  else if (s.id === 'molotov') p.belt.molotov += 2;
  else if (s.id === 'sedante') p.belt.sedante++;
  else if (s.id === 'papel') p.belt.papelRayo++;
  else if (s.id === 'gema') G.gemQueue.push({ id: pick(Object.keys(GEMS)), rarity: Math.max(2, rollRarity()) });
  else if (s.id === 'arte') {
    if (p.art && p.art.level < ART_MAX && Math.random() < 0.5) p.art.level++;
    else { const ids = Object.keys(ARTS).filter(id => !p.art || id !== p.art.id); p.art = { id: pick(ids), level: 1, cd: 0 }; }
  }
  sfx('pick');
}

function setBanner(text, time = 3, color = '#e0566b') { G.banner = { text, time, max: time, color }; }

// ---------------------------------------------------------------- Entrada
const keys = new Set();
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (!e.repeat) onKey(k);
  keys.add(k);
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); if (state === 'play') setState('pause'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') setState('pause'); });

function onKey(k) {
  if (k === 'm') { muted = !muted; return; }
  if (state === 'menu' && (k === 'enter' || k === ' ')) openHub();
  else if (state === 'hub' && k === 'enter') startStage(1);
  else if (state === 'play' && (k === 'p' || k === 'escape')) setState('pause');
  else if (state === 'play' && k === ' ') transformMelee();
  else if (state === 'play' && k === 'shift') dodge();
  else if (state === 'play' && k === 'q') useVial();
  else if (state === 'play' && k === 'r') bloodBullets();
  else if (state === 'play' && k === 'e') useArt();
  else if (state === 'play' && k === 'f') useItem();
  else if (state === 'play' && k === 'c') cycleItem();
  else if (state === 'play' && k === 't') openShop();
  else if (state === 'pause' && (k === 'p' || k === 'escape')) setState('play');
  else if (state === 'levelup' && G.modal === 'shop' && (k === 't' || k === 'escape')) { G.modal = null; setState('play'); }
  else if (state === 'levelup' && /^[1-9]$/.test(k)) choose(Number(k) - 1);
  else if (state === 'over' && k === 'enter') openHub();
  else if (state === 'over' && k === 'r') restart();
}

// ---------------------------------------------------------------- UI (DOM)
const $ = id => document.getElementById(id);
const overlays = { menu: $('menu'), hub: $('hub'), levelup: $('levelup'), pause: $('pause'), over: $('over') };
function setState(s) {
  state = s;
  for (const k in overlays) overlays[k].classList.toggle('hidden', k !== s);
}
$('startBtn').onclick = () => openHub();
$('resumeBtn').onclick = () => setState('play');
$('restartBtn').onclick = () => restart();
$('hubBtn').onclick = () => openHub();
$('huntBtn').onclick = () => startRun();
$('normalBtn').onclick = () => startStage(1);
$('quitBtn').onclick = () => { if (G && confirm('¿Abandonar? Cuenta como una muerte: perdés la mitad de la esencia de esta cacería.')) { state = 'play'; gameOver(false); } };

function startRun() { newRun(); setState('play'); sfx('toss'); }
// "Cazar de nuevo" repite el mismo modo (noche o la misma profundidad de cripta)
function restart() { if (G && G.mode === 'stage') startStage(G.stage.startAt); else startRun(); }

// ---------------------------------------------------------------- El refugio (entre partidas)
let hubTab = 'normal';
function openHub() { setState('hub'); renderHub(); }
function renderHub() {
  $('hubRes').innerHTML = `◈ <b>${SAVE.essence}</b> esencia · <span class="frag">◆ <b>${SAVE.fragments}</b> fragmentos</span>` +
    (SAVE.lost ? `<br><span class="lost">Tu rastro de sangre (◈ ${SAVE.lost}) te espera en la próxima cacería</span>` : '');
  document.querySelectorAll('#hub .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === hubTab));
  let h = '';
  if (hubTab === 'attrs') {
    const cost = attrCost();
    h += `<p class="ds">Nivel de cazador: <b>${attrTotal()}</b> · cada punto cuesta ◈ ${cost} (sube con cada nivel)</p>`;
    for (const [id, a] of Object.entries(ATTRS)) {
      h += `<div class="hub-row"><div class="ic">${a.icon}</div><div class="tx"><div class="nm">${a.name}</div><div class="ds">${a.desc}</div></div>` +
        `<div class="lv">${SAVE.attrs[id]}</div><button class="sbtn" data-act="attr" data-id="${id}" ${SAVE.essence < cost ? 'disabled' : ''}>Subir · ◈ ${cost}</button></div>`;
    }
  } else if (hubTab === 'weapons') {
    h += '<p class="ds">Elegí con qué armas empezás. Las armas se desbloquean al equiparlas en una cacería. Cada mejora (+1 a +10) suma +6% de daño y cuesta fragmentos.</p><div class="hub-cols">';
    for (const kind of ['gun', 'melee']) {
      h += `<div><h3>${kind === 'gun' ? 'Armas de fuego' : 'Cuerpo a cuerpo'}</h3>`;
      for (const [id, d] of Object.entries(CATALOG[kind])) {
        const un = SAVE.unlocked[kind].includes(id), pl = plusOf(id), sel = (kind === 'gun' ? SAVE.startGun : SAVE.startMelee) === id;
        h += `<div class="hub-row${un ? '' : ' locked'}"><div class="ic">${d.icon}</div><div class="tx"><div class="nm" style="color:${RARITIES[d.rarity].color}">${d.name}${pl ? ' +' + pl : ''}</div>` +
          `<div class="ds">${un ? RARITIES[d.rarity].name : 'Encontrala en una cacería para desbloquearla'}</div></div>`;
        if (un) {
          h += `<button class="sbtn" data-act="plus" data-id="${id}" ${pl >= 10 || SAVE.fragments < plusCost(id) ? 'disabled' : ''}>${pl >= 10 ? 'Máx.' : `+1 · ◆ ${plusCost(id)}`}</button>` +
            `<button class="sbtn${sel ? ' on' : ''}" data-act="take" data-kind="${kind}" data-id="${id}">${sel ? 'Equipada' : 'Llevar'}</button>`;
        }
        h += '</div>';
      }
      h += '</div>';
    }
    h += '</div>';
  } else if (hubTab === 'prov') {
    h += '<p class="ds">Provisiones para la próxima cacería (se gastan al salir).</p>';
    for (const pv of PROVISIONS) {
      h += `<div class="hub-row"><div class="ic">${pv.icon}</div><div class="tx"><div class="nm">${pv.name}</div><div class="ds">Preparadas: ${SAVE.next[pv.id]}</div></div>` +
        `<button class="sbtn" data-act="prov" data-id="${pv.id}" ${SAVE.essence < pv.cost ? 'disabled' : ''}>Comprar · ◈ ${pv.cost}</button></div>`;
    }
  } else if (hubTab === 'normal') {
    h += '<p class="ds">Modo normal: limpiá cada mapa de enemigos para pasar al siguiente nivel y elegí una pieza de equipo (arma de fuego, cuerpo a cuerpo o atuendo). La dificultad sube con cada nivel: más enemigos, más duros, nuevos tipos y una IA más astuta. Cada 6.º nivel espera un jefe. Vencer a un jefe abre un punto de partida.</p>' +
      `<p class="ds">Mejor nivel alcanzado: <b>${SAVE.stats.bestStage || 0}</b></p><h3 class="hub-h3">Dificultad (vale para los dos modos)</h3>`;
    for (const [id, df] of Object.entries(DIFFS)) {
      const on = (SAVE.difficulty || 'pesadilla') === id;
      h += `<div class="hub-row"><div class="ic">${df.icon}</div><div class="tx"><div class="nm">${df.name}${id === 'sangre' ? ' · la más difícil' : ''}</div><div class="ds">${df.desc} Esencia ×${df.reward}.</div></div>` +
        `<button class="sbtn${on ? ' on' : ''}" data-act="diff" data-id="${id}">${on ? 'Elegida' : 'Elegir'}</button></div>`;
    }
    h += '<h3 class="hub-h3">Puntos de partida</h3>';
    const cp = SAVE.checkpoint || 1;
    for (let s = 1; s <= cp; s += BOSS_EVERY) {
      const th = stageTheme(s), picks = Math.floor((s - 1) / 2);
      h += `<div class="hub-row"><div class="ic">${s === 1 ? '🕯' : '⚑'}</div><div class="tx"><div class="nm">Empezar en el nivel ${s} · ${th.name}</div>` +
        `<div class="ds">${s === 1 ? 'Desde el principio.' : `Elegís ${picks} piezas de equipo al empezar. Jefe de la zona: ${ETYPES[stageBoss(s + BOSS_EVERY - 1)].name}.`}</div></div>` +
        `<button class="sbtn" data-act="stage" data-id="${s}">Cazar</button></div>`;
    }
    const nb = Math.ceil(cp / BOSS_EVERY) * BOSS_EVERY;
    h += `<div class="hub-row locked"><div class="ic">👑</div><div class="tx"><div class="nm">Próximo jefe: nivel ${nb}</div><div class="ds">${ETYPES[stageBoss(nb)].name}</div></div></div>`;
  } else {
    const s = SAVE.stats;
    h += `<div class="hub-row"><div class="tx">Cacerías: <b>${s.runs}</b> · Amaneceres: <b>${s.wins}</b> · Mejor tiempo: <b>${fmtTime(s.best)}</b></div></div>` +
      `<div class="hub-row"><div class="tx">Bestias abatidas en total: <b>${s.kills}</b> · Bestias del Campanario cazadas: <b>${s.bosses}</b></div></div>` +
      `<div class="hub-row"><div class="tx">Modo normal · mejor nivel: <b>${s.bestStage || 0}</b> · jefes vencidos: <b>${s.stageBosses || 0}</b></div></div>` +
      `<div class="hub-row"><div class="tx">Armas desbloqueadas: <b>${SAVE.unlocked.gun.length + SAVE.unlocked.melee.length}</b> de 10</div></div>` +
      `<div class="hub-row"><div class="tx ds">Al morir perdés la mitad de la esencia de esa cacería: queda como rastro de sangre en la siguiente. Si no lo recuperás, se pierde para siempre. Al llegar al amanecer conservás todo y +25%.</div></div>` +
      `<div class="hub-row"><button class="sbtn" data-act="reset">Borrar todo el progreso</button></div>`;
  }
  $('hubBody').innerHTML = h;
}
document.querySelectorAll('#hub .tab').forEach(b => { b.onclick = () => { hubTab = b.dataset.tab; renderHub(); }; });
$('hubBody').onclick = ev => {
  const b = ev.target.closest('button'); if (!b || b.disabled) return;
  const { act, id, kind } = b.dataset;
  if (act === 'attr') { const c = attrCost(); if (SAVE.essence >= c) { SAVE.essence -= c; SAVE.attrs[id]++; sfx('level'); } }
  else if (act === 'plus') { const c = plusCost(id); if (SAVE.fragments >= c && plusOf(id) < 10) { SAVE.fragments -= c; SAVE.plus[id] = plusOf(id) + 1; sfx('reload'); } }
  else if (act === 'take') { if (kind === 'gun') SAVE.startGun = id; else SAVE.startMelee = id; sfx('trick'); }
  else if (act === 'prov') { const pv = PROVISIONS.find(x => x.id === id); if (SAVE.essence >= pv.cost) { SAVE.essence -= pv.cost; SAVE.next[id]++; sfx('pick'); } }
  else if (act === 'stage') { storeSave(); startStage(Number(id)); return; }
  else if (act === 'diff') { SAVE.difficulty = id; sfx('elite'); }
  else if (act === 'reset') { if (confirm('¿Borrar todo el progreso del refugio? No se puede deshacer.')) { SAVE = defaultSave(); } }
  storeSave();
  renderHub();
};

function gameOver(win) {
  if (state === 'over') return;
  const p = G.player;
  // esencia: al amanecer se conserva toda (+25%); al morir, la mitad queda como rastro
  const earned = Math.floor(G.essence);
  const kept = Math.floor((win ? earned * 1.25 : earned / 2) * D().reward);
  const lostNow = win ? 0 : earned - Math.floor(earned / 2);
  SAVE.essence += kept; SAVE.fragments += G.fragments; SAVE.lost = lostNow;
  const S = SAVE.stats;
  S.runs++; if (win) S.wins++; S.best = Math.max(S.best, Math.floor(G.t)); S.kills += G.kills; if (G.bossKilled) S.bosses++;
  storeSave();
  const C = G.mode === 'stage' ? G.stage : null;
  $('overTitle').textContent = C ? `Caíste en el nivel ${C.n}` : (win ? 'Amaneció sobre Vellmoor' : 'Caíste en la noche');
  const line = (kind) => { const w = p[kind], d = CATALOG[kind][w.id]; return `<span style="color:${RARITIES[d.rarity].color}">${d.icon} ${d.name} (nv ${w.level})</span>`; };
  const tools = p.tools.map(t => `${TOOL_DEFS[t.id].icon} ${TOOL_DEFS[t.id].name} (nv ${t.level})`).join('<br>');
  $('stats').innerHTML =
    (C ? `Modo normal · <b>${stageTheme(C.n).name}</b><br>Nivel alcanzado: <b>${C.n}</b> · mejor: <b>${SAVE.stats.bestStage || 0}</b><br>` : (win ? '<b>Sobreviviste a la noche entera.</b><br>' : '')) +
    `Tiempo: <b>${fmtTime(G.t)}</b><br>` +
    (C ? '' : `Nivel alcanzado: <b>${p.level}</b><br>`) +
    `Bestias abatidas: <b>${G.kills}</b><br>` +
    `Lucidez: <b style="color:#c9a0ff">${p.lucidez}</b><br>` +
    `Esencia: <b class="gain">+${kept}</b>${win ? (C ? ' (+25% por volver con vida)' : ' (+25% por el amanecer)') : ` · <span class="loss">${lostNow} quedó en tu rastro de sangre</span>`}<br>` +
    (G.fragments ? `Fragmentos: <b class="gain">+${G.fragments}</b><br>` : '') +
    ((G.trace || G.traceLost) ? `<span class="loss">No recuperaste tu rastro anterior (◈ ${G.trace ? G.trace.amount : G.traceLost} perdidos para siempre)</span><br>` : '') +
    (G.bossSpawned ? `Bestia del Campanario Rojo: <b style="color:${G.bossKilled ? '#6fd07a' : '#e0566b'}">${G.bossKilled ? 'cazada' : (win ? 'huyó al amanecer' : 'sigue con vida')}</b><br>` : '') + '<br>' +
    `${line('gun')}<br>${line('melee')}${tools ? '<br>' + tools : ''}<br>` +
    PIECE_IDS.map(k => `${ATTIRES[p.outfit[k]].icon} ${PIECES[k]}`).join(' · ') + (fullSet() ? ` (conjunto ${ATTIRES[fullSet()].name})` : '') +
    (G.amulets.length ? '<br>' + G.amulets.map(a => `<span style="color:${RARITIES[a.rarity].color}">${AMULETS[a.id].icon} ${AMULETS[a.id].name}</span>`).join(' · ') : '') +
    (p.art ? `<br>${ARTS[p.art.id].icon} ${ARTS[p.art.id].name} (nv ${p.art.level})` : '') +
    ([...G.sockets.gun, ...G.sockets.melee].some(Boolean) ? '<br>' + [...G.sockets.gun, ...G.sockets.melee].filter(Boolean).map(g => `<span style="color:${RARITIES[g.rarity].color}">${GEMS[g.id].icon} ${GEMS[g.id].name}</span>`).join(' · ') : '');
  setState('over');
  sfx(win ? 'level' : 'die');
}

// ---------------------------------------------------------------- Rareza, suerte y subida de nivel
// La suerte crece con la Lucidez y con el paso de la noche
function luck() { return G.player.lucidez * 0.06 + ST() / 300 + SAVE.attrs.arc * 0.03; }
function rollRarity() {
  const L = luck();
  const ws = RARITIES.map((r, i) => r.w * (1 + L * i * 0.5));
  let total = ws.reduce((a, b) => a + b, 0), x = Math.random() * total;
  for (let i = 0; i < ws.length; i++) { if ((x -= ws[i]) <= 0) return i; }
  return 0;
}
// pieza de atuendo: la mitad de las veces, una que te falta de un conjunto que ya empezaste
function attireOffer() {
  const p = G.player;
  const started = Object.keys(ATTIRES).filter(id => id !== 'viaje' && setCount(id) > 0 && setCount(id) < 4);
  if (started.length && Math.random() < 0.5) {
    const id = pick(started);
    return { type: 'attire', id, piece: pick(PIECE_IDS.filter(k => p.outfit[k] !== id)) };
  }
  const r = rollRarity();
  let ids = Object.keys(ATTIRES).filter(id => ATTIRES[id].rarity === r);
  if (!ids.length) ids = Object.keys(ATTIRES).filter(id => ATTIRES[id].rarity >= 0);
  const id = pick(ids), free = PIECE_IDS.filter(k => p.outfit[k] !== id);
  return free.length ? { type: 'attire', id, piece: pick(free) } : null;
}
function weaponOffer(kind) {
  const cat = CATALOG[kind], cur = G.player[kind].id, r = rollRarity();
  let ids = Object.keys(cat).filter(id => cat[id].rarity === r && id !== cur);
  if (!ids.length) ids = Object.keys(cat).filter(id => id !== cur);
  return { type: 'swap', kind, id: pick(ids) };
}
const sameOpt = (a, b) => a.type === b.type && a.kind === b.kind && a.id === b.id;

function getOptions() {
  const p = G.player;
  const ups = [];
  if (p.gun.level < MAX_LEVEL) ups.push({ type: 'up', kind: 'gun' });
  if (p.melee.level < MAX_LEVEL) ups.push({ type: 'up', kind: 'melee' });
  for (const t of p.tools) if (t.level < MAX_LEVEL) ups.push({ type: 'toolup', id: t.id });
  const swaps = [weaponOffer('gun'), weaponOffer('melee')];
  const toolNews = [];
  if (p.tools.length < MAX_TOOLS) for (const id in TOOL_DEFS) if (!p.tools.some(t => t.id === id)) toolNews.push({ type: 'toolnew', id });
  const news = [...swaps, ...toolNews];
  const relic = () => ({ type: 'relic', id: pick(Object.keys(RELICS)), rarity: rollRarity() });
  const amulet = () => ({ type: 'amulet', id: pick(Object.keys(AMULETS)), rarity: rollRarity() });
  const attire = () => attireOffer() || relic();

  // Siempre: una mejora de lo que ya tenés + una oferta de otra arma (mejor o peor)
  const opts = [];
  if (ups.length) opts.push(pick(ups));
  opts.push(toolNews.length && Math.random() < 0.3 ? pick(toolNews) : pick(swaps));
  const art = () => {
    if (p.art && p.art.level < ART_MAX && Math.random() < 0.5) return { type: 'artup' };
    const r = rollRarity();
    let ids = Object.keys(ARTS).filter(id => ARTS[id].rarity === r && (!p.art || id !== p.art.id));
    if (!ids.length) ids = Object.keys(ARTS).filter(id => !p.art || id !== p.art.id);
    return { type: 'art', id: pick(ids) };
  };
  const roll = Math.random();
  if (roll < 0.3) opts.push(relic());
  else if (roll < 0.52) opts.push(amulet());
  else if (roll < 0.67) opts.push(attire());
  else if (roll < 0.85 || !p.art) opts.push(art());
  else {
    const rest = [...ups, ...news].filter(o => !opts.some(x => sameOpt(x, o)));
    opts.push(rest.length ? pick(rest) : relic());
  }
  while (opts.length < 3) opts.push(relic());
  return shuffle(opts).map(describe);
}

function upDesc(kind, nl) {
  if (kind === 'gun') {
    const d = GUNS[G.player.gun.id];
    let s = '+20% daño y dispara más rápido.';
    if (nl === 3 || nl === 5) s += d.count >= 5 ? ' +2 perdigones.' : ' +1 bala por disparo.';
    if (nl === 4) s += ' Atraviesa 1 bestia más.';
    return s;
  }
  return '+22% daño, más alcance, arco más amplio y golpes más rápidos (en ambas formas).';
}
function cmpRarity(a, b) {
  return a > b ? '<span class="better">▲ Rareza mayor</span>' : a < b ? '<span class="worse">▼ Rareza menor</span>' : '<span class="same">= Misma rareza</span>';
}

function describe(o) {
  const p = G.player;
  if (o.type === 'up') {
    const w = p[o.kind], d = CATALOG[o.kind][w.id];
    return { ...o, icon: d.icon, name: d.name, rarity: d.rarity, tag: `Mejora · Nivel ${w.level + 1}`, desc: upDesc(o.kind, w.level + 1) };
  }
  if (o.type === 'swap') {
    const d = CATALOG[o.kind][o.id], w = p[o.kind], cd = CATALOG[o.kind][w.id];
    const forms = d.forms
      ? `<br><i>${d.forms[0].name}</i> ${elemTag(d.forms[0].elem)}<br><i>${d.forms[1].name}</i> ${elemTag(d.forms[1].elem)}`
      : `<br>${elemTag(d.elem)}<br><span class="elem">Munición: ${d.ammo < 1 ? '1 cada 3 disparos' : d.ammo + ' por disparo'}</span>`;
    return {
      ...o, icon: d.icon, name: d.name, rarity: d.rarity, tag: `${RARITIES[d.rarity].name} · nueva ${KIND_LABEL[o.kind]}`,
      desc: `${d.desc}${forms}<div class="repl">Reemplaza: ${cd.icon} ${cd.name} (nv ${w.level}) · empieza en nv 1<br>${cmpRarity(d.rarity, cd.rarity)}</div>`,
    };
  }
  if (o.type === 'attire') {
    const d = ATTIRES[o.id], cur = ATTIRES[p.outfit[o.piece]];
    const per = Object.entries(d.res).filter(([, v]) => v > 0).map(([k, v]) => `${(v / 4).toFixed(1).replace('.0', '').replace('.', ',')}% ${RES_LABEL[k]}`).join(', ');
    const extras = [d.speed ? `${d.speed > 0 ? '+' : ''}${d.speed}% velocidad` : '', d.regen ? `regenera ${String(d.regen).replace('.', ',')}/s` : '', d.lucid ? `+${d.lucid} Lucidez` : ''].filter(Boolean).join(', ');
    const have = setCount(o.id);
    return {
      ...o, icon: d.icon, name: `${d.name}`, rarity: d.rarity, tag: `${RARITIES[d.rarity].name} · atuendo · ${PIECES[o.piece]}`,
      desc: `Resistencia ${per || 'ninguna'}.` + (extras ? `<br><span class="elem">Conjunto completo (4/4): ${extras}</span>` : '') +
        `<div class="repl">Tenés ${have}/4 de este conjunto · reemplaza ${PIECES[o.piece].toLowerCase()}: ${cur.icon} ${cur.name}</div>`,
    };
  }
  if (o.type === 'amulet') {
    const d = AMULETS[o.id];
    const full = G.amulets.length >= AMULET_SLOTS ? '<div class="repl">Ranuras llenas: vas a elegir cuál reemplazar.</div>' : `<div class="repl">Ranura ${G.amulets.length + 1} de ${AMULET_SLOTS}</div>`;
    return { ...o, icon: d.icon, name: d.name, rarity: o.rarity, tag: `${RARITIES[o.rarity].name} · amuleto`, desc: d.fmt(d.vals[o.rarity]) + full };
  }
  if (o.type === 'art') {
    const d = ARTS[o.id], cur = p.art && ARTS[p.art.id];
    return { ...o, icon: d.icon, name: d.name, rarity: d.rarity, tag: `${RARITIES[d.rarity].name} · arte oculta (E)`,
      desc: `${d.desc}<br><span class="elem">Cuesta ${d.cost} bala${d.cost > 1 ? 's' : ''} · recarga ${d.cd} s</span>` +
        (cur ? `<div class="repl">Reemplaza: ${cur.icon} ${cur.name} (nv ${p.art.level})<br>${cmpRarity(d.rarity, cur.rarity)}</div>` : '<div class="repl">Se usa con la tecla E</div>') };
  }
  if (o.type === 'artup') {
    const d = ARTS[p.art.id];
    return { ...o, icon: d.icon, name: d.name, rarity: d.rarity, tag: `Arte oculta · Nivel ${p.art.level + 1}`, desc: '+35% de poder y −15% de recarga.' };
  }
  if (o.type === 'toolnew') { const d = TOOL_DEFS[o.id]; return { ...o, icon: d.icon, name: d.name, rarity: -1, tag: '¡Nueva herramienta!', desc: d.desc[0] }; }
  if (o.type === 'toolup') { const d = TOOL_DEFS[o.id], t = p.tools.find(x => x.id === o.id); return { ...o, icon: d.icon, name: d.name, rarity: -1, tag: `Herramienta · Nivel ${t.level + 1}`, desc: d.desc[t.level] }; }
  const d = RELICS[o.id];
  return { ...o, icon: d.icon, name: d.name, tag: `${RARITIES[o.rarity].name} · reliquia`, desc: d.fmt(d.vals[o.rarity]) };
}

let choiceLockUntil = 0;
function openLevelUp() {
  setState('levelup');
  sfx('level');
  renderChoices();
}
function renderCards(opts) {
  choiceLockUntil = performance.now() + 250;
  const box = $('choices');
  box.innerHTML = '';
  box.classList.toggle('four', opts.length === 4);
  box.classList.toggle('many', opts.length > 4);
  $('luHint').textContent = 'Elegí con clic o con las teclas ' + opts.map((_, i) => i + 1).join(' / ');
  opts.forEach((o, i) => {
    const col = o.rarity >= 0 ? RARITIES[o.rarity].color : NEUTRAL;
    const b = document.createElement('button');
    b.className = 'card' + (o.rarity >= 3 ? ' shiny' : '');
    b.style.borderColor = col;
    b.style.setProperty('--rar', col);
    b.innerHTML = `<div class="key">${i + 1}</div><div class="icon">${o.icon}</div><div class="cname">${o.name}</div>` +
      `<div class="clvl" style="color:${col}">${o.tag}</div><div class="cdesc">${o.desc}</div>`;
    b.onclick = () => choose(i);
    box.appendChild(b);
  });
}
function renderChoices() {
  $('luTitle').textContent = 'El eco de la luna te fortalece';
  G.options = getOptions();
  renderCards(G.options);
}
// Ranuras de amuletos llenas: elegir cuál sacar (o quedarse como está)
function renderReplace() {
  const n = G.replacing, nd = AMULETS[n.id];
  $('luTitle').textContent = `¿Qué amuleto reemplaza ${nd.icon} ${nd.name}?`;
  G.options = G.amulets.map((a, i) => {
    const d = AMULETS[a.id];
    return { type: 'replace', slot: i, icon: d.icon, name: d.name, rarity: a.rarity, tag: `Sacar · ${RARITIES[a.rarity].name}`, desc: d.fmt(d.vals[a.rarity]) };
  });
  G.options.push({ type: 'keep', icon: '✋', name: 'Quedarme como estoy', rarity: -1, tag: 'Descartar el nuevo', desc: `Se pierde ${nd.name} (${RARITIES[n.rarity].name}).` });
  renderCards(G.options);
}
function choose(i) {
  if (state !== 'levelup' || performance.now() < choiceLockUntil) return;
  const o = G.options[i]; if (!o) return;
  const p = G.player;
  // ventanas especiales: tienda y gemas
  if (o.type === 'buy') { buy(o.item); renderShop(); return; }
  if (o.type === 'exit') { G.modal = null; setState('play'); return; }
  if (o.type === 'socket' || o.type === 'discard') {
    const gm = G.gemQueue.shift();
    if (o.type === 'socket') { G.sockets[o.kind][o.slot] = gm; recalcSockets(); sfx('lucid'); }
    if (G.gemQueue.length) renderGemModal();
    else { G.modal = null; setState('play'); p.invuln = Math.max(p.invuln, 0.6); }
    return;
  }
  if (o.type === 'art') p.art = { id: o.id, level: 1, cd: 0 };
  else if (o.type === 'artup') p.art.level++;
  else if (o.type === 'replace' || o.type === 'keep') {
    if (o.type === 'replace') { G.amulets[o.slot] = G.replacing; recalcAmulets(); }
    G.replacing = null;
  } else if (o.type === 'up') p[o.kind].level++;
  else if (o.type === 'swap') {
    p[o.kind] = o.kind === 'melee' ? { id: o.id, level: 1, timer: 0.2, form: 0, bonus: false, trickCd: 0 } : { id: o.id, level: 1, timer: 0.2 };
    if (unlockWeapon(o.kind, o.id)) setBanner(`${CATALOG[o.kind][o.id].name}: disponible en el refugio`, 3, '#ffe07a');
  }
  else if (o.type === 'toolnew') p.tools.push({ id: o.id, level: 1, timer: 0.3, angle: 0, orbs: [] });
  else if (o.type === 'toolup') p.tools.find(t => t.id === o.id).level++;
  else if (o.type === 'relic') { G.relics.push({ id: o.id, rarity: o.rarity }); RELICS[o.id].apply(p, RELICS[o.id].vals[o.rarity]); }
  else if (o.type === 'attire') {
    p.outfit[o.piece] = o.id;
    if (fullSet() === o.id) {
      setBanner(`¡Conjunto completo: ${ATTIRES[o.id].name}!`, 3, '#ffe07a');
      if (ATTIRES[o.id].lucid) addLucidez(ATTIRES[o.id].lucid);
    }
  }
  else if (o.type === 'amulet') {
    const a = { id: o.id, rarity: o.rarity };
    if (G.amulets.length < AMULET_SLOTS) { G.amulets.push(a); recalcAmulets(); }
    else { G.replacing = a; renderReplace(); return; }
  }
  if (G.modal === 'reward') { finishReward(); return; }
  G.pendingLevels--;
  if (G.pendingLevels > 0) renderChoices();
  else { setState('play'); p.invuln = Math.max(p.invuln, 0.6); }
}

// ---------------------------------------------------------------- Lucidez
function addLucidez(n) {
  const p = G.player;
  p.lucidez += n;
  G.lucidFlash = 1;
  addText(p.x, p.y - 36, `+${n} Lucidez`, '#c9a0ff');
  sfx('lucid');
  if (p.lucidez >= 10 && p.lucidez - n < 10) setBanner('Ahora ves a los acechadores del velo…', 3.5, '#c9a0ff');
  else if (p.lucidez >= 15 && p.lucidez - n < 15) setBanner('Ves lo que siempre estuvo ahí…', 3.5, '#c9a0ff');
}

// ---------------------------------------------------------------- Lógica de juego
function addText(x, y, txt, color = '#f1e6cf') {
  if (G.texts.length > 90) G.texts.shift();
  G.texts.push({ x: x + rand(-6, 6), y, txt, color, life: 0.6 });
}
function burst(x, y, n, color) {
  for (let i = 0; i < n && G.particles.length < 420; i++) {
    const a = rand(0, TAU), s = rand(40, 160);
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.55), max: 0.55, color, size: rand(1.5, 3.5) });
  }
}

function spawnPos() {
  if (G.mode === 'stage') {
    // dentro de la sala, cerca de una pared al azar
    const A = G.stage.arena, side = Math.floor(Math.random() * 4);
    return side < 2 ? [rand(A.x0 + 50, A.x1 - 50), side === 0 ? A.y0 + 50 : A.y1 - 50] : [side === 2 ? A.x0 + 50 : A.x1 - 50, rand(A.y0 + 50, A.y1 - 50)];
  }
  const p = G.player, a = rand(0, TAU), d = Math.hypot(viewW(), viewH()) / 2 + 40;
  return [p.x + Math.cos(a) * d, p.y + Math.sin(a) * d];
}

function spawnEnemy(type, x, y) {
  const T = ETYPES[type];
  if (x === undefined) [x, y] = spawnPos();
  let hpMul = T.boss ? 1 + ST() / 300 : 1 + ST() / 110, spMul = 1, dmgMul = 1;
  if (T.eldritch) hpMul *= 1 + G.player.lucidez * 0.04;
  // fases de la noche: de noche las bestias se endurecen; bajo la Luna de sangre aparecen versiones deformes
  const variant = !T.eldritch && !T.boss && G.phase === 2;
  hpMul *= D().hp; dmgMul *= D().dmg; spMul *= D().spd;
  if (!T.eldritch && !T.boss) {
    if (G.phase === 1) { hpMul *= 1.1; spMul = 1.05; }
    if (G.phase === 2) { hpMul *= 1.3; spMul = 1.15; dmgMul = 1.1; }
  }
  const e = {
    id: EID++, type, x, y, r: T.r, hp: T.hp * hpMul, maxHp: T.hp * hpMul,
    speed: T.speed * rand(0.9, 1.1) * spMul * (G.mode === 'stage' ? 1 + 0.05 * (G.ai - 1) : 1), dmg: T.dmg * (1 + ST() / 220) * dmgMul, xp: T.xp, blood: variant,
    phase2: false, special: 3,
    kx: 0, ky: 0, flash: 0, face: 1, wob: rand(0, TAU), dead: false, elite: !!T.elite, farolT: -9,
    shot: rand(1, 2.5), summon: 4,
    lungeCd: rand(1.5, 3.5), wind: 0, dash: 0, dashX: 0, dashY: 0, stun: 0,
  };
  // élites con afijos (modo normal): más vida y una o dos mejoras, con contorno dorado
  if (G.mode === 'stage' && !G.noAffix && !T.boss && !T.elite && G.stage.n >= D().eliteFrom && Math.random() < Math.min(0.5, (0.03 + 0.015 * G.stage.n) * D().elite)) {
    const pool = ['blindado', 'veloz', 'vampirico', 'explosivo', 'escudado', 'divisor'];
    const k = G.stage.n >= 18 || SAVE.difficulty === 'sangre' ? 2 : 1;
    e.affix = shuffle(pool).slice(0, k);
    e.hp = e.maxHp = e.maxHp * 2.2;
    e.size = T.size * 1.2; e.r = T.r * 1.15;
    if (e.affix.includes('blindado')) e.armor = e.maxArmor = e.maxHp * 0.6;
    if (e.affix.includes('veloz')) { e.speed *= 1.4; e.lungeCd *= 0.6; }
    if (e.affix.includes('escudado')) e.bubbleT = rand(2, 5);
  }
  G.enemies.push(e);
  return e;
}

function chooseType(t) {
  const w = [
    ['aldeano', Math.max(10 - t / 60, 3)],
    ['sabueso', t > 40 ? 3 + t / 60 : 0],
    ['murcielago', t > 90 ? 2.5 : 0],
    ['bestia', t > 150 ? 1 + t / 120 : 0],
    ['desollado', G.phase === 2 ? 2 + t / 200 : 0],
  ];
  let total = 0; for (const [, v] of w) total += v;
  let r = Math.random() * total;
  for (const [k, v] of w) { if ((r -= v) <= 0) return k; }
  return 'aldeano';
}

function spawnGroup(type, n, spread = 30) {
  const [bx, by] = spawnPos();
  for (let i = 0; i < n; i++) spawnEnemy(type, bx + rand(-spread, spread), by + rand(-spread, spread));
}

function spawnDirector(dt) {
  const t = G.t, p = G.player;
  let rate = Math.min(0.6 + t * 0.02, 15) * D().count;
  if (G.rift.active) rate *= 0.5; // durante la grieta, la ciudad se calla
  G.spawnAcc += rate * dt;
  while (G.spawnAcc >= 1) {
    G.spawnAcc -= 1;
    if (G.enemies.length >= MAX_ENEMIES) { G.spawnAcc = 0; break; }
    const type = chooseType(t);
    if (type === 'murcielago') spawnGroup('murcielago', 5);
    else spawnEnemy(type);
  }
  if (t >= G.nextElite) {
    G.nextElite += 120;
    spawnEnemy('coloso');
    if (t > 400) spawnEnemy('coloso');
    setBanner('¡Un Coloso astado despierta en la niebla!', 3);
    sfx('elite');
  }
  // acechadores del velo: invisibles sin Lucidez 10+, aparecen de a uno desde los 2:00
  if (t > 120) {
    G.lurkAcc += dt * (0.05 + t / 8000);
    if (G.lurkAcc >= 1) {
      G.lurkAcc = 0;
      if (G.enemies.filter(e => e.type === 'acechante').length < 6) spawnEnemy('acechante');
    }
  }
  if (G.hordes.length && t >= G.hordes[0]) {
    G.hordes.shift();
    const n = 34, type = t > 300 ? 'sabueso' : 'aldeano';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      spawnEnemy(type, p.x + Math.cos(a) * 420, p.y + Math.sin(a) * 420);
    }
    setBanner('¡La turba te rodea!', 3);
    sfx('elite');
  }
}

// Grietas: cada ~95 s se abre una brecha al abismo durante 22 s y salen horrores cósmicos
const RIFT_DURATION = 22, RIFT_GAP = 73, MAX_ELDRITCH = 70;
function eldritchCount() { let n = 0; for (const e of G.enemies) if (!e.dead && ETYPES[e.type].eldritch) n++; return n; }
function updateRift(dt) {
  const R = G.rift, p = G.player;
  if (!R.active && G.t >= R.next && G.t < 520) { // después de 8:40 la noche es del jefe final
    R.active = true; R.end = G.t + RIFT_DURATION; R.count++; R.acc = 0;
    const herald = R.count % 2 === 0;
    setBanner(herald ? 'La realidad se desgarra… el Heraldo sin rostro te observa' : 'La realidad se desgarra… algo antiguo despierta', 3.5, '#b07cff');
    sfx('rift');
    G.shake = 0.5;
    if (herald) spawnEnemy('heraldo');
  }
  if (R.active) {
    const rate = 0.8 + R.count * 0.25;
    R.acc += rate * dt;
    while (R.acc >= 1) {
      R.acc -= 1;
      if (eldritchCount() >= MAX_ELDRITCH || G.enemies.length >= MAX_ENEMIES + 40) { R.acc = 0; break; }
      const opts = [['larva', 4], ['ojo', R.count >= 1 ? 3 : 0], ['tentaculo', R.count >= 2 ? 2 : 0.6]];
      let tot = 0; for (const [, v] of opts) tot += v;
      let x = Math.random() * tot, type = 'larva';
      for (const [k, v] of opts) { if ((x -= v) <= 0) { type = k; break; } }
      if (type === 'larva') spawnGroup('larva', 4, 25); else spawnEnemy(type);
    }
    if (G.t >= R.end) {
      R.active = false; R.next = G.t + RIFT_GAP;
      setBanner('La grieta se cierra. Tu mente ve más allá.', 3, '#c9a0ff');
      addLucidez(1);
    }
  } else if (p.lucidez >= 15 && eldritchCount() < 25 && Math.random() < dt * Math.min(0.5, (p.lucidez - 12) * 0.02)) {
    // con mucha Lucidez, los horrores se cuelan aunque no haya grieta
    if (Math.random() < 0.6) spawnGroup('larva', 3, 20); else spawnEnemy('ojo');
  }
}

// src: 'gun' | 'melee' | 'tool'. Devuelve el daño final infligido.
function hurtEnemy(e, dmg, nx = 0, ny = 0, kb = 0, src = 'tool', color, elem) {
  if (e.dead) return 0;
  const am = G.am;
  dmg *= G.player.dmgMul * (1 + G.player.lucidez * 0.02);
  const eff = effMul(e, elem);
  dmg *= eff;
  if (!color && eff > 1) color = '#ffd24a';       // golpe a su debilidad
  else if (!color && eff < 1) color = '#8a8a8a';  // resiste ese tipo de daño
  if (src === 'gun') dmg *= (1 + am.gun / 100) * G.player.gunMul;
  if (src === 'melee') dmg *= (1 + am.melee / 100) * G.player.meleeMul;
  if (src === 'art' || src === 'tool') dmg *= G.player.arcMul;
  if (ETYPES[e.type].eldritch) dmg *= 1 + am.horror / 100;
  const p = G.player;
  if (src === 'gun' || src === 'melee') {
    // gemas engarzadas en esa categoría de arma
    const gs = G.sock[src], cat = enemyCat(e.type);
    if (cat === 'bestia') dmg *= 1 + gs.beast / 100;
    if (cat === 'horror') dmg *= 1 + gs.horror / 100;
    if (gs.poison && !(e.poisonT > 0)) {
      e.poisonB = (e.poisonB || 0) + gs.poison;
      if (e.poisonB >= 100) { e.poisonB = 0; e.poisonT = 5; addText(e.x, e.y - e.r - 14, 'ENVENENADO', '#7be38a'); }
    }
  }
  if (src === 'melee' && p.beastT > 0) { dmg *= 1.4 + p.beastStacks * 0.01; p.beastStacks = Math.min(40, p.beastStacks + 1); }
  // escudado: burbuja periódica que lo vuelve inmune
  if (e.bubble > 0) { if (Math.random() < 0.2) addText(e.x, e.y - e.r, 'INMUNE', '#9ac8ff'); return 0; }
  // escudero: el pavés frena de frente las balas y reduce los golpes
  if (ETYPES[e.type].shield && e.fa !== undefined && src !== 'trap') {
    const from = Math.atan2(p.y - e.y, p.x - e.x);
    if (Math.abs(angDiff(from, e.fa)) < 1.1) {
      if (src === 'gun' || src === 'item' || src === 'ally') { if (Math.random() < 0.3) addText(e.x, e.y - e.r, 'BLOQUEADO', '#c9ccd8'); sfx('empty'); return 0; }
      dmg *= 0.4;
    }
  }
  // blindado: la armadura absorbe el daño primero; mientras dure, no se lo puede empujar ni aturdir
  if (e.armor > 0) {
    const absorbed = Math.min(e.armor, dmg);
    e.armor -= absorbed; dmg -= absorbed; kb = 0;
    addText(e.x, e.y - e.r, Math.round(absorbed), '#ffd24a');
    if (e.armor <= 0) { addText(e.x, e.y - e.r - 16, 'ARMADURA ROTA', '#ffd24a'); e.stun = 1.2; sfx('parry'); G.hitstop = 0.06; }
    if (dmg <= 0) { e.flash = 0.06; return absorbed; }
  }
  e.hp -= dmg;
  // plegaria de la Penitente: si le hacés suficiente daño mientras reza, la interrumpís y queda aturdida
  if (e.praying > 0) {
    e.prayDmg += dmg;
    if (e.prayDmg >= e.maxHp * 0.08) { e.praying = 0; e.stun = 2.2; addText(e.x, e.y - e.r - 20, '¡PLEGARIA INTERRUMPIDA!', '#ffe07a'); sfx('parry'); }
  }
  e.flash = 0.08;
  if (kb) { const res = e.elite ? 0.15 : 1; e.kx += nx * kb * res; e.ky += ny * kb * res; }
  addText(e.x, e.y - e.r, Math.round(dmg), color);
  sfx('hit');
  if (e.hp <= 0) killEnemy(e);
  return dmg;
}

// Vida recuperable: al contraatacar enseguida, recuperás parte de lo que te sacaron
function rallyHeal(dealt, factor) {
  const p = G.player;
  if (p.rally <= 0) return;
  const heal = Math.min(p.rally, dealt * factor * (1 + G.am.rally / 100) * p.rallyMul);
  p.hp = Math.min(p.maxHp, p.hp + heal);
  p.rally -= heal;
}

// Disparo de contra: una bala que acierta durante la carga de una embestida aturde
function stunEnemy(e) {
  if (e.armor > 0) { addText(e.x, e.y - e.r - 14, 'BLINDADO', '#ffd24a'); return; }
  e.wind = 0; e.dash = 0;
  e.stun = 1.6 * (1 + G.am.visceral / 200) * (e.elite ? 0.6 : 1);
  e.lungeCd = rand(3, 5);
  addText(e.x, e.y - e.r - 14, '¡ATURDIDO!', '#ffe07a');
  burst(e.x, e.y - e.r, 10, '#ffe07a');
  sfx('parry');
}

function killEnemy(e) {
  e.dead = true;
  G.kills++;
  const T = ETYPES[e.type];
  addDecal(e.x, e.y, T.eldritch, e.elite);
  if (!G.corpses) G.corpses = [];
  const hdC = hdEnemyDraw(e, T);
  if (G.corpses.length < 40) G.corpses.push({ key: ANIM[e.type] && !e.sprite ? e.type + '_w' : (e.sprite || e.type), x: e.x, y: e.y + (hdC ? hdC.oy : 0), size: hdC ? hdC.size : (e.size || T.size), face: e.face, t: 0, max: T.boss ? 1.4 : 0.6 });
  burst(e.x, e.y - 6, T.boss ? 60 : 14, T.eldritch ? '#6a3a8a' : '#9a0f22');
  if (G.mode !== 'stage') dropGem(e.x, e.y, e.xp); // en el modo normal no hay experiencia: se progresa con equipo
  if (T.boss && G.mode === 'stage') SAVE.stats.stageBosses = (SAVE.stats.stageBosses || 0) + 1;
  // el fanático estalla igual al morir (también lastima a los enemigos cercanos)
  if (T.bomber) hazard(e.x, e.y, 80, 0.45, 18 * (1 + ST() / 220), 'fuego', 40 * (1 + ST() / 220));
  // afijos de élite al morir
  if (e.affix) {
    if (e.affix.includes('explosivo')) hazard(e.x, e.y, 75, 0.6, 14 * (1 + ST() / 220), 'fuego');
    if (e.affix.includes('divisor') && !e.child) for (let k = 0; k < 2; k++) {
      G.noAffix = true; const c = spawnEnemy(e.type, e.x + rand(-20, 20), e.y + rand(-20, 20)); G.noAffix = false;
      c.child = true; c.hp = c.maxHp = c.maxHp * 0.5; c.size = (ETYPES[e.type].size) * 0.8; c.r = e.r * 0.8;
    }
    G.essence += 15 * (1 + 0.04 * (G.stage ? G.stage.n : 0));
    if (Math.random() < 0.3) G.pickups.push({ kind: 'gem', gem: { id: pick(Object.keys(GEMS)), rarity: gemRarity() }, x: e.x, y: e.y });
  }
  G.essence += (e.xp * 0.25 * (e.blood ? 1.5 : 1) + (e.elite ? 25 : 0)) * (G.mode === 'stage' ? 1 + 0.04 * G.stage.n : 1);
  if (e.elite) G.pickups.push({ kind: 'frag', n: e.type === 'campanario' || e.type === 'sepulturero' ? 6 : e.type === 'heraldo' ? 3 : 2, x: e.x - 15, y: e.y });
  if (T.eldritch && Math.random() < T.lucid) addLucidez(T.lucidN || 1);
  if (e.elite) {
    for (let k = 0; k < 6; k++) dropGem(e.x + rand(-24, 24), e.y + rand(-24, 24), 5);
    for (let k = 0; k < 3; k++) G.pickups.push({ kind: 'vial', x: e.x + rand(-20, 20), y: e.y + rand(-20, 20) });
    G.pickups.push({ kind: 'bala', n: 10, x: e.x, y: e.y });
    G.pickups.push({ kind: 'gem', gem: { id: pick(Object.keys(GEMS)), rarity: gemRarity() }, x: e.x + 15, y: e.y });
    for (let k = 0; k < 2; k++) G.pickups.push({ kind: 'item', id: randomItem(), x: e.x + rand(-25, 25), y: e.y + rand(-25, 25) });
    burst(e.x, e.y, 40, T.eldritch ? '#6a2fa0' : '#7a0f1c');
    if (e.type === 'heraldo') setBanner('El Heraldo se disuelve en la niebla', 3, '#c9a0ff');
    if (e.type === 'campanario') {
      G.bossKilled = true;
      G.essence += 200;
      setBanner('¡Cazaste a la Bestia del Campanario Rojo!', 4, '#ffe07a');
      for (let k = 0; k < 12; k++) dropGem(e.x + rand(-50, 50), e.y + rand(-50, 50), 20);
    }
  } else {
    const r = Math.random();
    if (r < 0.025) G.pickups.push({ kind: 'vial', x: e.x, y: e.y });
    else if (r < 0.24) G.pickups.push({ kind: 'bala', n: 2, x: e.x, y: e.y });
    else if (r < 0.28) G.pickups.push({ kind: 'item', id: randomItem(), x: e.x, y: e.y });
    else if ((e.blood || e.type === 'acechante') && r < 0.30) G.pickups.push({ kind: 'gem', gem: { id: pick(Object.keys(GEMS)), rarity: gemRarity() }, x: e.x, y: e.y });
    burst(e.x, e.y, 6, T.eldritch ? '#5a3a7a' : '#6d0d19');
  }
}

function dropGem(x, y, v) {
  if (G.gems.length > 450) { G.gems[(Math.random() * G.gems.length) | 0].v += v; return; }
  G.gems.push({ x, y, v, pull: false, spd: 0 });
}

function addXp(v) {
  const p = G.player;
  p.xp += v * (1 + G.am.xp / 100);
  while (p.xp >= p.nextXp) {
    p.xp -= p.nextXp;
    p.level++;
    p.nextXp = xpFor(p.level);
    G.pendingLevels++;
  }
}

// type: 'fisico' | 'arcano' | 'abismo' (las resistencias del atuendo lo reducen)
function hurtPlayer(dmg, type = 'fisico') {
  const p = G.player;
  if (p.invuln > 0) return false;
  const res = Math.min(75, outfitRes(type));
  dmg *= 1 - res / 100;
  dmg = Math.max(dmg * 0.3, dmg - p.armor, 1);
  if (p.beastT > 0) dmg *= 1.3; // la bestialidad baja la guardia
  p.hp -= dmg;
  p.rally = Math.min(p.rally + dmg, Math.max(0, p.maxHp - p.hp));
  p.rallyDelay = D().rallyDelay;
  p.invuln = D().invuln;
  G.shake = 0.25;
  addText(p.x, p.y - 24, '-' + Math.round(dmg), '#ff5468');
  sfx('hurt');
  if (p.hp <= 0) { p.hp = 0; gameOver(false); }
  return true;
}

// Acumulación de veneno en el cazador (las larvas abisales lo transmiten)
function addPoison(n) {
  const p = G.player;
  if (p.sedT > 0 || p.poisonT > 0) return;
  p.poison += n;
  if (p.poison >= 100) { p.poison = 0; p.poisonT = 6; addText(p.x, p.y - 34, '¡Envenenado!', '#7be38a'); }
}

function updatePlayer(dt) {
  const p = G.player;
  let ix = 0, iy = 0;
  if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
  if (keys.has('d') || keys.has('arrowright')) ix += 1;
  if (keys.has('w') || keys.has('arrowup')) iy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) iy += 1;
  const len = Math.hypot(ix, iy);
  p.moving = len > 0;
  const sp = p.speed * (1 + (G.am.speed + setBonus('speed') + (p.windT > 0 ? 25 : 0)) / 100) * (p.bog ? 0.6 : 1);
  if (p.dodgeT > 0) {
    // esquiva: paso veloz que deja estelas
    p.dodgeT -= dt;
    p.x += p.dodgeX * sp * 3.6 * dt; p.y += p.dodgeY * sp * 3.6 * dt;
    G.ghosts.push({ x: p.x, y: p.y, face: p.face, life: 0.22 });
  } else if (p.moving) {
    ix /= len; iy /= len;
    p.x += ix * sp * dt; p.y += iy * sp * dt;
    p.dirX = ix; p.dirY = iy;
    if (ix !== 0) p.face = ix < 0 ? -1 : 1;
    p.anim += dt * 12;
  }
  for (const gh of G.ghosts) { gh.life -= dt; if (gh.life <= 0) gh.dead = true; }
  // velocidad real del cazador (la IA avanzada la usa para predecir)
  if (dt > 0) { p.vx = (p.x - (p.px ?? p.x)) / dt; p.vy = (p.y - (p.py ?? p.y)) / dt; }
  p.px = p.x; p.py = p.y;
  // aguante: se recupera solo tras una pausa corta
  if (p.stamDelay > 0) p.stamDelay -= dt;
  else p.stamina = Math.min(p.maxStamina, p.stamina + 45 * p.stamRegen * dt);
  if (p.vialCd > 0) p.vialCd -= dt;
  if (p.shootT > 0) p.shootT -= dt;
  // el cazador funde una bala nueva cada 2 segundos
  if (p.ammo < p.maxAmmo) p.ammo = Math.min(p.maxAmmo, p.ammo + dt * 0.5);
  if (p.bloodCd > 0) p.bloodCd -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  const regen = p.regen + G.am.regen + setBonus('regen');
  if (regen > 0) p.hp = Math.min(p.maxHp, p.hp + regen * dt);
  // la vida recuperable se esfuma si no contraatacás rápido
  if (p.rallyDelay > 0) p.rallyDelay -= dt;
  else if (p.rally > 0) p.rally = Math.max(0, p.rally - D().rallyDecay * dt);
  p.rally = Math.min(p.rally, Math.max(0, p.maxHp - p.hp));
  if (p.melee.trickCd > 0) p.melee.trickCd -= dt;
  // estados y efectos temporales
  if (p.art && p.art.cd > 0) p.art.cd -= dt;
  if (p.windT > 0) p.windT -= dt;
  if (p.sedT > 0) p.sedT -= dt;
  if (p.beastT > 0) { p.beastT -= dt; if (p.beastT <= 0) p.beastStacks = 0; }
  if (p.paper) { p.paper.t -= dt; if (p.paper.t <= 0) p.paper = null; }
  if (p.poisonT > 0) {
    p.poisonT -= dt;
    p.hp -= 3 * dt;
    if (p.hp <= 0) { p.hp = 0; gameOver(false); }
  } else if (p.poison > 0) p.poison = Math.max(0, p.poison - 4 * dt);
  if (G.lure) { G.lure.t -= dt; if (G.lure.t <= 0) G.lure = null; }
  const k = Math.min(1, dt * 8);
  G.cam.x += (p.x - G.cam.x) * k; G.cam.y += (p.y - G.cam.y) * k;
  if (G.shake > 0) G.shake -= dt;
  if (G.lucidFlash > 0) G.lucidFlash -= dt * 1.5;
}

// Locura por segundo que aporta cada horror cercano (con tope total)
const MAD_RATE = { larva: 1, ojo: 2.5, tentaculo: 3.5, acechante: 6 };
function updateEnemies(dt) {
  const p = G.player;
  const far2 = Math.pow(Math.hypot(viewW(), viewH()) / 2 + 400, 2);
  let madRate = 0;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const T = ETYPES[e.type];
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    if (e.flash > 0) e.flash -= dt;
    // los horrores cercanos llenan la locura
    if (T.eldritch && d < 180) madRate += T.elite ? 10 : MAD_RATE[e.type] || 2;
    // veneno de las gemas ponzoñosas
    if (e.poisonT > 0) {
      e.poisonT -= dt;
      const dps = e.maxHp * 0.025 + 4;
      e.hp -= dps * dt;
      e.ptick = (e.ptick || 0) - dt;
      if (e.ptick <= 0) { e.ptick = 0.5; addText(e.x, e.y - e.r, Math.round(dps * 0.5), '#7be38a'); }
      if (e.hp <= 0) { killEnemy(e); continue; }
    }
    // aturdido: queda tambaleando, no ataca
    if (e.stun > 0) {
      e.stun -= dt;
      e.x += e.kx * dt; e.y += e.ky * dt;
      const dc = Math.min(1, dt * 9); e.kx -= e.kx * dc; e.ky -= e.ky * dc;
      continue;
    }
    // afijos activos: burbuja del escudado (2 s cada 6 s) y regeneración del vampírico
    if (e.affix) {
      if (e.affix.includes('escudado')) {
        if (e.bubble > 0) e.bubble -= dt;
        else { e.bubbleT -= dt; if (e.bubbleT <= 0) { e.bubble = 2; e.bubbleT = 6; } }
      }
      if (e.affix.includes('vampirico')) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.015 * dt);
    }
    // la Penitente rezando: inmóvil hasta terminar (si no la interrumpís, se cura)
    if (e.praying > 0) {
      e.praying -= dt;
      if (e.praying <= 0) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.25);
        setBanner('La Penitente termina su plegaria y se cura', 2.5, '#ffe07a');
        burst(e.x, e.y, 30, '#ffe07a'); sfx('heal');
      }
      continue;
    }
    const stageMode = G.mode === 'stage', ai = stageMode ? G.ai : 1;
    if (e.sideT > 0) e.sideT -= dt;
    const spd0 = e.speed * (e.frenzy > 0 ? 1.35 : 1);
    if (e.frenzy > 0) e.frenzy -= dt;
    let vx = ux * spd0, vy = uy * spd0;
    const seeP = !stageMode || losClear(e.x, e.y, p.x, p.y);
    if (stageMode && !seeP) {
      // sin línea de visión: siguen el mapa de flujo (la ruta más corta hacia vos)
      const f = flowDir(e);
      if (f) { vx = f[0] * spd0; vy = f[1] * spd0; }
    } else if (ai >= 2 && !T.ranged && !T.shooter && !T.boss && !T.bomber && !T.healer && d > 80) {
      // IA 2+: cada uno toma un puesto distinto alrededor tuyo (ángulo áureo) para rodearte en vez de venir en fila
      const slot = (e.id * 2.39996) % TAU, ring = Math.min(d * 0.55, 130);
      const tx = p.x + Math.cos(slot) * ring - e.x, ty = p.y + Math.sin(slot) * ring - e.y, tl = Math.hypot(tx, ty) || 1;
      vx = (tx / tl * 0.65 + ux * 0.35) * spd0; vy = (ty / tl * 0.65 + uy * 0.35) * spd0;
    }
    // IA 2+: esquivan tus balas con un paso lateral
    if (stageMode && ai >= 2 && !T.boss && !(e.dash > 0) && !(e.leapT > 0)) {
      e.dodgeCd = (e.dodgeCd || 0) - dt;
      if (e.dodgeCd <= 0) {
        e.dodgeCd = 0.15;
        for (const b of G.projectiles) {
          if (b.kind !== 'bala' || b.dead) continue;
          const rx = e.x - b.x, ry = e.y - b.y, bl = Math.hypot(b.vx, b.vy) || 1, bxn = b.vx / bl, byn = b.vy / bl;
          const along = rx * bxn + ry * byn, lat = Math.abs(rx * byn - ry * bxn);
          if (along > 0 && along < 140 && lat < e.r + 12 && Math.random() < 0.12 * ai) {
            const side = (rx * byn - ry * bxn) > 0 ? 1 : -1;
            e.kx += byn * side * 300; e.ky += -bxn * side * 300;
            e.dodgeCd = 1.4 - ai * 0.15;
            break;
          }
        }
      }
    }
    // a distancia: mantienen su distancia, buscan línea de tiro y SIEMPRE avisan antes de atacar
    if (T.ranged) {
      const see = losClear(e.x, e.y, p.x, p.y);
      const far = T.ranged === 'bolt' ? [300, 420] : T.ranged === 'ring' ? [160, 280] : [200, 300];
      const orbit = !see ? 1 : d < far[0] ? -0.8 : d < far[1] ? 0 : 1;
      const strafe = T.ranged === 'ring' ? 0.25 : 0.6;
      if (!see && stageMode) { const f = flowDir(e); if (f) { vx = f[0] * spd0; vy = f[1] * spd0; } else { vx = ux * spd0; vy = uy * spd0; } }
      else { vx = ux * spd0 * orbit - uy * spd0 * strafe * (e.id % 2 ? 1 : -1); vy = uy * spd0 * orbit + ux * spd0 * strafe * (e.id % 2 ? 1 : -1); }
      e.shot -= dt;
      const sc = 1 + ST() / 220;
      if (e.aimT > 0) {
        e.aimT -= dt; vx *= 0.15; vy *= 0.15;
        if (T.ranged === 'bolt') { e.aimX = lerp(e.aimX, p.x, dt * 2); e.aimY = lerp(e.aimY, p.y, dt * 2); }
        if (e.aimT <= 0) {
          // IA 3+: apuntan adonde vas a estar, no adonde estás
          const lead = ai >= 3 ? 1 : 0;
          const aimAt = (spd) => {
            const t = (d / spd) * lead;
            const ax = p.x + (p.vx || 0) * t - e.x, ay = p.y + (p.vy || 0) * t - e.y, al = Math.hypot(ax, ay) || 1;
            return [ax / al, ay / al];
          };
          if (T.ranged === 'shot') {
            const [dx2, dy2] = aimAt(300);
            G.ebullets.push({ kind: 'shot', type: 'fisico', x: e.x, y: e.y, vx: dx2 * 300, vy: dy2 * 300, life: 2, r: 4, dmg: 9 * sc });
            sfx('shot');
          } else if (T.ranged === 'bolt') {
            // virote: muy rápido y fuerte, apunta adonde quedó la mira
            const ax = e.aimX - e.x, ay = e.aimY - e.y, al = Math.hypot(ax, ay) || 1;
            G.ebullets.push({ kind: 'bolt', type: 'fisico', x: e.x, y: e.y, vx: (ax / al) * 640, vy: (ay / al) * 640, life: 1.4, r: 4, dmg: 17 * sc });
            sfx('shot');
          } else if (T.ranged === 'spit') {
            // abanico de bilis venenosa
            const [dx2, dy2] = aimAt(210), base = Math.atan2(dy2, dx2), k = ai >= 3 ? 5 : 3;
            for (let i = 0; i < k; i++) { const a = base + (i - (k - 1) / 2) * 0.24; G.ebullets.push({ kind: 'spit', type: 'fisico', x: e.x, y: e.y, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, life: 2.4, r: 5, dmg: 6 * sc }); }
            sfx('toss');
          } else if (T.ranged === 'ring') {
            // tañido: anillo de orbes (rebotan en las paredes desde IA 2; doble anillo con IA 4)
            const k = ai >= 3 ? 14 : 10, rot = rand(0, TAU);
            for (let ring = 0; ring < (ai >= 4 ? 2 : 1); ring++) for (let i = 0; i < k; i++) {
              const a = rot + (i / k) * TAU + ring * (Math.PI / k), sp = 115 + ring * 35;
              G.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 4.5, r: 6, dmg: 8 * sc, bounce: ai >= 2 ? 1 : 0 });
            }
            sfx('bell');
          } else {
            const t = 1.0 * lead;
            hazard(p.x + (p.vx || 0) * t * 0.8, p.y + (p.vy || 0) * t * 0.8, 52, 1.0, 12 * sc, 'fuego');
            sfx('toss');
          }
        }
      } else if (e.shot <= 0 && see && d < (T.ranged === 'bolt' ? 560 : 460)) {
        const cds = { shot: 2.4, fire: 3.2, bolt: 3.4, spit: 2.8, ring: 3.4 }, aims = { shot: 0.45, fire: 0.45, bolt: 0.9, spit: 0.5, ring: 0.7 };
        e.shot = cds[T.ranged] * (ai >= 3 ? 0.75 : 1);
        e.aimT = aims[T.ranged];
        e.aimX = p.x; e.aimY = p.y;
      }
    }
    // escudero: gira despacio hacia vos; flanquealo para que tus balas pasen
    if (T.shield) {
      const want = Math.atan2(dy, dx);
      if (e.fa === undefined) e.fa = want;
      e.fa += clamp(angDiff(want, e.fa), -1.5 * dt, 1.5 * dt);
    }
    // fanático: corre hacia vos y, al llegar, enciende la mecha
    if (T.bomber) {
      if (e.fuse > 0) {
        vx = 0; vy = 0; e.fuse -= dt;
        if (e.fuse <= 0) { e.dead = true; G.kills++; explodeAt(e.x, e.y, 85, 22 * (1 + ST() / 220), 40 * (1 + ST() / 220)); continue; }
      } else if (d < 60) { e.fuse = 0.7; sfx('empty'); }
    }
    // sacerdote: se mantiene lejos y cada tanto cura y enfurece a los que tiene cerca
    if (T.healer) {
      const orbit = d < 240 ? -0.9 : d < 330 ? 0 : 0.8;
      vx = ux * spd0 * orbit - uy * spd0 * 0.4; vy = uy * spd0 * orbit + ux * spd0 * 0.4;
      e.shot -= dt;
      if (e.shot <= 0) {
        e.shot = 4;
        const near = G.enemies.filter(o => o !== e && !o.dead && !ETYPES[o.type].boss && dist2(o.x, o.y, e.x, e.y) < 210 * 210);
        for (const o of near) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.2); o.frenzy = 4; }
        if (near.length) G.effects.push({ kind: 'beams', x: e.x, y: e.y, to: near.slice(0, 8).map(o => [o.x, o.y]), life: 0.5, max: 0.5 });
      }
    }
    // bestia saltadora: marca dónde va a caer y salta
    if (T.leaper) {
      if (e.leapT > 0) {
        e.leapT -= dt;
        const k = 1 - clamp(e.leapT / 1.0, 0, 1);
        e.x = lerp(e.lx0, e.ltx, k * k); e.y = lerp(e.ly0, e.lty, k * k); e.air = Math.sin(k * Math.PI) * 30;
        vx = 0; vy = 0;
        if (e.leapT <= 0) e.air = 0;
      } else {
        e.shot -= dt;
        if (e.shot <= 0 && d < 340 && d > 80) {
          e.shot = 3.6 * (ai >= 3 ? 0.75 : 1);
          e.leapT = 1.0; e.lx0 = e.x; e.ly0 = e.y; e.ltx = p.x; e.lty = p.y;
          hazard(p.x, p.y, 60, 1.0, e.dmg * 1.1, 'fisico');
        }
      }
    }
    if (stageMode && G.stage.arena.bogs.length && inBog(e)) { vx *= 0.6; vy *= 0.6; }
    // embestida: carga (telegrafiada) y luego un salto veloz
    if (T.lunge) {
      if (e.wind > 0) {
        e.wind -= dt; vx = 0; vy = 0;
        if (e.wind <= 0) { e.dash = 0.28; e.dashX = ux; e.dashY = uy; }
      } else if (e.dash > 0) {
        e.dash -= dt; vx = e.dashX * e.speed * 4.5; vy = e.dashY * e.speed * 4.5;
        if (e.dash <= 0) e.lungeCd = (e.blood ? rand(1.8, 3.2) : rand(2.5, 4.5)) * (ai >= 2 ? 0.75 : 1);
      } else {
        e.lungeCd -= dt;
        if (e.lungeCd <= 0 && d < 170 + e.r && d > 40 && losClear(e.x, e.y, p.x, p.y)) { e.wind = e.elite ? 0.8 : ai >= 4 ? 0.5 : 0.6; e.parryShot = false; }
      }
    }
    if (e.type === 'murcielago' || e.type === 'larva') {
      e.wob += dt * 7;
      const s = Math.sin(e.wob) * 70;
      vx += -uy * s; vy += ux * s;
    }
    if (T.shooter) {
      // el ojo mantiene la distancia y dispara orbes
      const orbit = d < 200 ? -0.7 : d < 260 ? 0 : 1;
      vx = ux * e.speed * orbit - uy * e.speed * 0.8;
      vy = uy * e.speed * orbit + ux * e.speed * 0.8;
      e.shot -= dt;
      if (e.shot <= 0 && d < 430 && losClear(e.x, e.y, p.x, p.y)) {
        e.shot = 2.6;
        G.ebullets.push({ x: e.x, y: e.y, vx: ux * 170, vy: uy * 170, life: 3.5, r: 6, dmg: 9 * (1 + ST() / 400) });
      }
    }
    if (e.elite) updateBoss(e, T, dt);
    if (T.summoner) {
      e.summon -= dt;
      if (e.summon <= 0 && eldritchCount() < MAX_ELDRITCH) {
        e.summon = 5;
        for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; spawnEnemy('larva', e.x + Math.cos(a) * 50, e.y + Math.sin(a) * 50); }
      }
    }
    // cóctel apestoso: los enemigos comunes van hacia el olor
    if (G.lure && !e.elite && e.dash <= 0 && dist2(e.x, e.y, G.lure.x, G.lure.y) < 350 * 350) {
      const lx = G.lure.x - e.x, ly = G.lure.y - e.y, ld = Math.hypot(lx, ly) || 1;
      vx = (lx / ld) * e.speed; vy = (ly / ld) * e.speed;
      e.wind = 0;
    }
    // en los mapas con obstáculos, rodean pilares y bloques
    if (stageMode && !(e.dash > 0)) [vx, vy] = steer(e, vx, vy);
    // si quedó trabado, prueba por el otro lado; si sigue sin avanzar, reaparece flanqueándote
    if (stageMode && e.speed > 25 && !T.boss) {
      e.chk = (e.chk || 0) + dt;
      if (e.chk >= 2) {
        // ¿se acercó de verdad en los últimos 2 s? (deslizarse contra un muro no cuenta)
        const progress = (e.lastD ?? d + 99) - d;
        e.lastD = d; e.chk = 0;
        const see = losClear(e.x, e.y, p.x, p.y);
        if (progress < 25 && d > e.r + p.r + 30 && !(T.ranged && see) && !(T.healer && see)) {
          e.side = -(e.side || 1); e.sideT = 3; e.stuck = (e.stuck || 0) + 1;
          if (e.stuck >= 2) {
            for (let k = 0; k < 20; k++) {
              const a = rand(0, TAU), r = rand(180, 280), nx = p.x + Math.cos(a) * r, ny = p.y + Math.sin(a) * r;
              if (!solidAt(nx, ny, 16) && losClear(nx, ny, p.x, p.y)) { burst(e.x, e.y, 8, '#5a3a4a'); e.x = nx; e.y = ny; burst(nx, ny, 8, '#5a3a4a'); break; }
            }
            e.stuck = 0;
          }
        } else e.stuck = 0;
      }
    }
    e.x += (vx + e.kx) * dt; e.y += (vy + e.ky) * dt;
    const decay = Math.min(1, dt * 9);
    e.kx -= e.kx * decay; e.ky -= e.ky * decay;
    if (Math.abs(dx) > 2) e.face = dx < 0 ? -1 : 1;
    if (G.mode !== 'stage' && d * d > far2) { [e.x, e.y] = spawnPos(); e.wind = 0; e.dash = 0; }
    if (d < e.r + p.r - 2) {
      const hit = hurtPlayer(e.dmg * (e.dash > 0 ? 1.5 : 1), T.eldritch ? 'abismo' : 'fisico');
      if (hit && (e.type === 'larva' || e.type === 'hambre')) addPoison(e.type === 'hambre' ? 25 : 30);
      if (hit && e.affix && e.affix.includes('vampirico')) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.15);
    }
  }
  for (const b of G.ebullets) {
    const bs = D().bullet; b.x += b.vx * dt * bs; b.y += b.vy * dt * bs; b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    // orbes que rebotan en las paredes (una vez)
    if (b.bounce > 0 && G.mode === 'stage' && inWall(b.x, b.y)) {
      const px = b.x - b.vx * dt, py = b.y - b.vy * dt;
      if (!inWall(px, b.y)) b.vy = -b.vy; else if (!inWall(b.x, py)) b.vx = -b.vx; else { b.vx = -b.vx; b.vy = -b.vy; }
      b.x = px; b.y = py; b.bounce--;
    }
    const rr = b.r + p.r - 2;
    if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
      b.dead = true;
      const hit = hurtPlayer(b.dmg, b.type || 'arcano');
      if (hit && !b.kind && p.sedT <= 0) p.madness += 10;
      if (hit && b.kind === 'spit') addPoison(22);
    }
  }
  // Locura: sube cerca de los horrores (más rápido con más Lucidez); al llenarse, estalla
  if (p.sedT > 0) p.madness = 0;
  else if (madRate > 0) p.madness += Math.min(18, madRate) * (1 + p.lucidez * 0.03) * dt;
  else p.madness = Math.max(0, p.madness - 12 * dt);
  if (p.madness >= 100) {
    p.madness = 0;
    const dmg = p.maxHp * 0.35 + 15;
    p.hp -= dmg;
    addText(p.x, p.y - 34, '¡LOCURA! -' + Math.round(dmg), '#d07cff');
    G.lucidFlash = 1.2; G.shake = 0.5;
    burst(p.x, p.y, 30, '#8a3fd0');
    sfx('rift');
    if (p.hp <= 0) { p.hp = 0; gameOver(false); }
  }
}

// Separación simple con grilla espacial para que no se apilen
function separate() {
  const cell = 48, grid = new Map();
  const list = G.enemies;
  for (const e of list) {
    if (e.dead) continue;
    e.cx = Math.floor(e.x / cell); e.cy = Math.floor(e.y / cell);
    const key = e.cx * 100003 + e.cy;
    let b = grid.get(key); if (!b) grid.set(key, b = []);
    b.push(e);
  }
  for (const e of list) {
    if (e.dead) continue;
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const b = grid.get((e.cx + ox) * 100003 + (e.cy + oy)); if (!b) continue;
      for (const o of b) {
        if (o.id <= e.id || o.dead) continue;
        const dx = o.x - e.x, dy = o.y - e.y, min = e.r + o.r;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < min * min) {
          const d = Math.sqrt(d2), overlap = min - d;
          const nx = dx / d, ny = dy / d;
          const we = e.elite ? 0.1 : 1, wo = o.elite ? 0.1 : 1, sum = we + wo;
          e.x -= nx * overlap * (we / sum); e.y -= ny * overlap * (we / sum);
          o.x += nx * overlap * (wo / sum); o.y += ny * overlap * (wo / sum);
        }
      }
    }
  }
}

function nearestEnemies(x, y, n, range) {
  const r2 = range * range, list = [];
  for (const e of G.enemies) { if (e.dead || !canSee(e)) continue; const d = dist2(x, y, e.x, e.y); if (d < r2) list.push([d, e]); }
  list.sort((a, b) => a[0] - b[0]);
  return list.slice(0, n).map(a => a[1]);
}

// ¿Hay alguna bestia dentro del radio de detección del cazador?
function enemyInRange() {
  const p = G.player, r = p.range;
  for (const e of G.enemies) {
    if (e.dead || !canSee(e) || !losClear(p.x, p.y, e.x, e.y)) continue;
    const rr = r + e.r;
    if (dist2(p.x, p.y, e.x, e.y) < rr * rr) return true;
  }
  return false;
}

// --- Arma de fuego
function updateGun(dt) {
  const p = G.player, w = p.gun, s = gunStats(w), d = GUNS[w.id];
  if (w.timer > 0) w.timer -= dt;
  if (!p.alert) return;
  // Disparo de contra: si alguien carga una embestida en rango, se le dispara aunque
  // falte un poco de recarga (hasta la mitad) para intentar aturdirlo
  const r2 = (p.range + 40) * (p.range + 40);
  let winder = null;
  for (const e of G.enemies) if (!e.dead && e.wind > 0 && !e.parryShot && dist2(p.x, p.y, e.x, e.y) < r2) { winder = e; break; }
  if (w.timer > (winder ? s.cd * p.cdMul * 0.5 : 0)) return;
  // sin munición no hay disparo (R: balas de sangre)
  p.noAmmo = p.ammo < s.ammo - 1e-6;
  if (p.noAmmo) { if (w.timer <= 0) { w.timer = 0.6; sfx('empty'); } return; }
  const isSpread = d.count >= 5;
  let targets = nearestEnemies(p.x, p.y, isSpread ? 3 : s.count + 3, p.range + 40).filter(t => losClear(p.x, p.y, t.x, t.y)).slice(0, isSpread ? 1 : s.count);
  if (winder) { winder.parryShot = true; targets = [winder, ...targets.filter(t => t !== winder)].slice(0, Math.max(1, targets.length)); }
  if (!targets.length) return;
  w.timer = s.cd * p.cdMul;
  p.ammo = Math.max(0, p.ammo - s.ammo);
  const life = s.short ? s.life : Math.max(s.life, p.range / s.speed + 0.2);
  const shoot = (ang) => {
    const mx = p.x + Math.cos(ang) * 14, my = p.y - 2 + Math.sin(ang) * 14;
    G.projectiles.push({ kind: 'bala', x: mx, y: my, vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed, ang, dmg: s.dmg, pierce: s.pierce, life, r: 5, hit: new Set(), boom: s.boom, elem: s.elem });
    G.muzzle = { x: mx, y: my, ang, life: 0.06 };
    p.shootT = 0.18;
  };
  if (isSpread) {
    const base = Math.atan2(targets[0].y - p.y, targets[0].x - p.x);
    for (let i = 0; i < s.count; i++) shoot(base + (i / (s.count - 1) - 0.5) * s.spread + rand(-0.04, 0.04));
  } else {
    for (let i = 0; i < s.count; i++) {
      const t = targets[i % targets.length];
      const off = i >= targets.length ? (i - targets.length + 1) * s.spread * (i % 2 ? 1 : -1) : 0;
      shoot(Math.atan2(t.y - p.y, t.x - p.x) + off + rand(-0.03, 0.03));
    }
  }
  p.face = Math.cos(Math.atan2(targets[0].y - p.y, targets[0].x - p.x)) < 0 ? -1 : 1;
  sfx('shot');
}

// --- Arma cuerpo a cuerpo
function updateMelee(dt) {
  const p = G.player, w = p.melee, s = meleeStats(w);
  if (w.timer > 0) w.timer -= dt;
  if (w.timer > 0) return;
  // objetivo: primero un aturdido (para el golpe visceral), si no el más cercano
  let best = null, bd = Infinity, stunned = null;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = Math.sqrt(dist2(p.x, p.y, e.x, e.y));
    if (d < s.reach + e.r) {
      if (e.stun > 0 && !stunned) stunned = e;
      if (d < bd) { bd = d; best = e; }
    }
  }
  if (stunned) best = stunned;
  if (!best) return;
  w.timer = s.cd * p.cdMul;
  let dmg = s.dmg, arc = s.arc;
  const trick = w.bonus;
  if (trick) { dmg *= 1.5; arc = Math.min(TAU, arc * 1.3); w.bonus = false; }
  const ang = Math.atan2(best.y - p.y, best.x - p.x);
  for (const e of G.enemies) {
    if (e.dead) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (d > s.reach + e.r) continue;
    if (e !== best && arc < TAU && Math.abs(angDiff(Math.atan2(dy, dx), ang)) > arc / 2 + Math.atan2(e.r, d)) continue;
    if (e.stun > 0) {
      // golpe visceral: daño enorme y mucha vida recuperada
      e.stun = 0;
      const dealt = hurtEnemy(e, dmg * 3 * (1 + G.am.visceral / 100), dx / d, dy / d, s.kb * 1.5, 'melee', '#ffe07a', s.elem);
      addText(e.x, e.y - e.r - 16, '¡VISCERAL!', '#ff8a5a');
      G.hitstop = 0.09;
      burst(e.x, e.y, 22, '#9a0f22');
      G.shake = 0.3;
      sfx('visceral');
      rallyHeal(dealt, 0.6 * (1 + G.sock.melee.rally / 100));
    } else {
      rallyHeal(hurtEnemy(e, dmg, dx / d, dy / d, s.kb, 'melee', undefined, s.elem), 0.2 * (1 + G.sock.melee.rally / 100));
    }
  }
  if (s.wave) {
    G.projectiles.push({ kind: 'onda', x: p.x, y: p.y, vx: Math.cos(ang) * 420, vy: Math.sin(ang) * 420, ang, dmg: dmg * 0.6, life: 0.7, r: 24, hit: new Set(), elem: s.elem });
  }
  // los tajos también cortan los orbes enemigos
  for (const b of G.ebullets) {
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
    if (d < s.reach && (s.arc >= TAU || Math.abs(angDiff(Math.atan2(dy, dx), ang)) < s.arc / 2)) b.dead = true;
  }
  damageStructures(p.x + Math.cos(ang) * s.reach * 0.6, p.y + Math.sin(ang) * s.reach * 0.6, s.reach * 0.55, dmg);
  G.effects.push({ kind: 'slash', ang, arc, reach: s.reach, life: trick ? 0.24 : 0.17, max: trick ? 0.24 : 0.17, color: trick ? '#ffe07a' : RARITIES[MELEES[w.id].rarity].color });
  p.face = Math.cos(ang) < 0 ? -1 : 1;
  // pétalos de sangre que salen despedidos del filo
  for (let i = 0; i < 7 && G.particles.length < 420; i++) {
    const a = ang + rand(-arc / 2, arc / 2), r = s.reach * rand(0.6, 1), sp = rand(60, 170);
    G.particles.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, vx: Math.cos(a + 1.2) * sp, vy: Math.sin(a + 1.2) * sp - 30, life: rand(0.3, 0.6), max: 0.6, color: i % 3 ? '#c41e3a' : '#ff7a9a', size: rand(2, 4) });
  }
  sfx('slash');
}

// --- Herramientas
const TOOL_FIRE = {
  campana(t, s) {
    const p = G.player;
    G.effects.push({ kind: 'ring', x: p.x, y: p.y, r: 10, maxR: s.radius, dmg: s.dmg, hit: new Set(), fade: 0.25 });
    sfx('bell');
  },
  fuego(t, s) {
    const p = G.player;
    const near = nearestEnemies(p.x, p.y, 14, p.range + 40);
    if (!near.length) return;
    for (let i = 0; i < s.count; i++) {
      const e = near[(Math.random() * near.length) | 0];
      const tx = e.x + rand(-10, 10), ty = e.y + rand(-10, 10);
      G.projectiles.push({ kind: 'frasco', sx: p.x, sy: p.y, x: p.x, y: p.y, tx, ty, t: 0, dur: 0.55, s, spin: rand(0, TAU) });
    }
    sfx('toss');
  },
};

function updateTools(dt) {
  const p = G.player;
  for (const t of p.tools) {
    const s = TOOL_DEFS[t.id].stats(t.level);
    if (t.id === 'farol') {
      t.angle += s.spin * dt;
      t.orbs.length = 0;
      for (let i = 0; i < s.count; i++) {
        const a = t.angle + (i * TAU) / s.count;
        t.orbs.push({ x: p.x + Math.cos(a) * s.radius, y: p.y + Math.sin(a) * s.radius });
      }
      for (const e of G.enemies) {
        if (e.dead || G.t - e.farolT < 0.5) continue;
        for (const o of t.orbs) {
          const rr = e.r + 10;
          if (dist2(o.x, o.y, e.x, e.y) < rr * rr) {
            const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
            e.farolT = G.t;
            hurtEnemy(e, s.dmg, dx / d, dy / d, 140, 'tool', undefined, 'fuego');
            break;
          }
        }
      }
      continue;
    }
    if (t.timer > 0) t.timer -= dt;
    if (t.timer <= 0 && p.alert) { t.timer = s.cd * p.cdMul; TOOL_FIRE[t.id](t, s); }
  }
}

function explode(x, y, radius, dmg) {
  for (const e of G.enemies) {
    if (e.dead) continue;
    const rr = radius + e.r;
    if (dist2(x, y, e.x, e.y) < rr * rr) hurtEnemy(e, dmg, 0, 0, 0, 'gun', undefined, 'rayo');
  }
  G.effects.push({ kind: 'boom', x, y, r: radius, life: 0.25, max: 0.25 });
  damageStructures(x, y, radius, dmg);
  sfx('boom');
}

function updateProjectiles(dt) {
  for (const pr of G.projectiles) {
    if (pr.kind === 'bala') {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.life <= 0) { pr.dead = true; continue; }
      for (const e of G.enemies) {
        if (e.dead || pr.hit.has(e)) continue;
        const rr = e.r + pr.r;
        if (dist2(pr.x, pr.y, e.x, e.y) < rr * rr) {
          pr.hit.add(e);
          const sp = Math.hypot(pr.vx, pr.vy);
          if (e.wind > 0) stunEnemy(e);
          rallyHeal(hurtEnemy(e, pr.dmg, pr.vx / sp, pr.vy / sp, 60, pr.src || 'gun', undefined, pr.elem), pr.src ? 0 : 0.1 * (1 + G.sock.gun.rally / 100));
          if (pr.boom) explode(pr.x, pr.y, pr.boom, pr.dmg * 0.5);
          if (--pr.pierce <= 0) { pr.dead = true; break; }
        }
      }
    } else if (pr.kind === 'astral') {
      // se curvan hacia su objetivo
      if (pr.target && !pr.target.dead) {
        const want = Math.atan2(pr.target.y - pr.y, pr.target.x - pr.x), cur = Math.atan2(pr.vy, pr.vx);
        const na = cur + clamp(angDiff(want, cur), -7 * dt, 7 * dt), sp = Math.min(520, Math.hypot(pr.vx, pr.vy) + 500 * dt);
        pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
      }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.life <= 0) { pr.dead = true; continue; }
      for (const e of G.enemies) {
        if (e.dead) continue;
        if (dist2(pr.x, pr.y, e.x, e.y) < (e.r + pr.r) ** 2) { hurtEnemy(e, pr.dmg, pr.vx / 500, pr.vy / 500, 100, 'art', undefined, 'arcano'); pr.dead = true; break; }
      }
    } else if (pr.kind === 'onda') {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.life <= 0) { pr.dead = true; continue; }
      for (const e of G.enemies) {
        if (e.dead || pr.hit.has(e)) continue;
        const rr = e.r + pr.r;
        if (dist2(pr.x, pr.y, e.x, e.y) < rr * rr) { pr.hit.add(e); hurtEnemy(e, pr.dmg, Math.cos(pr.ang), Math.sin(pr.ang), 120, 'melee', undefined, pr.elem); }
      }
    } else if (pr.kind === 'frasco') {
      pr.t += dt;
      const k = Math.min(1, pr.t / pr.dur);
      pr.x = lerp(pr.sx, pr.tx, k); pr.y = lerp(pr.sy, pr.ty, k);
      pr.spin += dt * 12;
      if (k >= 1) {
        pr.dead = true;
        G.pools.push({ x: pr.tx, y: pr.ty, r: pr.s.radius, life: pr.s.dur, max: pr.s.dur, dps: pr.s.dps, tick: 0 });
        burst(pr.tx, pr.ty, 8, '#ff9a3c');
      }
    }
  }
  if (G.muzzle) { G.muzzle.life -= dt; if (G.muzzle.life <= 0) G.muzzle = null; }
}

function updateEffects(dt) {
  for (const fx of G.effects) {
    if (fx.kind === 'ring') {
      if (fx.r < fx.maxR) {
        fx.r = Math.min(fx.maxR, fx.r + (fx.maxR / 0.35) * dt);
        for (const e of G.enemies) {
          if (e.dead || fx.hit.has(e)) continue;
          const d = Math.sqrt(dist2(fx.x, fx.y, e.x, e.y));
          if (d < fx.r + e.r) {
            fx.hit.add(e);
            const n = d || 1;
            hurtEnemy(e, fx.dmg, (e.x - fx.x) / n, (e.y - fx.y) / n, 320, 'tool', undefined, 'bendito');
          }
        }
      } else {
        fx.fade -= dt;
        if (fx.fade <= 0) fx.dead = true;
      }
    } else {
      fx.life -= dt;
      if (fx.life <= 0) fx.dead = true;
    }
  }
}

function updatePools(dt) {
  for (const pl of G.pools) {
    pl.life -= dt;
    if (pl.life <= 0) { pl.dead = true; continue; }
    pl.tick -= dt;
    if (pl.tick <= 0) {
      pl.tick = 0.3;
      for (const e of G.enemies) {
        if (e.dead) continue;
        const rr = pl.r + e.r * 0.6;
        if (dist2(pl.x, pl.y, e.x, e.y) < rr * rr) hurtEnemy(e, pl.dps * 0.3, 0, 0, 0, 'tool', undefined, 'fuego');
      }
    }
    if (Math.random() < dt * 14 && G.particles.length < 420) {
      const a = rand(0, TAU), d = rand(0, pl.r * 0.8);
      G.particles.push({ x: pl.x + Math.cos(a) * d, y: pl.y + Math.sin(a) * d, vx: rand(-8, 8), vy: rand(-50, -25), life: 0.45, max: 0.45, color: Math.random() < 0.5 ? '#ffb347' : '#ff6a2a', size: rand(1.5, 3) });
    }
  }
}

function updatePickups(dt) {
  const p = G.player, m2 = p.magnet * p.magnet;
  for (const g of G.gems) {
    const d2 = dist2(g.x, g.y, p.x, p.y);
    if (!g.pull && d2 < m2) g.pull = true;
    if (g.pull) {
      g.spd += 700 * dt;
      const d = Math.sqrt(d2) || 1;
      const step = Math.min(d, (180 + g.spd) * dt);
      g.x += ((p.x - g.x) / d) * step; g.y += ((p.y - g.y) / d) * step;
      if (d < p.r + 8) { g.dead = true; addXp(g.v); sfx('pick'); }
    }
  }
  for (const h of G.pickups) {
    const d2 = dist2(h.x, h.y, p.x, p.y);
    if (d2 < m2 || h.pull) {
      h.pull = true;
      const d = Math.sqrt(d2) || 1;
      h.x += ((p.x - h.x) / d) * Math.min(d, 320 * dt); h.y += ((p.y - h.y) / d) * Math.min(d, 320 * dt);
    }
    if (d2 < (p.r + 12) * (p.r + 12)) {
      h.dead = true;
      if (h.kind === 'vial') {
        if (p.vials < p.maxVials) { p.vials++; addText(p.x, p.y - 26, '+1 vial', '#ff8a9a'); }
        else { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.1); addText(p.x, p.y - 26, 'Viales llenos: +vida', '#7be38a'); }
        sfx('heal');
      } else if (h.kind === 'gem') {
        G.gemQueue.push(h.gem);
        addText(p.x, p.y - 26, GEMS[h.gem.id].name, RARITIES[h.gem.rarity].color);
        sfx('lucid');
      } else if (h.kind === 'item') {
        p.belt[h.id]++;
        if (!p.belt[BELT[p.beltSel]]) p.beltSel = BELT.indexOf(h.id);
        addText(p.x, p.y - 26, '+1 ' + ITEMS[h.id].name, '#e8dcc4');
        sfx('pick');
      } else if (h.kind === 'frag') {
        G.fragments += h.n;
        addText(p.x, p.y - 26, `+${h.n} fragmentos`, '#b8c0d8');
        sfx('pick');
      } else {
        p.ammo = Math.min(p.maxAmmo, p.ammo + h.n);
        addText(p.x, p.y - 26, `+${h.n} balas`, '#d8dce8');
        sfx('pick');
      }
    }
  }
  // rastro de sangre con la esencia perdida en la muerte anterior
  if (G.trace && dist2(G.trace.x, G.trace.y, p.x, p.y) < 30 * 30) {
    G.essence += G.trace.amount;
    addText(p.x, p.y - 34, `+${G.trace.amount} esencia recuperada`, '#ff8a9a');
    setBanner('Recuperaste tu esencia', 2.5, '#ff8a9a');
    burst(G.trace.x, G.trace.y, 24, '#c4304a');
    sfx('lucid');
    G.trace = null;
  }
}

// ---------------------------------------------------------------- Cazador aliado (campana de llamada)
function updateAllies(dt) {
  const p = G.player, lvl = 1 + ST() / 250;
  for (const a of G.allies) {
    a.t -= dt;
    if (a.t <= 0) { a.dead = true; burst(a.x, a.y, 14, '#9ac8ff'); continue; }
    // se mueve hacia el enemigo visible más cercano, sin alejarse mucho del cazador
    let target = null, bd = 300 * 300;
    for (const e of G.enemies) { if (e.dead || !canSee(e)) continue; const d2 = dist2(a.x, a.y, e.x, e.y); if (d2 < bd) { bd = d2; target = e; } }
    let tx = p.x - 50, ty = p.y + 10;
    if (target && dist2(target.x, target.y, p.x, p.y) < 350 * 350) { tx = target.x; ty = target.y; }
    const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
    if (d > 40) { a.x += (dx / d) * 170 * dt; a.y += (dy / d) * 170 * dt; a.anim += dt * 12; }
    if (Math.abs(dx) > 2) a.face = dx < 0 ? -1 : 1;
    a.shotT -= dt; a.slashT -= dt;
    if (target) {
      const td = Math.sqrt(bd);
      if (td < 60 && a.slashT <= 0) {
        a.slashT = 0.6;
        for (const e of G.enemies) if (!e.dead && dist2(a.x, a.y, e.x, e.y) < (70 + e.r) ** 2) hurtEnemy(e, 22 * lvl, (e.x - a.x) / (td || 1), (e.y - a.y) / (td || 1), 80, 'ally', '#9ac8ff', 'dentado');
        G.effects.push({ kind: 'blast', x: a.x, y: a.y, r: 50, life: 0.15, max: 0.15, ally: true });
      } else if (a.shotT <= 0) {
        a.shotT = 0.7;
        const ang = Math.atan2(target.y - a.y, target.x - a.x);
        G.projectiles.push({ kind: 'bala', x: a.x, y: a.y, vx: Math.cos(ang) * 560, vy: Math.sin(ang) * 560, ang, dmg: 14 * lvl, pierce: 1, life: 0.8, r: 5, hit: new Set(), boom: 0, elem: 'bendito', src: 'ally' });
      }
    }
  }
}

function updateParticles(dt) {
  for (const q of G.particles) {
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vx *= 1 - Math.min(1, dt * 4); q.vy *= 1 - Math.min(1, dt * 4);
    q.life -= dt; if (q.life <= 0) q.dead = true;
  }
  for (const t of G.texts) { t.y -= 30 * dt; t.life -= dt; if (t.life <= 0) t.dead = true; }
  if (G.corpses) { for (const c of G.corpses) c.t += dt; G.corpses = G.corpses.filter(c => c.t < c.max); }
  if (G.banner) { G.banner.time -= dt; if (G.banner.time <= 0) G.banner = null; }
}

// ---------------------------------------------------------------- Modo normal: niveles
// Limpiá el mapa, elegí equipo y seguí. Cada 6.º nivel hay un jefe. La dificultad crece sin tope.
const BOSS_EVERY = 6;
const STAGE_WEAPON_CAP = 8;
const THEMES = [
  { id: 'calles',     name: 'Calles de Vellmoor',       floor: 'rgba(40,24,20,0.28)', block: '#3a2c28', top: '#5a443a' },
  { id: 'cementerio', name: 'Cementerio de la colina',  floor: 'rgba(16,30,22,0.32)', block: '#3a3a40', top: '#5a5a62' },
  { id: 'catedral',   name: 'Nave de la catedral',      floor: 'rgba(44,32,14,0.28)', block: '#4a3e30', top: '#6e5c44' },
  { id: 'bosque',     name: 'Bosque de los ahorcados',  floor: 'rgba(8,30,12,0.38)',  block: '#24301e', top: '#38482c' },
  { id: 'pesadilla',  name: 'La Pesadilla',             floor: 'rgba(50,10,62,0.36)', block: '#2a1838', top: '#4a2a5e' },
];
const BOSSES = ['caido', 'hambre', 'penitente', 'durmiente', 'eclipse'];
function stageTheme(n) { return THEMES[Math.floor((n - 1) / BOSS_EVERY) % THEMES.length]; }
function isBossStage(n) { return n % BOSS_EVERY === 0; }
function stageBoss(n) { return BOSSES[(n / BOSS_EVERY - 1) % BOSSES.length]; }
// nivel de IA: 1 persiguen · 2 rodean y embisten más · 3 apuntan prediciendo tu movimiento · 4 más rápidos y agresivos
function stageAI(n) { return Math.min(4, 1 + Math.floor((n - 1) / 4)); }
// mezcla de enemigos por nivel: cada uno pide una respuesta distinta (cubrirse, flanquear, priorizar, moverse)
function stagePool(n) {
  const w = [['aldeano', n >= 8 ? 3 : 6], ['sabueso', n >= 2 ? 4 : 1]];
  if (n >= 2) w.push(['bombero', 1.5]);
  if (n >= 3) w.push(['lanzador', 2], ['monje', 1.8]);
  if (n >= 4) w.push(['tirador', 2.2], ['escudero', 1.6]);
  if (n >= 5) w.push(['bestia', 2], ['escupidor', 2]);
  if (n >= 7) w.push(['ballestero', 1.8], ['saltador', 1.8]);
  if (n >= 9) w.push(['sacerdote', 1.2]);
  if (n >= 10) w.push(['larva', 2], ['ojo', 2], ['desollado', 2.5]);
  if (n >= 14) w.push(['tentaculo', 1.5]);
  if (n >= 20) w.push(['murcielago', 2]);
  return w;
}
function pickWeighted(w) {
  let tot = 0; for (const [, v] of w) tot += v;
  let x = Math.random() * tot;
  for (const [k, v] of w) { if ((x -= v) <= 0) return k; }
  return w[0][0];
}
// en niveles altos las gemas salen con rareza mínima más alta
function gemRarity() {
  const r = rollRarity();
  return G.mode === 'stage' ? Math.max(r, Math.min(4, Math.floor(G.stage.n / 8))) : r;
}

// Mapas: una plantilla de estructura (salas hechas a mano y combinadas al azar) + el decorado de cada zona.
// Cobertura total (frena balas y paso) y parcial (solo frena el paso), cajas y barriles destructibles,
// y trampas que lastiman mucho más a los enemigos que al cazador: usalas a tu favor.
function buildArena(n) {
  const boss = isBossStage(n), th = stageTheme(n);
  const w = boss ? 1300 : rand(1100, 1400), h = boss ? 1000 : rand(820, 1040);
  const A = { x0: -w / 2, y0: -h / 2, x1: w / 2, y1: h / 2, pillars: [], blocks: [], barrels: [], traps: [], bogs: [], vents: [], decor: [], theme: th, template: 'abierto' };
  const zoneFree = (x, y, r) => Math.hypot(x, y - (A.y1 - 90)) > 200 + r && Math.hypot(x, y - (A.y0 + 46)) > 170 + r;
  const overlaps = (x, y, r, pad = 46) =>
    A.pillars.some(o => Math.hypot(o.x - x, o.y - y) < o.r + r + pad) ||
    A.barrels.some(o => Math.hypot(o.x - x, o.y - y) < o.r + r + pad) ||
    A.blocks.some(b => x > b.x - r - pad && x < b.x + b.w + r + pad && y > b.y - r - pad && y < b.y + b.h + r + pad);
  const clearOf = (x, y, r, pad) => zoneFree(x, y, r) && !overlaps(x, y, r, pad);
  const addP = (x, y, r, extra = {}) => { if (clearOf(x, y, r)) { A.pillars.push({ x, y, r, ...extra }); return true; } return false; };
  const addB = (x, y, bw, bh, extra = {}) => { if (clearOf(x + bw / 2, y + bh / 2, Math.max(bw, bh) / 2)) { A.blocks.push({ x, y, w: bw, h: bh, ...extra }); return true; } return false; };
  const addWall = (x, y, bw, bh) => {
    const pts = [[x, y], [x + bw, y], [x, y + bh], [x + bw, y + bh], [x + bw / 2, y + bh / 2]];
    if (bw > 20 && bh > 20 && pts.every(([px, py]) => zoneFree(px, py, 14))) A.blocks.push({ x, y, w: bw, h: bh, wall: true });
  };
  const rx = () => rand(A.x0 + 90, A.x1 - 90), ry = () => rand(A.y0 + 100, A.y1 - 170);
  const sc = 1 + ST() / 220;

  if (boss) {
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A.pillars.push({ x: sx * w * 0.3, y: sy * h * 0.22, r: 34, brazier: n >= 18 });
    for (const pl of A.pillars) if (pl.brazier) A.vents.push({ x: pl.x, y: pl.y, t: rand(0, 5) });
  } else {
    // 1) estructura
    const tpl = A.template = n <= 2 ? 'abierto' : pick(['abierto', 'corredores', 'cruz', 'anillo', 'laberinto', 'corredores', 'laberinto']);
    if (tpl === 'corredores') {
      for (const fy of [-0.2, 0.12]) {
        const y = fy * h, cuts = [rand(-w * 0.3, w * 0.3)];
        if (Math.random() < 0.5) cuts.push(rand(-w * 0.3, w * 0.3));
        cuts.sort((a, b) => a - b);
        let start = A.x0 + 110;
        for (const g of cuts) { if (g - 70 > start + 40) addWall(start, y, g - 70 - start, 24); start = Math.max(start, g + 70); }
        if (A.x1 - 110 > start + 40) addWall(start, y, A.x1 - 110 - start, 24);
      }
    } else if (tpl === 'cruz') {
      addWall(-13, -h * 0.3, 26, h * 0.18); addWall(-13, h * 0.0, 26, h * 0.16);
      addWall(-w * 0.32, -h * 0.07, w * 0.32 - 70, 26); addWall(70, -h * 0.07, w * 0.32 - 70, 26);
    } else if (tpl === 'anillo') {
      const R = Math.min(w, h) * 0.27;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; A.pillars.push({ x: Math.cos(a) * R, y: -30 + Math.sin(a) * R, r: 26 }); }
    } else if (tpl === 'laberinto') {
      for (let i = 0; i < 40 && A.blocks.length < 6; i++) {
        const x = rx() - 60, y = ry() - 60, L = rand(120, 200), horiz = Math.random() < 0.5;
        if (!clearOf(x + 60, y + 60, 100, 30)) continue;
        addWall(x, y, horiz ? L : 24, horiz ? 24 : L);
        addWall(x, y, 24, horiz ? L * 0.55 : 24);
        if (!horiz) addWall(x, y, L * 0.55, 24);
      }
    }
    // 2) decorado de la zona (cobertura total, parcial y destructibles)
    const crate = (k) => { for (let i = 0; i < 40 && k > 0; i++) if (addB(rx(), ry(), 34, 34, { crate: true, hp: 30 * sc, maxHp: 30 * sc })) k--; };
    const barrel = (k) => { for (let i = 0; i < 40 && k > 0; i++) { const x = rx(), y = ry(); if (clearOf(x, y, 15)) { A.barrels.push({ x, y, r: 15, hp: 12 * sc, maxHp: 12 * sc }); k--; } } };
    const bog = (k) => { for (let i = 0; i < 30 && k > 0; i++) { const x = rx(), y = ry(); if (zoneFree(x, y, 90)) { A.bogs.push({ x, y, rx: rand(70, 120), ry: rand(45, 80) }); k--; } } };
    if (th.id === 'calles') {
      for (let i = 0; i < 50 && A.blocks.filter(b => b.house).length < 3; i++) addB(rx() - 70, ry() - 45, rand(100, 170), rand(60, 100), { house: true });
      for (let i = 0; i < 30 && A.blocks.filter(b => b.half).length < 4; i++) addB(rx(), ry(), rand(44, 60), rand(24, 32), { half: true, cart: true });
      crate(4); barrel(3);
    } else if (th.id === 'cementerio') {
      for (let i = 0; i < 40 && A.blocks.filter(b => b.house).length < 2; i++) addB(rx() - 60, ry() - 45, 120, 90, { house: true });
      for (let i = 0; i < 140 && A.blocks.filter(b => b.half).length < 14; i++) addB(rx(), ry(), 26, 16, { half: true, tomb: true });
      crate(2); bog(2);
    } else if (th.id === 'catedral') {
      for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
        const x = A.x0 + ((c + 1) * w) / 5, y = A.y0 + ((r + 1) * h) / 3 - 40;
        if (addP(x, y, 26, { brazier: n >= 8 && (r + c) % 3 === 0 }) && n >= 8 && (r + c) % 3 === 0) A.vents.push({ x, y, t: rand(0, 5) });
      }
      for (let i = 0; i < 40 && A.blocks.filter(b => b.half).length < 6; i++) addB(rx() - 55, ry(), 110, 16, { half: true, bench: true });
      barrel(2);
    } else if (th.id === 'bosque') {
      for (let i = 0; i < 140 && A.pillars.length < 16; i++) addP(rx(), ry(), rand(18, 36), { tree: true });
      bog(3); crate(2);
    } else {
      for (let i = 0; i < 60 && A.pillars.length < 8; i++) addP(rx(), ry(), rand(24, 42), { brazier: n >= 8 && Math.random() < 0.35 });
      for (const pl of A.pillars) if (pl.brazier) A.vents.push({ x: pl.x, y: pl.y, t: rand(0, 5) });
      for (let i = 0; i < 40 && A.blocks.filter(b => !b.wall).length < 4; i++) addB(rx() - 45, ry() - 30, rand(60, 110), rand(40, 70));
      bog(2); barrel(3);
    }
    // 3) trampas de pinchos (desde el nivel 5)
    if (n >= 5 && th.id !== 'cementerio') {
      const k = 2 + Math.floor(n / 10);
      for (let i = 0, tries = 0; i < k && tries < 60; tries++) {
        const x = rx() - 32, y = ry() - 32;
        if (!clearOf(x + 32, y + 32, 40, 10) || A.traps.some(t => Math.hypot(t.x - x, t.y - y) < 120)) continue;
        A.traps.push({ kind: 'spikes', x, y, w: 64, h: 64, off: rand(0, 3.2), on: false });
        i++;
      }
    }
  }
  // 4) adornos sin colisión
  for (let i = 0; i < 26; i++) A.decor.push({ x: rand(A.x0 + 20, A.x1 - 20), y: rand(A.y0 + 20, A.y1 - 20), k: Math.floor(Math.random() * 4), s: rand(0.7, 1.3) });
  return A;
}

function startStage(startAt = 1) {
  newRun(true);
  G.mode = 'stage';
  G.stage = { n: startAt, startAt, arena: null, spawns: [], waves: 0, waveSize: 0, second: 0, cleared: false, door: null, rewards: Math.floor((startAt - 1) / 2), boss: null };
  G.rift.next = Infinity; G.nextElite = Infinity; G.hordes = [];
  enterStage();
  setState('play');
  G.player.vials = Math.max(0, G.player.vials - 5 + D().vials); // viales iniciales según la dificultad (más los comprados)
  if (G.stage.rewards > 0) openReward();
}

function enterStage() {
  const S = G.stage, p = G.player, n = S.n;
  const A = S.arena = buildArena(n);
  buildGrid(A);
  // la esencia del rastro solo espera en el primer mapa
  if (G.trace) {
    if (!G.trace.placed) {
      do { G.trace.x = rand(A.x0 + 90, A.x1 - 90); G.trace.y = rand(A.y0 + 90, 0); } while (solidAt(G.trace.x, G.trace.y, 16));
      G.trace.placed = true;
    } else { G.traceLost = G.trace.amount; G.trace = null; }
  }
  S.spawns = []; S.cleared = false; S.door = null; S.waves = 0; S.boss = null;
  G.enemies = []; G.projectiles = []; G.ebullets = []; G.pools = []; G.hazards = []; G.lure = null; G.decals = [];
  G.ai = Math.min(4, stageAI(n) + D().ai);
  G.phase = stageTheme(n).id === 'pesadilla' ? 2 : 0;
  p.x = 0; p.y = A.y1 - 90; G.cam.x = p.x; G.cam.y = p.y;
  for (const a of G.allies) { a.x = p.x - 40; a.y = p.y; }
  if (isBossStage(n)) {
    const b = S.boss = stageBoss(n);
    S.spawns.push({ x: 0, y: A.y0 + 200, type: b, t: 1.8 });
    setBanner(`Nivel ${n} · ${ETYPES[b].name}`, 3.5, '#ff3a4a');
    sfx('elite'); G.shake = 0.5;
  } else {
    const total = Math.min(60, Math.round((8 + n * 1.6) * D().count));
    S.waveSize = Math.ceil(total * 0.6); S.second = total - S.waveSize; S.waves = 1;
    spawnStageWave(S.waveSize);
    if (n >= 7 && Math.random() < 0.3 + n * 0.01) S.spawns.push({ x: rand(A.x0 + 120, A.x1 - 120), y: A.y0 + 120, type: n >= 16 && Math.random() < 0.5 ? 'tentaculo' : 'coloso', t: 1.5 });
    setBanner(`Nivel ${n} · ${stageTheme(n).name}`, 2.5, '#c9a35a');
  }
}

// enemigos que aparecen con un portal de aviso, repartidos por el mapa y lejos del cazador
function spawnStageWave(count) {
  const S = G.stage, A = S.arena, p = G.player, pool = stagePool(S.n);
  for (let i = 0; i < count; i++) {
    let x, y, tries = 0;
    do { x = rand(A.x0 + 50, A.x1 - 50); y = rand(A.y0 + 50, A.y1 - 50); tries++; }
    while ((solidAt(x, y, 16) || Math.hypot(x - p.x, y - p.y) < 280) && tries < 40);
    S.spawns.push({ x, y, type: pickWeighted(pool), t: rand(0.5, 1.2) });
  }
}

// al dejar un mapa, lo que quedó en el suelo se recoge solo
function collectAll() {
  const p = G.player;
  for (const g of G.gems) { g.x = p.x; g.y = p.y; g.pull = true; }
  for (const h of G.pickups) { h.x = p.x; h.y = p.y; h.pull = true; }
  updatePickups(0.001);
  G.gems = G.gems.filter(alive); G.pickups = G.pickups.filter(alive);
}

function updateStage(dt) {
  const S = G.stage, p = G.player;
  updateTraps(dt);
  updateFlow(dt);
  // IA 3+: asaltos coordinados: cada tanto todos los cuerpo a cuerpo se lanzan juntos
  if (G.ai >= 3 && !S.cleared) {
    S.assaultT = (S.assaultT ?? 6) - dt;
    if (S.assaultT <= 0) {
      S.assaultT = 11 - G.ai;
      let k = 0;
      for (const e of G.enemies) { const T = ETYPES[e.type]; if (!e.dead && !T.ranged && !T.healer && !T.boss) { e.frenzy = 2.5; k++; } }
      if (k >= 3) { addText(p.x, p.y - 44, '¡Asalto!', '#ff5a6a'); sfx('elite'); }
    }
  }
  for (const s of S.spawns) { s.t -= dt; if (s.t <= 0) { s.dead = true; spawnEnemy(s.type, s.x, s.y); } }
  S.spawns = S.spawns.filter(alive);
  if (!S.cleared) {
    const rem = G.enemies.filter(e => !e.dead).length + S.spawns.length;
    if (S.waves > 0 && rem <= Math.max(2, Math.floor(S.waveSize * 0.3))) { S.waves = 0; spawnStageWave(S.second); }
    if (rem === 0 && S.waves === 0) stageCleared();
  } else if (S.door && dist2(p.x, p.y, S.door.x, S.door.y) < 38 * 38) {
    collectAll();
    S.n++;
    enterStage();
  }
}

function stageCleared() {
  const S = G.stage, p = G.player, n = S.n;
  S.cleared = true;
  collectAll();
  p.hp = Math.min(p.maxHp, p.hp + p.maxHp * D().heal);
  const bonus = Math.round((10 + n * 4) * (isBossStage(n) ? 4 : 1));
  G.essence += bonus;
  addText(p.x, p.y - 40, `+${bonus} esencia`, '#ff8a9a');
  SAVE.stats.bestStage = Math.max(SAVE.stats.bestStage || 0, n);
  if (isBossStage(n)) {
    SAVE.checkpoint = Math.max(SAVE.checkpoint || 1, n + 1);
    setBanner(`¡${ETYPES[S.boss].name} cae! Nuevo punto de partida: nivel ${n + 1}`, 4, '#ffe07a');
  } else setBanner(`Nivel ${n} superado`, 2.5, '#ffe07a');
  storeSave();
  sfx('level');
  S.rewards++;
  openReward();
}

// recompensa por nivel: solo equipo (armas de fuego, cuerpo a cuerpo o piezas de atuendo)
function openReward() { G.modal = 'reward'; setState('levelup'); renderReward(); }
function renderReward() {
  const S = G.stage;
  $('luTitle').textContent = S.cleared ? `Nivel ${S.n} superado · elegí tu equipo` : `Partís del nivel ${S.n} · equipo inicial (${S.rewards} por elegir)`;
  G.options = stageRewards();
  renderCards(G.options);
}
function stageRewards() {
  const p = G.player, weapons = [];
  if (p.gun.level < STAGE_WEAPON_CAP) weapons.push({ type: 'up', kind: 'gun' });
  if (p.melee.level < STAGE_WEAPON_CAP) weapons.push({ type: 'up', kind: 'melee' });
  weapons.push(weaponOffer('gun'), weaponOffer('melee'));
  shuffle(weapons);
  const a1 = attireOffer(), a2 = attireOffer();
  const opts = [weapons[0]];
  if (a1) opts.push(a1);
  const rest = [...weapons.slice(1), a2].filter(o => o && !opts.some(x => sameOpt(x, o) && x.piece === o.piece));
  while (opts.length < 3 && rest.length) opts.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
  return shuffle(opts).map(describe);
}
function finishReward() {
  const S = G.stage, p = G.player;
  S.rewards--;
  if (S.rewards > 0) { renderReward(); return; }
  G.modal = null;
  setState('play');
  p.invuln = Math.max(p.invuln, 0.6);
  if (S.cleared) S.door = { x: 0, y: S.arena.y0 + 46 };
}

// paredes, pilares, bloques y barriles: nada atraviesa los obstáculos
function pushOutRect(o, r, b) {
  const cx = clamp(o.x, b.x, b.x + b.w), cy = clamp(o.y, b.y, b.y + b.h);
  const dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy);
  if (d >= r) return;
  if (d > 0) { o.x = cx + (dx / d) * r; o.y = cy + (dy / d) * r; return; }
  const l = o.x - b.x, rr = b.x + b.w - o.x, t = o.y - b.y, bt = b.y + b.h - o.y, m = Math.min(l, rr, t, bt);
  if (m === l) o.x = b.x - r; else if (m === rr) o.x = b.x + b.w + r; else if (m === t) o.y = b.y - r; else o.y = b.y + b.h + r;
}
function arenaClamp(o, r) {
  const A = G.stage.arena;
  o.x = clamp(o.x, A.x0 + r, A.x1 - r); o.y = clamp(o.y, A.y0 + r, A.y1 - r);
  for (const pl of [...A.pillars, ...A.barrels]) {
    const dx = o.x - pl.x, dy = o.y - pl.y, d = Math.hypot(dx, dy), m = pl.r + r;
    if (d < m && d > 0) { o.x = pl.x + (dx / d) * m; o.y = pl.y + (dy / d) * m; }
  }
  for (const b of A.blocks) pushOutRect(o, r, b);
}
// ¿bloquea balas y visión? (la cobertura parcial —tumbas, bancos, carros— no)
function inWall(x, y) {
  const A = G.stage.arena;
  if (x < A.x0 || x > A.x1 || y < A.y0 || y > A.y1) return true;
  for (const pl of A.pillars) if (dist2(x, y, pl.x, pl.y) < pl.r * pl.r) return true;
  for (const o of A.barrels) if (dist2(x, y, o.x, o.y) < o.r * o.r) return true;
  for (const b of A.blocks) if (!b.half && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  return false;
}
// ¿bloquea el paso? (incluye la cobertura parcial)
function solidAt(x, y, pad = 0) {
  if (inWall(x, y)) return true;
  for (const b of G.stage.arena.blocks) if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
  return false;
}
// ¿hay línea de visión libre entre dos puntos? (los obstáculos cubren)
function losClear(x0, y0, x1, y1) {
  if (G.mode !== 'stage') return true;
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 22);
  for (let i = 1; i < steps; i++) { const t = i / steps; if (inWall(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; }
  return true;
}
// --- Búsqueda de caminos: mapa de flujo (Dijkstra desde el cazador sobre una grilla del mapa).
// Cada enemigo mira la casilla vecina más cercana al cazador y va hacia ella: encuentran la ruta por cualquier mapa.
const GRID_CS = 32;
function buildGrid(A) {
  const cols = Math.ceil((A.x1 - A.x0) / GRID_CS), rows = Math.ceil((A.y1 - A.y0) / GRID_CS);
  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = A.x0 + (c + 0.5) * GRID_CS, y = A.y0 + (r + 0.5) * GRID_CS;
    blocked[r * cols + c] = solidAt(x, y, 12) ? 1 : 0;
  }
  A.grid = { cols, rows, blocked, dist: new Float32Array(cols * rows).fill(Infinity), t: 0, pc: -1 };
  A.gridDirty = false;
}
function cellOf(A, x, y) {
  const g = A.grid, c = clamp(Math.floor((x - A.x0) / GRID_CS), 0, g.cols - 1), r = clamp(Math.floor((y - A.y0) / GRID_CS), 0, g.rows - 1);
  return r * g.cols + c;
}
function updateFlow(dt) {
  const A = G.stage.arena, p = G.player;
  if (!A.grid || A.gridDirty) buildGrid(A);
  const g = A.grid;
  g.t -= dt;
  const pc = cellOf(A, p.x, p.y);
  if (g.t > 0 && pc === g.pc) return;
  g.t = 0.25; g.pc = pc;
  const { cols, rows, blocked, dist } = g;
  dist.fill(Infinity);
  // Dijkstra con 8 vecinos (sin cortar esquinas); la grilla es chica, alcanza con una cola simple ordenada por costo
  const open = [pc]; dist[pc] = 0;
  const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  let head = 0;
  while (head < open.length) {
    // tomar el de menor costo entre los pendientes (búsqueda lineal acotada)
    let bi = head, bd = dist[open[head]];
    for (let i = head + 1; i < Math.min(open.length, head + 64); i++) if (dist[open[i]] < bd) { bd = dist[open[i]]; bi = i; }
    const cur = open[bi]; open[bi] = open[head]; open[head] = cur; head++;
    const cr = Math.floor(cur / cols), cc = cur % cols;
    for (const [dc, dr, cost] of N8) {
      const nc = cc + dc, nr = cr + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ni = nr * cols + nc;
      if (blocked[ni]) continue;
      if (dc && dr && (blocked[cr * cols + nc] || blocked[nr * cols + cc])) continue;
      const nd = dist[cur] + cost;
      if (nd < dist[ni]) { if (dist[ni] === Infinity) open.push(ni); dist[ni] = nd; }
    }
  }
}
function flowDir(e) {
  const A = G.stage.arena, g = A.grid;
  if (!g) return null;
  const ci = cellOf(A, e.x, e.y), cr = Math.floor(ci / g.cols), cc = ci % g.cols;
  let best = g.dist[ci], bx = 0, by = 0;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const nr = cr + dr, nc = cc + dc;
    if (nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows) continue;
    const ni = nr * g.cols + nc;
    if (dc && dr && (g.blocked[cr * g.cols + nc] || g.blocked[nr * g.cols + cc])) continue;
    if (g.dist[ni] < best) { best = g.dist[ni]; bx = dc; by = dr; }
  }
  if (!bx && !by) return null;
  // apuntar al centro de la casilla elegida
  const tx = A.x0 + (cc + bx + 0.5) * GRID_CS, ty = A.y0 + (cr + by + 0.5) * GRID_CS;
  const dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}

// los enemigos rodean los obstáculos en lugar de chocar contra ellos
function steer(e, vx, vy) {
  const A = G.stage.arena, sp = Math.hypot(vx, vy);
  if (sp < 1) return [vx, vy];
  const ux = vx / sp, uy = vy / sp, look = e.r + 34, lx = e.x + ux * look, ly = e.y + uy * look;
  let nx = 0, ny = 0, hit = false;
  for (const pl of [...A.pillars, ...A.barrels]) {
    if (Math.hypot(lx - pl.x, ly - pl.y) < pl.r + e.r + 6) { nx = e.x - pl.x; ny = e.y - pl.y; hit = true; break; }
  }
  if (!hit) for (const b of A.blocks) {
    if (lx > b.x - e.r && lx < b.x + b.w + e.r && ly > b.y - e.r && ly < b.y + b.h + e.r) {
      const cx = clamp(e.x, b.x, b.x + b.w), cy = clamp(e.y, b.y, b.y + b.h);
      nx = e.x - cx; ny = e.y - cy; if (!nx && !ny) { nx = -ux; ny = -uy; }
      hit = true; break;
    }
  }
  if (!hit) return [vx, vy];
  const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
  // elige un lado y lo mantiene mientras siga bloqueado (solo cambia si la detección de atasco lo decide)
  if (!e.side || !(e.sideT > 0)) { e.side = (-ny * ux + nx * uy) >= 0 ? 1 : -1; e.sideT = 2.5; } else e.sideT = Math.max(e.sideT, 0.4);
  const tx = -ny * e.side, ty = nx * e.side;
  return [(tx * 0.85 + ux * 0.15) * sp, (ty * 0.85 + uy * 0.15) * sp];
}

// --- Destructibles: cajas (cobertura que se rompe) y barriles explosivos
function damageStructures(x, y, rad, dmg) {
  if (G.mode !== 'stage') return false;
  const A = G.stage.arena;
  let hit = false;
  for (const o of A.barrels) {
    if (o.dead || Math.hypot(o.x - x, o.y - y) > o.r + rad) continue;
    o.hp -= dmg; hit = true;
    if (o.hp <= 0) { o.dead = true; explodeAt(o.x, o.y, 95, 20 * (1 + ST() / 220), 70 * (1 + ST() / 220)); }
  }
  for (const b of A.blocks) {
    if (!b.crate || b.dead) continue;
    const cx = clamp(x, b.x, b.x + b.w), cy = clamp(y, b.y, b.y + b.h);
    if (Math.hypot(x - cx, y - cy) > rad) continue;
    b.hp -= dmg; hit = true;
    if (b.hp <= 0) { b.dead = true; burst(b.x + b.w / 2, b.y + b.h / 2, 14, '#7a5a3a'); sfx('hit'); }
  }
  if (A.barrels.some(o => o.dead) || A.blocks.some(b => b.dead)) A.gridDirty = true;
  A.barrels = A.barrels.filter(o => !o.dead);
  A.blocks = A.blocks.filter(b => !b.dead);
  return hit;
}
// explosión de área que lastima al cazador y a los enemigos (barriles, fanáticos de la pólvora)
function explodeAt(x, y, r, playerDmg, enemyDmg) {
  const p = G.player;
  if (playerDmg > 0 && dist2(x, y, p.x, p.y) < (r + p.r * 0.5) ** 2) hurtPlayer(playerDmg, 'fisico');
  if (enemyDmg > 0) for (const e of G.enemies) if (!e.dead && dist2(x, y, e.x, e.y) < (r + e.r) ** 2) hurtEnemy(e, enemyDmg, (e.x - x) / r, (e.y - y) / r, 260, 'trap', '#ffb060', 'fuego');
  G.effects.push({ kind: 'blast', x, y, r, life: 0.35, max: 0.35, htype: 'fuego' });
  burst(x, y, 24, '#ff9a3c');
  G.shake = Math.max(G.shake, 0.3);
  sfx('boom');
  if (G.mode === 'stage') damageStructures(x, y, r * 0.8, 40);
}

// --- Trampas: pinchos que salen del suelo, braseros que escupen fuego y pantanos que frenan y envenenan
function inBog(o) {
  for (const b of G.stage.arena.bogs) { const dx = (o.x - b.x) / b.rx, dy = (o.y - b.y) / b.ry; if (dx * dx + dy * dy < 1) return true; }
  return false;
}
function updateTraps(dt) {
  const A = G.stage.arena, p = G.player, sc = 1 + ST() / 220;
  for (const tr of A.traps) {
    const ph = (G.t + tr.off) % 3.2, on = ph >= 2.6;
    tr.state = on ? 'on' : ph >= 2.0 ? 'warn' : 'off';
    if (on && !tr.on) {
      const inside = o => o.x > tr.x && o.x < tr.x + tr.w && o.y > tr.y && o.y < tr.y + tr.h;
      if (inside(p)) hurtPlayer(10 * sc, 'fisico');
      for (const e of G.enemies) if (!e.dead && inside(e)) hurtEnemy(e, 40 * sc, 0, 0, 0, 'trap', '#ffb060');
      sfx('stomp');
    }
    tr.on = on;
  }
  for (const v of A.vents) {
    if (Math.random() < dt * 8 && G.particles.length < 420) G.particles.push({ x: v.x + rand(-10, 10), y: v.y - 30, vx: rand(-12, 12), vy: rand(-70, -35), life: rand(0.6, 1.2), max: 1.2, color: Math.random() < 0.5 ? '#ffb347' : '#ff6a2a', size: rand(1.5, 2.6) });
    v.t -= dt;
    if (v.t <= 0) { v.t = 5; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; hazard(v.x + Math.cos(a) * 70, v.y + Math.sin(a) * 70, 38, 1.0, 12 * sc, 'fuego', 50 * sc); } }
  }
  p.bog = A.bogs.length ? inBog(p) : false;
  if (p.bog && p.sedT <= 0 && p.poisonT <= 0) { p.poison += 14 * dt; if (p.poison >= 100) addPoison(0.01); }
}
function applyArena() {
  if (G.mode !== 'stage') return;
  arenaClamp(G.player, G.player.r);
  for (const e of G.enemies) if (!e.dead) arenaClamp(e, e.r);
  for (const a of G.allies) arenaClamp(a, 12);
  const A = G.stage.arena;
  // las balas golpean cajas y barriles antes de morir contra las paredes
  for (const pr of G.projectiles) {
    if (pr.dead || pr.kind === 'frasco') continue;
    const hitStruct = (A.barrels.length || A.blocks.some(b => b.crate)) && damageStructures(pr.x, pr.y, pr.r || 4, pr.dmg || 10);
    if (hitStruct && pr.kind !== 'onda') { pr.dead = true; continue; }
    if (inWall(pr.x, pr.y)) pr.dead = true;
  }
  for (const b of G.ebullets) {
    if (b.dead) continue;
    if (b.bounce > 0) continue; // las que rebotan se manejan en su propio movimiento
    if ((A.barrels.length || A.blocks.some(x => x.crate)) && damageStructures(b.x, b.y, b.r || 4, b.dmg * 0.5)) { b.dead = true; continue; }
    if (inWall(b.x, b.y)) b.dead = true;
  }
}

// ---------------------------------------------------------------- Fases de la noche
const NIGHT = [
  { name: 'Atardecer', until: 200 },
  { name: 'Noche cerrada', until: 400 },
  { name: 'Luna de sangre', until: RUN_LENGTH },
];
function updateNight() {
  const ph = G.t < NIGHT[0].until ? 0 : G.t < NIGHT[1].until ? 1 : 2;
  if (ph !== G.phase) {
    G.phase = ph;
    if (ph === 1) setBanner('Cae la noche cerrada. Las bestias se vuelven más salvajes.', 4);
    else setBanner('Sale la Luna de sangre. La ciudad entera enloquece.', 4, '#ff3a4a');
    sfx('phase');
    G.shake = 0.4;
  }
  if (!G.bossSpawned && G.t >= 540) {
    G.bossSpawned = true;
    spawnEnemy('campanario');
    setBanner('¡La Bestia del Campanario Rojo desciende!', 4, '#ff3a4a');
    sfx('bell'); sfx('elite');
    G.shake = 0.6;
  }
}

// ---------------------------------------------------------------- Jefes: segunda fase y ataques especiales
function hazard(x, y, r, delay, dmg, type = 'fisico', foe = 0) {
  G.hazards.push({ x, y, r, t: 0, delay, dmg, type, foe });

}
function updateBoss(e, T, dt) {
  const p = G.player;
  if (!e.phase2 && e.hp < e.maxHp * 0.5) {
    e.phase2 = true;
    e.speed *= 1.3;
    e.special = 1;
    setBanner(`${T.name} enfurece`, 3, T.eldritch ? '#b07cff' : '#ff3a4a');
    G.hitstop = 0.18;
    burst(e.x, e.y, 30, T.eldritch ? '#8a3fd0' : '#c21f35');
    sfx('phase');
    G.shake = 0.4;
  }
  // --- reglas propias de algunos jefes, fuera del ritmo de ataques
  if (e.type === 'caido' && e.phase2 && !e.beast) {
    // pierde su humanidad: se vuelve bestia, más grande y más rápida
    e.beast = true; e.sprite = 'caidoBestia'; e.size = 100; e.r = 26; e.speed *= 1.2;
    setBanner('El Cazador Caído pierde su humanidad', 3, '#ff3a4a');
    burst(e.x, e.y, 40, '#7a0f1c'); sfx('elite');
  }
  if (e.type === 'penitente') {
    // se arrodilla a rezar al 40% y al 15%: si no le hacés suficiente daño, se cura
    const thr = !e.prayStage ? 0.4 : e.prayStage === 1 ? 0.15 : -1;
    if (thr > 0 && e.hp < e.maxHp * thr) {
      e.prayStage = (e.prayStage || 0) + 1; e.praying = 3; e.prayDmg = 0; e.wind = 0; e.dash = 0;
      setBanner('La Penitente se arrodilla a rezar… ¡interrumpila!', 3, '#ffe07a'); sfx('bell');
      return;
    }
  }
  if (e.type === 'eclipse' && !e.drained && dist2(e.x, e.y, p.x, p.y) < 700 * 700) {
    // al presentarse, te arrebata la sangre: tu vida baja al 30%
    e.drained = true;
    if (p.hp > p.maxHp * 0.3) { p.hp = p.maxHp * 0.3; p.rally = 0; }
    setBanner('El Señor del Eclipse te arrebata la sangre', 3.5, '#ff3a4a');
    G.lucidFlash = 1.5; G.shake = 0.6; sfx('rift');
  }
  e.special -= dt;
  if (e.special > 0) return;
  if (e.type === 'caido') {
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    if (!e.beast) {
      e.alt = !e.alt;
      e.special = 2.3;
      if (e.alt) { // pistolazo en abanico
        for (const off of [-0.22, 0, 0.22]) G.ebullets.push({ kind: 'shot', type: 'fisico', x: e.x, y: e.y, vx: Math.cos(a + off) * 300, vy: Math.sin(a + off) * 300, life: 2, r: 4, dmg: 10 * (1 + ST() / 220) });
        sfx('shot');
      } else { // hachazo amplio frente a él
        for (const off of [-0.6, 0, 0.6]) hazard(e.x + Math.cos(a + off) * 70, e.y + Math.sin(a + off) * 70, 46, 0.55, e.dmg, 'fisico');
      }
    } else { // bestia: zarpazos alrededor y embestidas seguidas
      e.special = 2.1;
      for (let i = 0; i < 6; i++) { const b = (i / 6) * TAU; hazard(e.x + Math.cos(b) * 78, e.y + Math.sin(b) * 78, 42, 0.6, e.dmg * 0.9, 'fisico'); }
      e.lungeCd = Math.min(e.lungeCd, 0.6);
    }
    return;
  }
  if (e.type === 'hambre') {
    // charcos de sangre envenenada y embestidas frenéticas
    e.special = e.phase2 ? 2.2 : 3;
    for (let i = 0; i < (e.phase2 ? 5 : 3); i++) hazard(p.x + rand(-120, 120), p.y + rand(-120, 120), 50, 0.9, 8 * (1 + ST() / 220), 'veneno');
    e.lungeCd = Math.min(e.lungeCd, e.phase2 ? 0.5 : 1.0);
    return;
  }
  if (e.type === 'penitente') {
    // salto aplastante sobre el cazador; enfurecida, además golpea a su alrededor
    e.special = e.phase2 ? 2.4 : 3.2;
    hazard(p.x, p.y, 75, 1.0, e.dmg * 1.1, 'fisico');
    if (e.phase2) for (let i = 0; i < 4; i++) { const b = (i / 4) * TAU + 0.4; hazard(e.x + Math.cos(b) * 110, e.y + Math.sin(b) * 110, 50, 0.8, e.dmg * 0.8, 'fisico'); }
    sfx('stomp');
    return;
  }
  if (e.type === 'durmiente') {
    // lluvia de meteoros arcanos; cada dos ataques se hunde y reaparece rodeada de crías
    e.special = e.phase2 ? 2.6 : 3.5;
    for (let i = 0; i < (e.phase2 ? 8 : 6); i++) { const a = rand(0, TAU), d = i === 0 ? 0 : rand(40, 170); hazard(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 45, 1.1, 14 * (1 + ST() / 220), 'arcano'); }
    e.tp = (e.tp || 0) + 1;
    if (e.tp % 2 === 0) {
      const [x, y] = spawnPos();
      burst(e.x, e.y, 20, '#9ac8ff'); e.x = x; e.y = y; burst(x, y, 20, '#9ac8ff');
      if (G.enemies.length < MAX_ENEMIES) for (let i = 0; i < 5; i++) spawnEnemy('larva', x + rand(-60, 60), y + rand(-60, 60));
    }
    if (e.phase2) for (let i = 0; i < 8; i++) { const b = (i / 8) * TAU; hazard(e.x + Math.cos(b) * 120, e.y + Math.sin(b) * 120, 40, 0.9, 14 * (1 + ST() / 220), 'arcano'); }
    sfx('rift');
    return;
  }
  if (e.type === 'eclipse') {
    e.special = e.phase2 ? 2.2 : 3;
    e.alt = ((e.alt || 0) + 1) % 3;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    if (e.alt === 0) { // anillo de orbes
      for (let i = 0; i < 14; i++) { const b = (i / 14) * TAU; G.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(b) * 160, vy: Math.sin(b) * 160, life: 4, r: 6, dmg: 12 * (1 + ST() / 220) }); }
    } else if (e.alt === 1) { // rayo: línea de golpes hacia el cazador (tres, enfurecido)
      const offs = e.phase2 ? [-0.5, 0, 0.5] : [0];
      for (const off of offs) for (let i = 1; i <= 9; i++) hazard(e.x + Math.cos(a + off) * i * 60, e.y + Math.sin(a + off) * i * 60, 34, 0.8 + i * 0.03, 15 * (1 + ST() / 220), 'arcano');
    } else { // invoca horrores
      if (G.enemies.length < MAX_ENEMIES) for (let i = 0; i < (e.phase2 ? 4 : 2); i++) spawnEnemy(e.phase2 ? 'tentaculo' : 'ojo', e.x + rand(-90, 90), e.y + rand(-90, 90));
    }
    sfx('rift');
    return;
  }
  if (e.type === 'coloso') {
    if (!e.phase2) { e.special = 99; return; }
    // pisotón: onda de choque alrededor (se ve venir)
    e.special = 4;
    hazard(e.x, e.y, 130, 0.9, e.dmg * 1.2, 'fisico');
  } else if (e.type === 'heraldo') {
    if (!e.phase2) { e.special = 99; return; }
    // anillo de orbes arcanos
    e.special = 3.5;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      G.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, life: 4, r: 6, dmg: 10 * (1 + ST() / 300) });
    }
    sfx('rift');
  } else if (e.type === 'sepulturero') {
    // palazo: una grieta de golpes hacia el cazador; en la segunda fase, además, un anillo de fuego fatuo
    e.special = e.phase2 ? 3 : 3.6;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    for (let i = 1; i <= 5; i++) hazard(e.x + Math.cos(a) * i * 55, e.y + Math.sin(a) * i * 55, 40, 0.7 + i * 0.12, e.dmg * 0.9, 'fisico');
    if (e.phase2) for (let i = 0; i < 8; i++) { const b = (i / 8) * TAU; hazard(e.x + Math.cos(b) * 130, e.y + Math.sin(b) * 130, 45, 1.0, 18 * (1 + ST() / 300), 'arcano'); }
    e.digT = (e.digT || 0) + 1;
    if (e.digT % 2 === 0 && G.enemies.length < MAX_ENEMIES) for (let i = 0; i < 3; i++) spawnEnemy('aldeano', e.x + rand(-60, 60), e.y + rand(-60, 60));
    sfx('stomp');
  } else if (e.type === 'campanario') {
    if (!e.phase2) {
      // primera fase: llama a una bandada de murciélagos
      e.special = 6;
      if (G.enemies.length < MAX_ENEMIES) for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; spawnEnemy('murcielago', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60); }
      sfx('bell');
    } else {
      // segunda fase: lluvia de sangre sobre el cazador
      e.special = 2.6;
      for (let i = 0; i < 5; i++) {
        const a = rand(0, TAU), d = i === 0 ? 0 : rand(40, 150);
        hazard(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 55, 1.0, 20 * (1 + ST() / 300), 'arcano');
      }
      sfx('bell');
    }
  }
}
function updateHazards(dt) {
  const p = G.player;
  for (const hz of G.hazards) {
    hz.t += dt;
    if (hz.t >= hz.delay) {
      hz.dead = true;
      if (hz.foe) for (const e of G.enemies) if (!e.dead && dist2(hz.x, hz.y, e.x, e.y) < (hz.r + e.r) ** 2) hurtEnemy(e, hz.foe, 0, 0, 0, 'trap', '#ffb060', hz.type === 'fuego' ? 'fuego' : undefined);
      if (dist2(hz.x, hz.y, p.x, p.y) < (hz.r + p.r * 0.5) ** 2) {
        if (hurtPlayer(hz.dmg, hz.type === 'veneno' || hz.type === 'fuego' ? 'fisico' : hz.type) && hz.type === 'veneno') addPoison(45);
      }
      G.effects.push({ kind: 'blast', x: hz.x, y: hz.y, r: hz.r, life: 0.3, max: 0.3, htype: hz.type });
      sfx('stomp');
    }
  }
}

const alive = x => !x.dead;
function update(dt) {
  G.t += dt;
  const stage = G.mode === 'stage';
  if (!stage && G.t >= RUN_LENGTH) { G.t = RUN_LENGTH; gameOver(true); return; }
  updatePlayer(dt);
  if (stage) { updateStage(dt); if (state !== 'play') return; }
  else { spawnDirector(dt); updateNight(); updateRift(dt); }
  updateHazards(dt);
  updateEnemies(dt);
  if (state !== 'play') return; // murió este frame
  separate();
  applyArena();
  G.player.alert = enemyInRange();
  updateGun(dt);
  updateMelee(dt);
  updateTools(dt);
  updateProjectiles(dt);
  updateEffects(dt);
  updatePools(dt);
  updatePickups(dt);
  updateAllies(dt);
  updateParticles(dt);
  G.enemies = G.enemies.filter(alive);
  G.projectiles = G.projectiles.filter(alive);
  G.ebullets = G.ebullets.filter(alive);
  G.hazards = G.hazards.filter(alive);
  G.ghosts = G.ghosts.filter(alive);
  G.allies = G.allies.filter(alive);
  G.effects = G.effects.filter(alive);
  G.pools = G.pools.filter(alive);
  G.gems = G.gems.filter(alive);
  G.pickups = G.pickups.filter(alive);
  G.particles = G.particles.filter(alive);
  G.texts = G.texts.filter(alive);
  if (G.pendingLevels > 0) openLevelUp();
  else if (G.gemQueue.length) openGemModal();
}

// ---------------------------------------------------------------- Dibujo
// ================================================================ Efectos visuales
// --- Iluminación dinámica: un mapa de oscuridad al que se le "recortan" las luces del farol, braseros, disparos, fuego…
const LIGHT_SPR = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return c;
})();
const GLOW_CACHE = {};
function glowSpr(col) {
  if (GLOW_CACHE[col]) return GLOW_CACHE[col];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${col},0.9)`); gr.addColorStop(0.4, `rgba(${col},0.35)`); gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return (GLOW_CACHE[col] = c);
}
const lightCv = document.createElement('canvas'), lctx = lightCv.getContext('2d');
const WARM = '255,170,90', FIRE = '255,120,40', ARC = '170,100,255', BLOOD = '230,40,60', COLD = '140,190,255', GOLD = '255,220,130';

function darknessLevel() {
  if (G.mode === 'stage') return { calles: 0.8, cementerio: 0.85, catedral: 0.74, bosque: 0.88, pesadilla: 0.83 }[G.stage.arena.theme.id] || 0.8;
  return 0.68 + 0.16 * clamp(G.t / RUN_LENGTH, 0, 1);
}

function collectLights(x0, y0) {
  const L = [], p = G.player;
  const add = (x, y, r, a = 1, col = null, glow = 0) => {
    if (x < x0 - r || y < y0 - r || x > x0 + W + r || y > y0 + H + r) return;
    L.push({ x, y, r, a, col, glow });
  };
  // el farol del cazador (titila apenas)
  const fl = 1 + Math.sin(G.t * 11) * 0.03 + Math.sin(G.t * 23) * 0.02;
  add(p.x, p.y - 6, 250 * fl, 1, WARM, 0.18);
  for (const a of G.allies) add(a.x, a.y, 150, 0.8, COLD, 0.15);
  if (G.muzzle) add(G.muzzle.x, G.muzzle.y, 140, 0.9, GOLD, 0.45);
  for (const pl of G.pools) add(pl.x, pl.y, pl.r * 2.6, 0.9 * Math.min(1, pl.life / 0.5), FIRE, 0.35);
  for (const t of G.player.tools) if (t.orbs) for (const o of t.orbs) add(o.x, o.y, 95, 0.8, FIRE, 0.3);
  let n = 0;
  for (const pr of G.projectiles) {
    if (n++ > 60) break;
    if (pr.kind === 'bala') add(pr.x, pr.y, pr.boom ? 70 : 45, 0.55, pr.boom ? ARC : GOLD, 0.25);
    else if (pr.kind === 'astral') add(pr.x, pr.y, 70, 0.7, ARC, 0.35);
    else if (pr.kind === 'onda') add(pr.x, pr.y, 110, 0.8, GOLD, 0.35);
  }
  n = 0;
  for (const b of G.ebullets) {
    if (n++ > 70) break;
    if (b.kind === 'shot' || b.kind === 'bolt') add(b.x, b.y, 40, 0.5, FIRE, 0.25);
    else if (b.kind === 'spit') add(b.x, b.y, 40, 0.45, '120,230,80', 0.3);
    else add(b.x, b.y, 60, 0.6, ARC, 0.35);
  }
  for (const fx of G.effects) {
    const k = fx.max ? clamp(fx.life / fx.max, 0, 1) : 1;
    if (fx.kind === 'blast') add(fx.x, fx.y, fx.r * 2.4, k, fx.htype === 'veneno' ? '90,200,80' : fx.htype === 'arcano' ? ARC : FIRE, 0.5 * k);
    else if (fx.kind === 'boom') add(fx.x, fx.y, fx.r * 2.4, k, ARC, 0.5 * k);
    else if (fx.kind === 'ring') add(fx.x, fx.y, fx.r * 1.3, 0.6, GOLD, 0.2);
    else if (fx.kind === 'roar') add(fx.x, fx.y, fx.r * 1.4, k * 0.7, WARM, 0.25);
  }
  for (const hz of G.hazards) {
    const k = clamp(hz.t / hz.delay, 0, 1);
    if (hz.type === 'fuego') add(hz.x, hz.y, hz.r * 1.8, 0.3 + k * 0.4, FIRE, 0.25 * k);
    else if (hz.type === 'arcano') add(hz.x, hz.y, hz.r * 1.8, 0.3 + k * 0.4, ARC, 0.25 * k);
    else add(hz.x, hz.y, hz.r * 1.5, 0.25 + k * 0.3, BLOOD, 0.15 * k);
  }
  for (const e of G.enemies) {
    if (e.dead) continue;
    const T = ETYPES[e.type];
    if (T.boss || T.elite) add(e.x, e.y, (e.size || T.size) * 1.3, 0.55, T.eldritch ? ARC : BLOOD, 0.22);
    else if (e.type === 'ojo' || e.type === 'acechante') add(e.x, e.y, 60, 0.4, ARC, 0.2);
    else if (e.type === 'aldeano' || e.type === 'lanzador') add(e.x + 12 * e.face, e.y - 12, 70, 0.55, FIRE, 0.25); // antorchas
    if (e.wind > 0 || e.aimT > 0) add(e.x, e.y, 70, 0.6, BLOOD, 0.35);
    if (e.affix) add(e.x, e.y, 70, 0.4, GOLD, 0.2);
  }
  let gcount = 0;
  for (const g of G.gems) { if (gcount++ > 50) break; add(g.x, g.y, 26, 0.35, g.v >= 20 ? BLOOD : g.v >= 5 ? GOLD : COLD, 0.25); }
  for (const h of G.pickups) add(h.x, h.y, 36, 0.4, h.kind === 'gem' ? GOLD : WARM, 0.2);
  if (G.trace) add(G.trace.x, G.trace.y, 110, 0.7, BLOOD, 0.4);
  if (G.mode === 'stage') {
    const S = G.stage, A = S.arena;
    for (const v of A.vents) { const hot = v.t < 1.2; add(v.x, v.y - 6, hot ? 190 : 140, 0.9, FIRE, hot ? 0.5 : 0.3); }
    for (const tr of A.traps) if (tr.state !== 'off') add(tr.x + 32, tr.y + 32, 70, 0.5, BLOOD, tr.state === 'on' ? 0.35 : 0.2);
    for (const s of S.spawns) add(s.x, s.y, 60, 0.6, BLOOD, 0.35);
    for (const d of A.decor) if (d.k === 3) add(d.x, d.y - 8, 55, 0.55, WARM, 0.2);
    for (const b of A.blocks) if (b.house) for (let wx = b.x + 12; wx < b.x + b.w - 10; wx += 28) add(wx + 4, b.y + b.h, 75, 0.6, WARM, 0.25);
    if (S.door) add(S.door.x, S.door.y, 150, 0.9, isBossStage(S.n + 1) ? BLOOD : GOLD, 0.4);
  } else {
    // farolas de la ciudad (mismo patrón que el decorado)
    const cell = 220, gx0 = Math.floor(x0 / cell) - 1, gx1 = Math.floor((x0 + W) / cell) + 1, gy0 = Math.floor(y0 / cell) - 1, gy1 = Math.floor((y0 + H) / cell) + 1;
    for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
      const h = hash(gx, gy), kind = h % 100;
      if (kind >= 10 && kind < 15) add(gx * cell + ((h >>> 8) % 160) + 30, gy * cell + ((h >>> 16) % 160) + 30 - 30, 190, 0.85, WARM, 0.25);
    }
  }
  return L;
}

function renderLights(x0, y0) {
  if (!canvas.width || !canvas.height) return; // ventana sin tamaño (pestaña oculta)
  const L = collectLights(x0, y0);
  const lw = Math.floor(W * DPR), lh = Math.floor(H * DPR);
  if (lightCv.width !== lw || lightCv.height !== lh) { lightCv.width = lw; lightCv.height = lh; }
  lctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  lctx.globalCompositeOperation = 'source-over';
  lctx.globalAlpha = 1;
  lctx.fillStyle = `rgba(5,3,9,${darknessLevel()})`;
  lctx.clearRect(0, 0, W, H); lctx.fillRect(0, 0, W, H);
  lctx.globalCompositeOperation = 'destination-out';
  for (const l of L) { lctx.globalAlpha = clamp(l.a, 0, 1); lctx.drawImage(LIGHT_SPR, l.x - x0 - l.r, l.y - y0 - l.r, l.r * 2, l.r * 2); }
  lctx.globalAlpha = 1; lctx.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(lightCv, 0, 0); ctx.restore();
  // resplandor de color (suma de luz)
  ctx.globalCompositeOperation = 'lighter';
  for (const l of L) {
    if (!l.col || l.glow <= 0) continue;
    ctx.globalAlpha = clamp(l.glow, 0, 1);
    const r = l.r * 0.75;
    ctx.drawImage(glowSpr(l.col), l.x - x0 - r, l.y - y0 - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

// --- Niebla que se arrastra por el suelo
const FOG_SPR = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(170,160,190,0.5)'); gr.addColorStop(1, 'rgba(170,160,190,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return c;
})();
function drawFog(x0, y0) {
  const tint = G.mode === 'stage' && G.stage.arena.theme.id === 'pesadilla' ? 0.12 : 0.08;
  ctx.globalAlpha = tint;
  for (let i = 0; i < 7; i++) {
    const span = W + 700, sp = 10 + (i % 3) * 6;
    const fx = x0 - 350 + (((i * 397 + G.t * sp * (i % 2 ? 1 : -1)) % span) + span) % span;
    const fy = y0 + ((i * 263) % (H + 200)) - 100 + Math.sin(G.t * 0.2 + i) * 30;
    const s = 380 + (i % 3) * 120;
    ctx.drawImage(FOG_SPR, fx - s / 2, fy - s / 2, s, s * 0.6);
  }
  ctx.globalAlpha = 1;
}

// --- Viñeta y grano de película
const GRAIN = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  return c;
})();
const grainPattern = ctx.createPattern(GRAIN, 'repeat');
// Brasas que suben y ceniza que cae, en espacio de pantalla
function drawEmbers() {
  const t = G.t, emb = G.rift && G.rift.active ? ['#c9a0ff', '#8a5ad0'] : ['#ffb45a', '#e0502a'];
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 34; i++) {
    const h = hash(i, 77), sp = 14 + (h % 22), life = H + 40;
    const y = H + 20 - ((t * sp + (h >>> 5) % 1000) % life);
    const x = ((h >>> 9) % 1000) / 1000 * W + Math.sin(t * (0.6 + (h % 7) * 0.15) + i) * 14;
    const fl = 0.5 + 0.5 * Math.sin(t * 7 + i * 1.7);
    ctx.globalAlpha = (0.35 + fl * 0.55) * Math.min(1, (H + 20 - y) / 120);
    ctx.fillStyle = emb[i % 2];
    const s = i % 5 === 0 ? 2 : 1;
    ctx.fillRect(Math.round(x), Math.round(y), s, s);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 26; i++) {
    const h = hash(i, 131), sp = 8 + (h % 10);
    const y = ((t * sp + (h >>> 5) % 1000) % (H + 20)) - 10;
    const x = (((h >>> 9) % 1000) / 1000 * W + t * 6 + Math.sin(t * 0.8 + i) * 10) % W;
    ctx.globalAlpha = 0.25 + (h % 3) * 0.1;
    ctx.fillStyle = i % 3 ? '#8a8078' : '#b8aca0';
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  ctx.globalAlpha = 1;
}

function drawPost() {
  // gradación cálida de atardecer sangriento: sombras violáceas, luces ámbar
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const gr = ctx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, 'rgba(210,110,70,0.55)'); gr.addColorStop(1, 'rgba(120,40,60,0.5)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  const R = Math.max(W, H);
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, R * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.05; ctx.globalCompositeOperation = 'overlay';
  ctx.translate(-Math.random() * 128, -Math.random() * 128);
  ctx.fillStyle = grainPattern; ctx.fillRect(0, 0, W + 128, H + 128);
  ctx.restore();
}

// --- Manchas de sangre que quedan en el piso
const DECALS = [0, 1, 2, 3].map(seed => makeSprite(48, g => {
  g.fillStyle = seed === 3 ? 'rgba(60,20,80,0.7)' : 'rgba(90,8,18,0.75)';
  blob(g, 12, 14, 0.9, 300 + seed); g.fill();
  for (let i = 0; i < 6; i++) { const a = (hash(i, seed) % 628) / 100, d = 13 + (hash(seed, i) % 9); g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, 1.5 + (i % 3), 0, TAU); g.fill(); }
}));
function addDecal(x, y, eld, big) {
  if (!G.decals) G.decals = [];
  if (G.decals.length > 180) G.decals.shift();
  G.decals.push({ x, y, k: eld ? 3 : Math.floor(Math.random() * 3), s: (big ? 1.8 : 1) * rand(0.7, 1.2), rot: rand(0, TAU) });
}
function drawDecals(vis) {
  if (!G.decals) return;
  for (const d of G.decals) {
    if (!vis(d.x, d.y, 40)) continue;
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot);
    ctx.drawImage(DECALS[d.k], -24 * d.s, -24 * d.s, 48 * d.s, 48 * d.s);
    ctx.restore();
  }
}

// --- Contorno oscuro para que cada figura se lea sobre el fondo
function outlineOf(src) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, -2], [-2, 2], [2, 2]]) g.drawImage(src, dx, dy);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#07040a'; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-over'; g.drawImage(src, 0, 0);
  return c;
}

// --- Pisos por zona (patrones que se repiten sin costuras)
function makeFloor(fn) {
  const c = document.createElement('canvas'); c.width = c.height = 192;
  const g = c.getContext('2d');
  fn(g, 192);
  return ctx.createPattern(c, 'repeat');
}
const FLOORS = {
  calles: makeFloor((g, S) => {
    g.fillStyle = '#16121a'; g.fillRect(0, 0, S, S);
    const shades = ['#221c26', '#262029', '#1e1922', '#2a232d', '#201a24'];
    for (let row = 0; row < 8; row++) for (let col = -1; col <= 8; col++) {
      const x = col * 24 + (row % 2 ? 12 : 0), y = row * 24, h = hash((col + 8) % 8, row + 50);
      g.fillStyle = shades[h % 5]; g.beginPath(); g.ellipse(x + 12, y + 12, 10.5, 10, (h % 7) / 10, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,240,220,0.04)'; g.beginPath(); g.ellipse(x + 10, y + 9, 6, 4, 0, 0, TAU); g.fill();
    }
  }),
  cementerio: makeFloor((g, S) => {
    g.fillStyle = '#141a14'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 9; i++) { const h = hash(i, 71); g.fillStyle = 'rgba(40,30,20,0.5)'; g.beginPath(); g.ellipse(h % S, (h >>> 8) % S, 20 + h % 18, 10 + h % 9, 0, 0, TAU); g.fill(); }
    for (let i = 0; i < 260; i++) {
      const h = hash(i, 73), x = h % S, y = (h >>> 9) % S;
      g.strokeStyle = (h % 3) ? '#22301c' : '#2e3e22'; g.lineWidth = 1;
      for (const ox of [0, S, -S]) { g.beginPath(); g.moveTo(x + ox, y); g.lineTo(x + ox + ((h >>> 4) % 5) - 2, y - 4 - (h % 4)); g.stroke(); }
    }
  }),
  catedral: makeFloor((g, S) => {
    const T = 48;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      g.fillStyle = (r + c) % 2 ? '#2a2430' : '#1c1822'; g.fillRect(c * T, r * T, T, T);
      g.strokeStyle = 'rgba(255,255,255,0.04)'; g.lineWidth = 1;
      const h = hash(c, r + 90); g.beginPath(); g.moveTo(c * T + h % T, r * T); g.quadraticCurveTo(c * T + T / 2, r * T + (h >>> 5) % T, c * T + (h >>> 9) % T, r * T + T); g.stroke();
    }
    g.strokeStyle = '#0e0b12'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * T, 0); g.lineTo(i * T, S); g.stroke(); g.beginPath(); g.moveTo(0, i * T); g.lineTo(S, i * T); g.stroke(); }
  }),
  bosque: makeFloor((g, S) => {
    g.fillStyle = '#10170e'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 14; i++) { const h = hash(i, 111); g.fillStyle = 'rgba(30,50,20,0.55)'; g.beginPath(); g.ellipse(h % S, (h >>> 8) % S, 24, 14, (h % 6) / 2, 0, TAU); g.fill(); }
    for (let i = 0; i < 70; i++) {
      const h = hash(i, 113), x = h % S, y = (h >>> 9) % S;
      g.fillStyle = ['#3a2a14', '#2a3a18', '#4a3218'][h % 3];
      g.save(); g.translate(x, y); g.rotate((h % 628) / 100); g.beginPath(); g.ellipse(0, 0, 4, 2, 0, 0, TAU); g.fill(); g.restore();
    }
    g.strokeStyle = 'rgba(40,28,16,0.8)'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const h = hash(i, 117); g.beginPath(); g.moveTo(h % S, (h >>> 8) % S); g.quadraticCurveTo((h >>> 3) % S, (h >>> 11) % S, (h >>> 5) % S, (h >>> 13) % S); g.stroke(); }
  }),
  pesadilla: makeFloor((g, S) => {
    g.fillStyle = '#140a1a'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 28; i++) {
      const h = hash(i, 131), x = h % S, y = (h >>> 8) % S, r = 10 + h % 16;
      for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
        g.fillStyle = (h % 2) ? '#1e1028' : '#24122e'; g.beginPath(); g.arc(x + ox, y + oy, r, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(120,40,140,0.35)'; g.lineWidth = 1; g.stroke();
      }
    }
  }),
};

// ================================================================ Apariencia del cazador según su atuendo
// Cada pieza (cabeza, torso, brazos, piernas) se dibuja por capas según el conjunto al que pertenece,
// así las combinaciones mezcladas se ven tal cual. Diseños propios inspirados en ropa victoriana y gótica.
//   viaje   · ropa de viaje: abrigo corto marrón, bufanda roja y gorra
//   sereno  · capote gris azulado con esclavina doble y sombrero redondo de ala ancha
//   gaban   · gabán largo abierto, chaleco con hebillas, brazales labrados y chistera
//   habito  · hábito claro con capucha honda, estola oscura y cordón
//   vigia   · armadura de escamas de hierro, yelmo cerrado y capa carmesí deshilachada
//   velo    · manto de plumas negras, capucha alta y velo estrellado
const OUTFIT_STYLE = {
  viaje:  { pants: '#3a3026', boot: '#2e2218', bootH: 3,  coat: ['#5a4632', '#3a2c1e'], coatLen: 11, sleeve: '#4a3a2a', hand: '#c8b8a0' },
  sereno: { pants: '#2a2c34', boot: '#141218', bootH: 7,  coat: ['#4a525c', '#262a32'], coatLen: 17, sleeve: '#3a4048', hand: '#18161c' },
  gaban:  { pants: '#3a3228', boot: '#18141a', bootH: 8,  coat: ['#3a383e', '#1a181e'], coatLen: 18, sleeve: '#2e2c32', hand: '#141218' },
  habito: { pants: '#8a847a', boot: '#bdb6a8', bootH: 3,  coat: ['#d4cebf', '#9a9488'], coatLen: 19, sleeve: '#c8c2b4', hand: '#d8c6ad' },
  vigia:  { pants: '#3a3a42', boot: '#5a5a62', bootH: 7,  coat: ['#6a6a74', '#34343c'], coatLen: 13, sleeve: '#5a5a64', hand: '#4a4a52' },
  velo:   { pants: '#141018', boot: '#1e1a24', bootH: 6,  coat: ['#1e1828', '#0a0810'], coatLen: 20, sleeve: '#181422', hand: '#120e16' },
};

function drawOutfitLegs(g, id, k) {
  const S = OUTFIT_STYLE[id];
  const lift = [Math.max(0, k) * 2, Math.max(0, -k) * 2];
  [[-6 + k * 2, lift[0]], [2 - k * 2, lift[1]]].forEach(([x, up]) => {
    g.fillStyle = S.pants; g.fillRect(x, 9, 4, 10 - up);
    g.fillStyle = S.boot; g.fillRect(x - 1, 21 - up - S.bootH, 6, S.bootH);
    if (id === 'sereno' || id === 'gaban') { g.fillStyle = '#5a4630'; g.fillRect(x - 1, 21 - up - S.bootH + 2, 6, 1); }
    if (id === 'vigia') { g.fillStyle = '#8a8a94'; g.fillRect(x, 12 - up * 0.5, 4, 2); g.fillRect(x, 21 - up - S.bootH, 4, 1); }
    if (id === 'velo') { g.fillStyle = '#b8b8c8'; g.fillRect(x + 1, 21 - up - 4, 2, 1); }
  });
}

function drawOutfitCape(g, id, sw) {
  // capas que van por detrás del cuerpo
  if (id === 'vigia') {
    g.fillStyle = '#5a1018';
    g.beginPath(); g.moveTo(-9, -5); g.lineTo(9, -5); g.lineTo(13 + sw, 20);
    for (let x = 13; x > -13; x -= 3.2) g.lineTo(x + sw * (x / 13), 20 + ((x | 0) % 2 ? 3 : -1));
    g.closePath(); g.fill();
    g.fillStyle = '#7a1a24'; g.fillRect(-9, -5, 3, 20);
  } else if (id === 'velo') {
    // manto de plumas: abanico de trazos oscuros
    g.fillStyle = '#0e0a14';
    g.beginPath(); g.moveTo(-10, -6); g.lineTo(10, -6); g.lineTo(17 + sw, 22); g.lineTo(-17 + sw, 22); g.closePath(); g.fill();
    g.strokeStyle = '#2a2236'; g.lineWidth = 1.2;
    for (let i = -16; i <= 16; i += 2.2) { g.beginPath(); g.moveTo(i * 0.55, -2); g.lineTo(i + sw, 22 + ((i * 7) % 3)); g.stroke(); }
  }
}

function drawOutfitTorso(g, id, sw) {
  const S = OUTFIT_STYLE[id], L = S.coatLen;
  const cg = g.createLinearGradient(-12, -4, 12, L); cg.addColorStop(0, S.coat[0]); cg.addColorStop(1, S.coat[1]);
  g.fillStyle = cg;
  // abrigo con faldones que se balancean
  g.beginPath(); g.moveTo(-8, -4); g.lineTo(8, -4); g.lineTo(11 + sw, L); g.lineTo(3 + sw * 0.5, L - 3); g.lineTo(0, L + 1); g.lineTo(-3 + sw * 0.5, L - 3); g.lineTo(-11 + sw, L); g.closePath(); g.fill();
  if (id === 'viaje') {
    g.fillStyle = '#4a3826'; g.fillRect(-8, 4, 16, 2.2);
    g.fillStyle = '#7a2a22'; g.beginPath(); g.moveTo(-7, -5); g.lineTo(7, -5); g.lineTo(5, -1); g.lineTo(-5, -1); g.closePath(); g.fill();
    g.fillRect(2, -1, 3, 7); // punta de la bufanda
  } else if (id === 'sereno') {
    g.fillStyle = '#c9a35a'; for (const y of [0, 4, 8, 12]) { g.beginPath(); g.arc(-1.5, y, 0.8, 0, TAU); g.arc(1.5, y, 0.8, 0, TAU); g.fill(); }
    // esclavina doble
    g.fillStyle = '#2c3038'; g.beginPath(); g.moveTo(-11, -5); g.lineTo(11, -5); g.lineTo(12, 3); g.lineTo(-12, 3); g.closePath(); g.fill();
    g.fillStyle = '#3a4048'; g.beginPath(); g.moveTo(-9, -5); g.lineTo(9, -5); g.lineTo(9.5, -0.5); g.lineTo(-9.5, -0.5); g.closePath(); g.fill();
  } else if (id === 'gaban') {
    // abierto: chaleco marrón con hebillas y correa cruzada
    g.fillStyle = '#4a3626'; g.fillRect(-4, -4, 8, 11);
    g.fillStyle = '#c9a35a'; for (const y of [-2, 1, 4]) g.fillRect(-2.5, y, 5, 1.2);
    g.strokeStyle = '#2a1a10'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-7, -4); g.lineTo(7, 8); g.stroke();
    g.fillStyle = '#e8e0d0'; g.beginPath(); g.moveTo(-2, -5); g.lineTo(0, -1); g.lineTo(2, -5); g.closePath(); g.fill();
    g.strokeStyle = '#c9a35a'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-4, 5); g.quadraticCurveTo(-6, 8, -5, 11); g.stroke(); // cadena de reloj
  } else if (id === 'habito') {
    g.fillStyle = '#2a2430'; g.fillRect(-2, -4, 4, L - 2);
    g.fillStyle = '#c9a35a'; g.fillRect(-1, 2, 2, 4); g.fillRect(-2.5, 3.2, 5, 1.4);
    g.strokeStyle = '#8a7a5a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-8, 5); g.lineTo(8, 5); g.stroke();
    g.beginPath(); g.moveTo(5, 5); g.lineTo(6, 11); g.stroke();
  } else if (id === 'vigia') {
    // escamas de hierro en hileras
    for (let r = 0; r < 5; r++) for (let c = -3; c <= 3; c++) {
      const x = c * 2.6 + (r % 2 ? 1.3 : 0), y = -3 + r * 3;
      g.fillStyle = r % 2 ? '#7a7a84' : '#5e5e68'; g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI); g.fill();
    }
    g.fillStyle = '#2a2420'; g.fillRect(-8, 10, 16, 2);
    g.fillStyle = '#9a9aa6'; g.fillRect(-1.5, 10, 3, 2);
  } else if (id === 'velo') {
    g.fillStyle = '#3a2050'; g.fillRect(-3, -4, 6, L - 4);
    g.strokeStyle = '#b8b8c8'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-6, -2); g.quadraticCurveTo(0, 3, 6, -2); g.stroke();
    g.beginPath(); g.moveTo(-5, 2); g.quadraticCurveTo(0, 6, 5, 2); g.stroke();
    g.fillStyle = '#d8d8ff'; g.beginPath(); g.arc(0, 4.5, 1, 0, TAU); g.fill();
  }
}

// brazos articulados: P.rh = mano derecha (estoque), P.blade = ángulo del estoque, P.gunOut = pistola apuntando al frente
function drawOutfitArms(g, id, P = {}) {
  const S = OUTFIT_STYLE[id];
  const rh = P.rh || [9, 7], ba = P.blade ?? -0.9;
  const lh = P.gunOut ? [14, -1] : [-9, 6];
  const ls = P.gunOut ? [-3, -2] : [-9, -2];
  const w = id === 'habito' ? 6 : 4.2;
  const arm = (sx, sy, hx, hy) => {
    g.strokeStyle = S.sleeve; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx, hy); g.stroke();
    const mx = sx + (hx - sx) * 0.72, my = sy + (hy - sy) * 0.72;
    if (id === 'gaban') { g.strokeStyle = '#8a7040'; g.lineWidth = w + 0.6; g.beginPath(); g.moveTo(mx - (hx - sx) * 0.1, my - (hy - sy) * 0.1); g.lineTo(mx + (hx - sx) * 0.12, my + (hy - sy) * 0.12); g.stroke(); }
    if (id === 'vigia') { g.strokeStyle = '#8a8a94'; g.lineWidth = w + 0.8; g.beginPath(); g.moveTo(mx - (hx - sx) * 0.12, my - (hy - sy) * 0.12); g.lineTo(mx + (hx - sx) * 0.15, my + (hy - sy) * 0.15); g.stroke(); }
    if (id === 'velo') { g.strokeStyle = '#2a2236'; g.lineWidth = 1; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(mx + i - 1, my); g.lineTo(mx + i - 2, my + 6); g.stroke(); } }
    g.fillStyle = S.hand; g.beginPath(); g.arc(hx, hy, 1.8, 0, TAU); g.fill();
  };
  // brazo de la pistola (por detrás cuando no apunta)
  arm(ls[0], ls[1], lh[0], lh[1]);
  if (P.gunOut) {
    g.fillStyle = '#2a2730'; g.fillRect(lh[0], lh[1] - 1.8, 10, 3); g.fillStyle = '#8a8a96'; g.fillRect(lh[0] + 3, lh[1] - 1.8, 7, 1);
    g.fillStyle = '#5a4630'; g.fillRect(lh[0] - 1, lh[1], 3, 4);
  } else {
    g.fillStyle = '#2a2730'; g.fillRect(lh[0] - 9, lh[1] - 2, 9, 3); g.fillStyle = '#5a4630'; g.fillRect(lh[0] - 2, lh[1] - 1, 3, 5);
    g.fillStyle = '#8a8a96'; g.fillRect(lh[0] - 9, lh[1] - 2, 6, 1);
  }
  // brazo del estoque
  arm(8, -2, rh[0], rh[1]);
  const tx = rh[0] + Math.cos(ba) * 16, ty = rh[1] + Math.sin(ba) * 16;
  g.strokeStyle = '#d4d8e4'; g.lineWidth = 2.1; g.beginPath(); g.moveTo(rh[0], rh[1]); g.lineTo(tx, ty); g.stroke();
  g.strokeStyle = '#ffffff'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(rh[0] + Math.cos(ba) * 2, rh[1] + Math.sin(ba) * 2 - 0.6); g.lineTo(tx, ty - 0.6); g.stroke();
  const px = -Math.sin(ba) * 2.4, py = Math.cos(ba) * 2.4;
  g.strokeStyle = '#c9a35a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(rh[0] + px, rh[1] + py); g.lineTo(rh[0] - px, rh[1] - py); g.stroke();
}


function drawOutfitHead(g, id) {
  if (id === 'habito') { // capucha honda, rostro en sombra
    g.fillStyle = '#bdb6a8'; g.beginPath(); g.moveTo(-8, -4); g.quadraticCurveTo(-9, -19, 0, -21); g.quadraticCurveTo(9, -19, 8, -4); g.closePath(); g.fill();
    g.fillStyle = '#1a1418'; g.beginPath(); g.ellipse(0, -10, 4.5, 5.5, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,230,180,0.7)'; g.fillRect(-2.4, -11, 1.4, 1); g.fillRect(1, -11, 1.4, 1);
    g.strokeStyle = '#8a847a'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-6, -15); g.quadraticCurveTo(0, -19, 6, -15); g.stroke();
    return;
  }
  if (id === 'vigia') { // yelmo cerrado con visera
    g.fillStyle = '#cfcac0'; g.fillRect(-6, -10, 3, 9); // mechones de pelo claro por detrás
    const hg = g.createLinearGradient(-6, -20, 6, -4); hg.addColorStop(0, '#8a8a94'); hg.addColorStop(1, '#3e3e46');
    g.fillStyle = hg; g.beginPath(); g.moveTo(-6, -4); g.lineTo(-6.5, -13); g.quadraticCurveTo(0, -22, 6.5, -13); g.lineTo(6, -4); g.closePath(); g.fill();
    g.fillStyle = '#0a0a0e'; g.fillRect(-4.5, -12, 9, 1.6);
    g.fillStyle = '#b0b0ba'; g.fillRect(-0.6, -21, 1.2, 9);
    return;
  }
  if (id === 'velo') { // capucha alta en punta con velo estrellado
    g.fillStyle = '#120e18'; g.beginPath(); g.moveTo(-8, -4); g.lineTo(-6, -16); g.lineTo(1, -30); g.lineTo(6, -16); g.lineTo(8, -4); g.closePath(); g.fill();
    g.fillStyle = '#1e1428'; g.beginPath(); g.ellipse(0, -9, 5, 6, 0, 0, TAU); g.fill();
    g.fillStyle = '#d8d8ff'; for (const [x, y] of [[-2.5, -11], [2, -12], [0, -8], [-1.5, -6], [2.6, -7]]) g.fillRect(x, y, 0.9, 0.9);
    g.fillStyle = '#b07cff'; g.fillRect(-2.6, -10.5, 1.4, 1); g.fillRect(1.2, -10.5, 1.4, 1);
    return;
  }
  // rostro descubierto (con máscara o bufanda)
  g.fillStyle = '#d8c6ad'; g.beginPath(); g.arc(0, -10, 5.2, 0, TAU); g.fill();
  if (id !== 'gaban') { g.fillStyle = id === 'viaje' ? '#7a2a22' : '#2b2832'; g.fillRect(-5.2, -9, 10.4, 4.5); }
  else { g.fillStyle = '#e8e0d0'; g.fillRect(-4.5, -5.5, 9, 2); } // cuello alto
  g.fillStyle = '#f0e8d8'; g.fillRect(1, -12, 2, 1.4); g.fillRect(-2.6, -12, 1.6, 1.4);
  if (id === 'viaje') { // gorra
    g.fillStyle = '#3a2e22'; g.beginPath(); g.ellipse(0, -14.5, 6.5, 3.2, 0, Math.PI, 0); g.fill();
    g.fillRect(-6, -15, 12, 2); g.fillStyle = '#2a2018'; g.fillRect(2, -14, 7, 1.6);
  } else if (id === 'sereno') { // sombrero redondo de ala ancha
    g.fillStyle = '#1a1c22'; g.beginPath(); g.ellipse(0, -14.5, 13, 3.4, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(0, -16.5, 6.5, 5, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#5a5e68'; g.fillRect(-6.5, -16.6, 13, 1.6);
  } else if (id === 'gaban') { // chistera alta con cinta y brillo
    g.fillStyle = '#121014'; g.beginPath(); g.ellipse(0, -14.5, 11, 2.8, 0, 0, TAU); g.fill();
    g.fillRect(-5.5, -27, 11, 12.5);
    g.fillStyle = '#5a1a22'; g.fillRect(-5.5, -17.5, 11, 2);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(-4, -26, 1.5, 8);
  } else { // por si acaso: sombrero de ala ancha clásico
    g.fillStyle = '#110e14'; g.beginPath(); g.ellipse(0, -14.5, 13, 3.4, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-6, -14.5); g.lineTo(-5, -23); g.lineTo(5, -23); g.lineTo(6, -14.5); g.closePath(); g.fill();
  }
}

// poses del cazador: idle (4 cuadros), walk (6), slash (3), shoot (1)
const OUTFIT_CACHE = {};
const SLASH_POSES = [{ rh: [2, -25], blade: -2.85 }, { rh: [19, -14], blade: -0.2 }, { rh: [16, 1], blade: 0.95 }];
function hunterOutfitFrame(outfit, pose = 'idle', f = 0) {
  const key = PIECE_IDS.map(k => outfit[k]).join('|') + '#' + pose + f;
  if (OUTFIT_CACHE[key]) return OUTFIT_CACHE[key];
  let k = 0, sw = 0, bob = 0, lean = 0, lf = 0, lb = 0, rh = [10, 2], ba = 1.15, gun = null;
  if (pose === 'idle') { const ph = (f / 4) * TAU; sw = Math.sin(ph) * 0.8; bob = Math.round(Math.sin(ph) * 0.6 * 2) / 2; rh = [10, 2 + bob * 0.5]; }
  else if (pose === 'walk') {
    const ph = (f / 6) * TAU; k = Math.sin(ph); sw = -k * 2.4; bob = -Math.abs(Math.cos(ph)) * 1.2 + 0.6;
    lf = Math.max(0, Math.cos(ph)) * 3; lb = Math.max(0, -Math.cos(ph)) * 3;
    rh = [10 - k * 2, 2 + k * 0.8]; ba = 1.1 - k * 0.15;
  } else if (pose === 'slash') { const P = SLASH_POSES[f]; rh = P.rh; ba = P.blade; sw = [-1.8, 3, 2][f]; lean = [-0.07, 0.12, 0.06][f]; k = [-0.3, 0.5, 0.4][f]; }
  else if (pose === 'shoot') { gun = [17, -15]; lean = -0.05; sw = -1; }
  const S = HD_STYLE;
  const spr = makeSprite(80, g => {
    g.translate(0, 1);
    g.save(); g.translate(0, bob); g.rotate(lean);
    hdCape(g, outfit.torso, sw);
    // brazo de la pistola por detrás (cuando no apunta)
    if (!gun) { hdArm(g, outfit.brazos, -5, -17, -8, 2, true); hdPistol(g, -8, 2, Math.PI * 0.55, S[outfit.brazos].metal); }
    hdCoatBack(g, outfit.torso, sw);
    g.restore();
    hdLegs(g, outfit.piernas, k, lf, lb);
    g.translate(0, bob); g.rotate(lean);
    hdTorso(g, outfit.torso, sw);
    hdLantern(g);
    if (gun) { hdArm(g, outfit.brazos, -3, -17, gun[0], gun[1], false); hdPistol(g, gun[0], gun[1], -0.08, S[outfit.brazos].metal); }
    const blFirst = ba < -1.5; // estoque en alto: la hoja va detrás del brazo
    if (blFirst) hdBlade(g, rh[0], rh[1], ba, S[outfit.brazos].metal);
    hdArm(g, outfit.brazos, 6, -17, rh[0], rh[1], false);
    if (!blFirst) hdBlade(g, rh[0], rh[1], ba, S[outfit.brazos].metal);
    hdCapelet(g, outfit.torso, sw);
    hdHead(g, outfit.cabeza);
  });
  return (OUTFIT_CACHE[key] = pixelArt(spr, 1, HD_PAL, 0.16, 7));
}


function drawDecor(x0, y0) {
  const cell = 220;
  const gx0 = Math.floor(x0 / cell) - 1, gx1 = Math.floor((x0 + W) / cell) + 1;
  const gy0 = Math.floor(y0 / cell) - 1, gy1 = Math.floor((y0 + H) / cell) + 1;
  for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
    const h = hash(gx, gy), kind = h % 100;
    if (kind >= 30) continue;
    const x = gx * cell + ((h >>> 8) % 160) + 30, y = gy * cell + ((h >>> 16) % 160) + 30;
    if (kind < 10) {           // lápida
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 12, 12, 4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a3640';
      ctx.beginPath(); ctx.moveTo(x - 9, y + 12); ctx.lineTo(x - 9, y - 6); ctx.arc(x, y - 6, 9, Math.PI, 0); ctx.lineTo(x + 9, y + 12); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#25222a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 4); ctx.moveTo(x - 4, y - 5); ctx.lineTo(x + 4, y - 5); ctx.stroke();
    } else if (kind < 15) {    // farola
      const gl = ctx.createRadialGradient(x, y - 30, 2, x, y - 30, 70);
      gl.addColorStop(0, 'rgba(255,190,110,0.28)'); gl.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y - 30, 70, 0, TAU); ctx.fill();
      ctx.fillStyle = '#16141a'; ctx.fillRect(x - 2, y - 30, 4, 40); ctx.fillRect(x - 6, y + 8, 12, 4);
      ctx.fillStyle = '#ffcf7a'; ctx.fillRect(x - 4, y - 38, 8, 9);
      ctx.fillStyle = '#16141a'; ctx.fillRect(x - 6, y - 40, 12, 3);
    } else if (kind < 23) {    // mancha de sangre seca
      ctx.fillStyle = 'rgba(90,10,20,0.35)';
      ctx.beginPath(); ctx.ellipse(x, y, 16 + (h % 10), 8 + (h % 6), (h % 31) / 10, 0, TAU); ctx.fill();
    } else {                   // arbusto seco
      ctx.strokeStyle = '#2e2a26'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.4; ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x + Math.cos(a) * 16, y + 6 + Math.sin(a) * 16); ctx.stroke(); }
    }
  }
}

// Mapa del modo normal: oscuridad afuera, muros, bloques y pilares según la zona, portales y la puerta
function drawArena(x0, y0) {
  const S = G.stage, A = S.arena, th = A.theme;
  // fuera del mapa: negro
  ctx.fillStyle = '#050307';
  ctx.fillRect(x0 - 2, y0 - 2, W + 4, A.y0 - y0 + 2);
  ctx.fillRect(x0 - 2, A.y1, W + 4, y0 + H - A.y1 + 2);
  ctx.fillRect(x0 - 2, A.y0, A.x0 - x0 + 2, A.y1 - A.y0);
  ctx.fillRect(A.x1, A.y0, x0 + W - A.x1 + 2, A.y1 - A.y0);
  // piso propio de la zona
  ctx.fillStyle = FLOORS[th.id] || groundPattern; ctx.fillRect(A.x0, A.y0, A.x1 - A.x0, A.y1 - A.y0);
  // adornos sin colisión: charcos, hierba, huesos, velas
  for (const d of A.decor) {
    ctx.globalAlpha = 0.5;
    if (d.k === 0) { ctx.fillStyle = th.id === 'pesadilla' ? '#3a1a4a' : '#1a1418'; ctx.beginPath(); ctx.ellipse(d.x, d.y, 18 * d.s, 8 * d.s, 0.3, 0, TAU); ctx.fill(); }
    else if (d.k === 1) { ctx.strokeStyle = th.id === 'bosque' ? '#3a5a2a' : '#3a3428'; ctx.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(d.x + i * 4, d.y); ctx.lineTo(d.x + i * 6, d.y - 9 * d.s); ctx.stroke(); } }
    else if (d.k === 2) { ctx.strokeStyle = '#c8bfae'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(d.x - 6, d.y); ctx.lineTo(d.x + 6, d.y + 2); ctx.stroke(); }
    else { ctx.globalAlpha = 0.8; ctx.fillStyle = '#e8dcc4'; ctx.fillRect(d.x - 1.5, d.y - 6, 3, 6); ctx.fillStyle = '#ffcf6b'; ctx.beginPath(); ctx.arc(d.x, d.y - 8, 2 + Math.sin(G.t * 9 + d.x) * 0.5, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  // pantanos (frenan y envenenan)
  for (const b of A.bogs) {
    const gr = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, Math.max(b.rx, b.ry));
    gr.addColorStop(0, 'rgba(60,110,40,0.55)'); gr.addColorStop(1, 'rgba(40,80,30,0.15)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(b.x, b.y, b.rx, b.ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(150,220,90,0.4)';
    for (let i = 0; i < 3; i++) { const a = G.t * 0.7 + i * 2.1; ctx.beginPath(); ctx.arc(b.x + Math.cos(a) * b.rx * 0.5, b.y + Math.sin(a * 1.3) * b.ry * 0.5, 2 + (Math.sin(G.t * 3 + i) + 1), 0, TAU); ctx.fill(); }
  }
  // pinchos: avisan (rojo tenue) y luego salen
  for (const tr of A.traps) {
    ctx.fillStyle = tr.state === 'warn' ? 'rgba(200,40,40,0.35)' : 'rgba(30,24,30,0.7)';
    ctx.fillRect(tr.x, tr.y, tr.w, tr.h);
    ctx.strokeStyle = '#3a3040'; ctx.lineWidth = 1; ctx.strokeRect(tr.x + 0.5, tr.y + 0.5, tr.w, tr.h);
    for (let ix = 0; ix < 4; ix++) for (let iy = 0; iy < 4; iy++) {
      const cx = tr.x + 8 + ix * 16, cy = tr.y + 8 + iy * 16;
      if (tr.state === 'on') { ctx.fillStyle = '#d8d0c8'; ctx.beginPath(); ctx.moveTo(cx - 4, cy + 4); ctx.lineTo(cx, cy - 7); ctx.lineTo(cx + 4, cy + 4); ctx.closePath(); ctx.fill(); }
      else { ctx.fillStyle = '#120e14'; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, TAU); ctx.fill(); }
    }
  }
  // muros perimetrales
  ctx.strokeStyle = '#2e2636'; ctx.lineWidth = 18; ctx.strokeRect(A.x0 - 9, A.y0 - 9, A.x1 - A.x0 + 18, A.y1 - A.y0 + 18);
  ctx.strokeStyle = '#4a3e54'; ctx.lineWidth = 2; ctx.strokeRect(A.x0, A.y0, A.x1 - A.x0, A.y1 - A.y0);
  // bloques con volumen: la base ocupa su lugar en el suelo y se dibujan cara frontal y techo hacia arriba
  const solid = (x, y, w, h, z, top, face, edge) => {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x + 5, y + 6, w, h);
    ctx.fillStyle = face; ctx.fillRect(x, y + h - z, w, z);
    ctx.fillStyle = top; ctx.fillRect(x, y - z, w, h);
    ctx.fillStyle = edge; ctx.fillRect(x, y - z, w, 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y - z + 0.5, w - 1, h + z - 1);
  };
  const sorted = [...A.blocks].sort((a, b) => (a.y + a.h) - (b.y + b.h));
  for (const b of sorted) {
    if (b.crate) {
      solid(b.x, b.y, b.w, b.h, 10, '#7a5430', '#4e3418', '#9a7040');
      ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(b.x + 3, b.y - 7); ctx.lineTo(b.x + b.w - 3, b.y + b.h - 13); ctx.moveTo(b.x + b.w - 3, b.y - 7); ctx.lineTo(b.x + 3, b.y + b.h - 13); ctx.stroke();
      if (b.hp < b.maxHp * 0.5) { ctx.strokeStyle = '#1a0e04'; ctx.beginPath(); ctx.moveTo(b.x + 8, b.y - 6); ctx.lineTo(b.x + 16, b.y + 8); ctx.lineTo(b.x + 12, b.y + 18); ctx.stroke(); }
      continue;
    }
    if (b.wall) {
      solid(b.x, b.y, b.w, b.h, 18, '#4a4054', '#2c2632', '#62566e');
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
      const fy = b.y + b.h - 18;
      for (let row = 0; row < 2; row++) for (let x = b.x + (row ? 9 : 0); x < b.x + b.w; x += 18) { ctx.strokeRect(x, fy + row * 9, Math.min(18, b.x + b.w - x), 9); }
      continue;
    }
    if (b.house) {
      solid(b.x, b.y, b.w, b.h, 26, th.top, th.block, '#7a6050');
      // tejado a dos aguas
      ctx.fillStyle = '#3a2420'; ctx.beginPath(); ctx.moveTo(b.x - 4, b.y - 26 + b.h * 0.5); ctx.lineTo(b.x + b.w / 2, b.y - 40); ctx.lineTo(b.x + b.w + 4, b.y - 26 + b.h * 0.5); ctx.lineTo(b.x + b.w + 4, b.y - 26 + b.h * 0.55); ctx.lineTo(b.x - 4, b.y - 26 + b.h * 0.55); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; for (let x = b.x; x < b.x + b.w; x += 10) { ctx.beginPath(); ctx.moveTo(x, b.y - 26 + b.h * 0.52); ctx.lineTo(b.x + b.w / 2, b.y - 40); ctx.stroke(); }
      // ventanas encendidas en la fachada
      ctx.fillStyle = '#ffcf7a'; for (let wx = b.x + 12; wx < b.x + b.w - 10; wx += 28) ctx.fillRect(wx, b.y + b.h - 20, 8, 10);
      ctx.fillStyle = '#2a1a12'; ctx.fillRect(b.x + b.w / 2 - 6, b.y + b.h - 18, 12, 18);
      continue;
    }
    if (b.half) {
      const z = b.tomb ? 10 : 6;
      solid(b.x, b.y, b.w, b.h, z, '#5e5460', '#3a3240', '#7a7080');
      if (b.tomb) { ctx.fillStyle = '#2a2430'; ctx.fillRect(b.x + b.w / 2 - 1, b.y - z + 2, 2, b.h - 2); ctx.fillRect(b.x + b.w / 2 - 4, b.y - z + 4, 8, 2); }
      if (b.cart) { ctx.fillStyle = '#2a1e14'; ctx.beginPath(); ctx.arc(b.x + 8, b.y + b.h, 6, 0, TAU); ctx.arc(b.x + b.w - 8, b.y + b.h, 6, 0, TAU); ctx.fill(); ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x + 8, b.y + b.h, 6, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(b.x + b.w - 8, b.y + b.h, 6, 0, TAU); ctx.stroke(); }
      if (b.bench) { ctx.fillStyle = '#4a3420'; ctx.fillRect(b.x, b.y - z, b.w, b.h); ctx.fillStyle = '#6a4a2c'; ctx.fillRect(b.x, b.y - z, b.w, 3); }
      continue;
    }
    solid(b.x, b.y, b.w, b.h, 16, th.top, th.block, '#8a7a70');
  }
  // barriles explosivos (cilindros con aros)
  for (const o of A.barrels) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(o.x + 3, o.y + o.r * 0.8, o.r, o.r * 0.4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6a1e12'; ctx.fillRect(o.x - o.r, o.y - o.r - 6, o.r * 2, o.r + 6);
    ctx.fillStyle = '#8a2a1a'; ctx.beginPath(); ctx.ellipse(o.x, o.y - o.r - 6, o.r, o.r * 0.45, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6a1e12'; ctx.beginPath(); ctx.ellipse(o.x, o.y, o.r, o.r * 0.45, 0, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 2; for (const yy of [o.y - o.r + 2, o.y - 4]) { ctx.beginPath(); ctx.moveTo(o.x - o.r, yy); ctx.lineTo(o.x + o.r, yy); ctx.stroke(); }
    ctx.fillStyle = '#ffcf4a'; ctx.font = 'bold 11px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('!', o.x, o.y - 8);
  }
  // pilares como cilindros, árboles con copa en capas, braseros encendidos
  for (const pl of [...A.pillars].sort((a, b) => a.y - b.y)) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(pl.x + 4, pl.y + pl.r * 0.55, pl.r * 1.1, pl.r * 0.45, 0, 0, TAU); ctx.fill();
    if (pl.tree) {
      ctx.fillStyle = '#2a1e14'; ctx.fillRect(pl.x - pl.r * 0.22, pl.y - pl.r * 0.6, pl.r * 0.44, pl.r * 1.1);
      ctx.strokeStyle = '#1a120c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.x - 2, pl.y - pl.r * 0.5); ctx.lineTo(pl.x - 1, pl.y + pl.r * 0.4); ctx.stroke();
      const layers = [[0, -pl.r * 0.9, 1.05, '#16260e'], [-pl.r * 0.3, -pl.r * 1.1, 0.75, '#1e3214'], [pl.r * 0.3, -pl.r * 1.2, 0.7, '#22381a'], [0, -pl.r * 1.45, 0.6, '#2e4a20']];
      for (const [ox, oy, s, c] of layers) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(pl.x + ox, pl.y + oy, pl.r * s, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(160,220,120,0.08)'; ctx.beginPath(); ctx.arc(pl.x - pl.r * 0.35, pl.y - pl.r * 1.6, pl.r * 0.35, 0, TAU); ctx.fill();
      continue;
    }
    const z = pl.r * 1.3, base = th.id === 'pesadilla' ? ['#4a2c5a', '#1e1028', '#7a5a8a'] : ['#4e4658', '#24202c', '#7a7088'];
    const gr = ctx.createLinearGradient(pl.x - pl.r, 0, pl.x + pl.r, 0);
    gr.addColorStop(0, base[1]); gr.addColorStop(0.35, base[2]); gr.addColorStop(1, base[1]);
    ctx.fillStyle = gr; ctx.fillRect(pl.x - pl.r, pl.y - z, pl.r * 2, z);
    ctx.beginPath(); ctx.ellipse(pl.x, pl.y, pl.r, pl.r * 0.42, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = base[0]; ctx.beginPath(); ctx.ellipse(pl.x, pl.y - z, pl.r, pl.r * 0.42, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(pl.x, pl.y - z, pl.r, pl.r * 0.42, 0, 0, TAU); ctx.stroke();
    if (pl.brazier) {
      const v = A.vents.find(q => q.x === pl.x && q.y === pl.y), hot = v && v.t < 1.2;
      ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.ellipse(pl.x, pl.y - z, pl.r * 0.7, pl.r * 0.28, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 4; i++) {
        const fx = pl.x + Math.sin(G.t * 7 + i * 1.7) * pl.r * 0.35, fh = (hot ? 26 : 16) + Math.sin(G.t * 13 + i) * 5;
        ctx.fillStyle = i % 2 ? 'rgba(255,200,90,0.9)' : 'rgba(255,110,30,0.85)';
        ctx.beginPath(); ctx.moveTo(fx - 5, pl.y - z); ctx.quadraticCurveTo(fx, pl.y - z - fh * 1.2, fx + 5, pl.y - z); ctx.closePath(); ctx.fill();
      }
    }
  }
  // portales de aparición (aviso antes de que salga un enemigo)
  for (const s of S.spawns) {
    const k = 1 - clamp(s.t / 1.2, 0, 1), big = ETYPES[s.type].boss ? 2.2 : 1;
    ctx.strokeStyle = `rgba(200,60,90,${0.4 + k * 0.5})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.x, s.y, (8 + k * 14) * big, G.t * 6, G.t * 6 + 4.5); ctx.stroke();
    ctx.fillStyle = `rgba(120,10,40,${0.2 + k * 0.3})`; ctx.beginPath(); ctx.arc(s.x, s.y, (6 + k * 10) * big, 0, TAU); ctx.fill();
  }
  // puerta al siguiente nivel
  if (S.door) {
    const d = S.door, next = S.n + 1, boss = isBossStage(next);
    ctx.fillStyle = '#0a0610';
    ctx.beginPath(); ctx.moveTo(d.x - 28, d.y + 26); ctx.lineTo(d.x - 28, d.y - 10); ctx.arc(d.x, d.y - 10, 28, Math.PI, 0); ctx.lineTo(d.x + 28, d.y + 26); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = boss ? '#c21f35' : '#c9a35a'; ctx.lineWidth = 3; ctx.stroke();
    const gl = ctx.createRadialGradient(d.x, d.y, 2, d.x, d.y, 34);
    gl.addColorStop(0, boss ? 'rgba(200,30,50,0.55)' : 'rgba(255,220,150,0.4)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(d.x, d.y, 34 + Math.sin(G.t * 3) * 3, 0, TAU); ctx.fill();
    ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(boss ? '👑' : '➜', d.x, d.y + 7);
    ctx.font = 'bold 12px Georgia, serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    const label = boss ? `Nivel ${next} · jefe` : `Nivel ${next}`;
    ctx.strokeText(label, d.x, d.y + 46); ctx.fillStyle = '#e8dcc4'; ctx.fillText(label, d.x, d.y + 46);
  }
}

function drawShadow(x, y, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.9, r * 0.95, r * 0.35, 0, 0, TAU); ctx.fill();
}

function drawSprite(key, x, y, size, flip, flash, tint) {
  const img = flash ? FLASH[key] : tint ? TINT[key] : SPR[key];
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
  if (flip) {
    ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  } else ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
  ctx.imageSmoothingEnabled = sm;
}

function render() {
  const RW = W, RH = H, RD = DPR, Z = pixelZoom();
  const sw = Math.max(1, Math.floor(RW / Z)), sh = Math.max(1, Math.floor(RH / Z));
  if (sceneCv.width !== sw || sceneCv.height !== sh) { sceneCv.width = sw; sceneCv.height = sh; }
  ctx = sctx; W = sw; H = sh; DPR = 1;
  try { renderWorld(); } finally { ctx = mainCtx; W = RW; H = RH; DPR = RD; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sceneCv, 0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (G) drawHUD();
}

function renderWorld() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#0b090e'; ctx.fillRect(0, 0, W, H);
  if (!G) return;
  const p = G.player;
  let cx = G.cam.x, cy = G.cam.y;
  if (G.shake > 0 && state === 'play') { cx += rand(-5, 5) * G.shake * 4; cy += rand(-5, 5) * G.shake * 4; }
  const x0 = cx - W / 2, y0 = cy - H / 2;
  ctx.save();
  ctx.translate(Math.round(-x0), Math.round(-y0));

  ctx.fillStyle = groundPattern; ctx.fillRect(x0 - 2, y0 - 2, W + 4, H + 4);
  if (G.mode === 'stage') drawArena(x0, y0); else drawDecor(x0, y0);
  const vis = (x, y, m) => x > x0 - m && x < x0 + W + m && y > y0 - m && y < y0 + H + m;
  drawDecals(vis);
  // cuerpos que caen: destello blanco, se tiñen de rojo, se desploman y se desvanecen
  if (G.corpses) for (const c of G.corpses) {
    const k = c.t / c.max;
    ctx.save(); ctx.translate(c.x, c.y + k * 7); ctx.rotate((c.face < 0 ? -1 : 1) * k * 1.25); ctx.scale(1 + k * 0.12, 1 - k * 0.4);
    ctx.globalAlpha = 1 - k * k;
    drawSprite(c.key, 0, 0, c.size, c.face < 0, k < 0.12, k >= 0.12);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // charcos de fuego
  for (const pl of G.pools) {
    const a = Math.min(1, pl.life / 0.5) * (0.85 + Math.sin(G.t * 20 + pl.x) * 0.15);
    const gr = ctx.createRadialGradient(pl.x, pl.y, 2, pl.x, pl.y, pl.r);
    gr.addColorStop(0, `rgba(255,170,60,${0.7 * a})`); gr.addColorStop(0.6, `rgba(220,70,20,${0.45 * a})`); gr.addColorStop(1, 'rgba(120,20,10,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(pl.x, pl.y, pl.r, pl.r * 0.75, 0, 0, TAU); ctx.fill();
  }

  // rastro de sangre con la esencia perdida
  if (G.trace && vis(G.trace.x, G.trace.y, 40)) {
    const T0 = G.trace, pulse = 0.6 + Math.sin(G.t * 3) * 0.4;
    const gr = ctx.createRadialGradient(T0.x, T0.y, 2, T0.x, T0.y, 34);
    gr.addColorStop(0, `rgba(230,40,60,${0.7 * pulse})`); gr.addColorStop(1, 'rgba(230,40,60,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(T0.x, T0.y, 34, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7a0f1c'; ctx.beginPath(); ctx.ellipse(T0.x, T0.y, 14, 7, 0.3, 0, TAU); ctx.fill();
    ctx.font = 'bold 12px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ff8a9a';
    ctx.fillText(`◈ ${T0.amount}`, T0.x, T0.y - 18);
  }

  // zonas de peligro telegrafiadas (pisotones, lluvia de sangre)
  for (const hz of G.hazards) {
    const k = clamp(hz.t / hz.delay, 0, 1);
    const rgb = hz.type === 'veneno' ? '80,190,70' : hz.type === 'fuego' ? '255,130,40' : hz.type === 'arcano' ? '170,90,255' : '200,20,40';
    ctx.fillStyle = `rgba(${rgb},${0.12 + k * 0.25})`;
    ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${rgb},${0.5 + k * 0.5})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.r, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.r * k, 0, TAU); ctx.stroke();
  }

  // fragmentos de luna (experiencia)
  for (const g of G.gems) {
    if (!vis(g.x, g.y, 20)) continue;
    const s = g.v >= 20 ? 7 : g.v >= 5 ? 5.5 : 4;
    const col = g.v >= 20 ? '#d23a4e' : g.v >= 5 ? '#e3c86a' : '#b9c6e6';
    const bob = Math.sin(G.t * 4 + g.x * 0.1) * 1.5;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(g.x, g.y - s + bob); ctx.lineTo(g.x + s * 0.7, g.y + bob); ctx.lineTo(g.x, g.y + s + bob); ctx.lineTo(g.x - s * 0.7, g.y + bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(g.x - 1, g.y - s * 0.5 + bob, 1.5, 2);
  }
  // viales y balas sueltas
  for (const h of G.pickups) {
    if (!vis(h.x, h.y, 20)) continue;
    const bob = Math.sin(G.t * 3 + h.x) * 2, y = h.y + bob;
    if (h.kind === 'gem') {
      const col = RARITIES[h.gem.rarity].color;
      ctx.globalAlpha = 0.25 + Math.sin(G.t * 5) * 0.1; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(h.x, y, 16, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(h.x, y - 9); ctx.lineTo(h.x + 7, y - 2); ctx.lineTo(h.x, y + 9); ctx.lineTo(h.x - 7, y - 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.moveTo(h.x, y - 9); ctx.lineTo(h.x + 3, y - 2); ctx.lineTo(h.x - 3, y - 2); ctx.closePath(); ctx.fill();
    } else if (h.kind === 'frag') {
      ctx.fillStyle = 'rgba(184,192,216,0.2)'; ctx.beginPath(); ctx.arc(h.x, y, 12, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b8c0d8';
      for (const [ox, oy] of [[-4, 2], [3, -2], [1, 4]]) { ctx.beginPath(); ctx.moveTo(h.x + ox, y + oy - 4); ctx.lineTo(h.x + ox + 3, y + oy); ctx.lineTo(h.x + ox, y + oy + 3); ctx.lineTo(h.x + ox - 3, y + oy); ctx.closePath(); ctx.fill(); }
    } else if (h.kind === 'item') {
      ctx.fillStyle = 'rgba(232,220,196,0.15)'; ctx.beginPath(); ctx.arc(h.x, y, 12, 0, TAU); ctx.fill();
      ctx.font = '15px serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(ITEMS[h.id].icon, h.x, y + 5);
    } else if (h.kind === 'vial') {
      // vial curativo: frasquito rojo
      ctx.fillStyle = 'rgba(220,60,80,0.2)'; ctx.beginPath(); ctx.arc(h.x, y, 12, 0, TAU); ctx.fill();
      ctx.fillStyle = '#c4304a'; ctx.beginPath(); ctx.arc(h.x, y + 2, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d8d0c0'; ctx.fillRect(h.x - 1.5, y - 6, 3, 4);
      ctx.fillStyle = '#5a4630'; ctx.fillRect(h.x - 2, y - 8, 4, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(h.x - 3, y, 1.5, 2);
    } else {
      // balas: tres cápsulas plateadas
      ctx.fillStyle = 'rgba(200,210,230,0.15)'; ctx.beginPath(); ctx.arc(h.x, y, 11, 0, TAU); ctx.fill();
      for (const ox of [-4, 0, 4]) {
        ctx.fillStyle = '#c9ccd8'; ctx.fillRect(h.x + ox - 1.3, y - 3, 2.6, 6);
        ctx.fillStyle = '#c9a35a'; ctx.fillRect(h.x + ox - 1.3, y + 2, 2.6, 2);
      }
    }
  }

  // cóctel apestoso: nube verdosa que atrae
  if (G.lure) {
    const L = G.lure, a = clamp(L.t, 0, 1);
    const gr = ctx.createRadialGradient(L.x, L.y, 4, L.x, L.y, 60);
    gr.addColorStop(0, `rgba(150,190,80,${0.45 * a})`); gr.addColorStop(1, 'rgba(150,190,80,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(L.x, L.y, 60 + Math.sin(G.t * 4) * 5, 0, TAU); ctx.fill();
  }

  // enemigos
  for (const e of G.enemies) {
    const T = ETYPES[e.type];
    if (!vis(e.x, e.y, T.size)) continue;
    if (!canSee(e)) {
      // acechador invisible: sin Lucidez no se ve; con 5+ apenas una distorsión
      if (p.lucidez >= 5) { ctx.globalAlpha = 0.1 + Math.sin(G.t * 3 + e.id) * 0.05; drawSprite(e.type, e.x, e.y, T.size, e.face < 0, false); ctx.globalAlpha = 1; }
      continue;
    }
    drawShadow(e.x, e.y, e.r);
    let key = e.sprite || e.type;
    if (ANIM[e.type] && !e.sprite) {
      // cuadros de caminata y pose de ataque (carga, mira, mecha encendida, salto)
      const atk = e.wind > 0 || e.aimT > 0 || e.fuse > 0 || e.leapT > 0 || e.dash > 0;
      const frozen = e.stun > 0;
      key = atk ? e.type + '_w' : e.type + '_' + (frozen ? 0 : Math.floor(G.t * (e.frenzy > 0 ? 12 : 8) + e.id * 0.7) % 4);
    }
    const hdD = hdEnemyDraw(e, T);
    const SZ = hdD ? hdD.size : (e.size || T.size);
    if (e.type === 'murcielago' && Math.sin(G.t * 18 + e.id) > 0) key = 'murcielago2';
    // apuntando: línea roja hacia donde va a disparar o arrojar
    if (e.aimT > 0) {
      if (T.ranged === 'ring') {
        // el monje alza la campana: anillo que se cierra antes del tañido
        ctx.strokeStyle = `rgba(210,130,255,${0.4 + (0.7 - e.aimT)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, 14 + e.aimT * 50, 0, TAU); ctx.stroke();
      } else {
        const bolt = T.ranged === 'bolt';
        ctx.strokeStyle = bolt ? `rgba(255,40,40,${0.5 + (0.9 - e.aimT) * 0.5})` : `rgba(255,70,70,${0.3 + (0.45 - e.aimT)})`;
        ctx.lineWidth = bolt ? 2 : 1.5; ctx.setLineDash(bolt ? [] : [4, 6]);
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(bolt ? e.x + (e.aimX - e.x) * 3 : e.aimX, bolt ? e.y + (e.aimY - e.y) * 3 : e.aimY); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    // élites: contorno dorado (y burbuja azul si está escudado)
    if (e.affix) {
      const gl = ctx.createRadialGradient(e.x, e.y, e.r * 0.5, e.x, e.y, e.r * 2.1);
      gl.addColorStop(0, 'rgba(255,210,80,0.35)'); gl.addColorStop(1, 'rgba(255,210,80,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 2.1, 0, TAU); ctx.fill();
    }
    // plegaria: halo dorado y barra de lo que falta para interrumpirla
    if (e.praying > 0) {
      const gl = ctx.createRadialGradient(e.x, e.y, 10, e.x, e.y, SZ * 0.7);
      gl.addColorStop(0, 'rgba(255,220,130,0.45)'); gl.addColorStop(1, 'rgba(255,220,130,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(e.x, e.y, SZ * 0.7, 0, TAU); ctx.fill();
      const w = 80, k = clamp(e.prayDmg / (e.maxHp * 0.08), 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(e.x - w / 2, e.y + SZ * 0.45, w, 6);
      ctx.fillStyle = '#ffe07a'; ctx.fillRect(e.x - w / 2, e.y + SZ * 0.45, w * k, 6);
    }
    const bobE = T.eldritch && e.type !== 'larva' ? Math.sin(G.t * 2.5 + e.id) * 3 - 3 : 0;
    // carga de embestida: tiembla y brilla en rojo
    const shakeX = e.wind > 0 ? rand(-1.5, 1.5) : 0;
    if (e.wind > 0) {
      const gl = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, e.r * 2);
      gl.addColorStop(0, 'rgba(255,60,60,0.45)'); gl.addColorStop(1, 'rgba(255,60,60,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 2, 0, TAU); ctx.fill();
    }
    const airY = e.air ? -e.air : 0;
    const blink = e.fuse > 0 && Math.floor(G.t * 16) % 2 === 0;
    {
      const ph = G.t * 10 + e.id * 1.7, still = e.stun > 0 || e.praying > 0 || T.boss && T.speed < 30;
      let sx = 1, sy = 1, rot = 0;
      if (!still && !T.eldritch) { const amp = hdD ? 0 : ANIM[e.type] ? 0.3 : 1; sy = 1 + Math.sin(ph) * 0.05 * amp; sx = 1 - Math.sin(ph) * 0.035 * amp; rot = Math.sin(ph * 0.5) * 0.05 * amp; }
      if (e.flash > 0) { sx *= 1.14; sy *= 0.88; }
      if (e.wind > 0) { sx *= 1.08; sy *= 0.92; }
      ctx.save(); ctx.translate(Math.round(e.x + shakeX), Math.round(e.y + bobE + airY + (hdD ? hdD.oy : 0))); ctx.rotate(rot); ctx.scale(sx, sy);
      drawSprite(key, 0, 0, SZ, e.face < 0, e.flash > 0 || blink, e.blood);
      ctx.restore();
    }
    // pavés del escudero, en la dirección a la que mira
    if (T.shield && e.fa !== undefined) {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.fa);
      ctx.fillStyle = '#6a6a74'; ctx.fillRect(e.r * 0.6, -e.r * 1.1, 7, e.r * 2.2);
      ctx.fillStyle = '#9a9aa6'; ctx.fillRect(e.r * 0.6 + 5, -e.r * 1.1, 2, e.r * 2.2);
      ctx.fillStyle = '#c9a35a'; ctx.beginPath(); ctx.arc(e.r * 0.6 + 4, 0, 3, 0, TAU); ctx.fill();
      ctx.restore();
    }
    if (e.bubble > 0) { ctx.strokeStyle = 'rgba(150,200,255,0.8)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.6, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(150,200,255,0.15)'; ctx.fill(); }
    if (e.affix) {
      ctx.font = 'bold 10px Georgia, serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      const tag = e.affix.map(a => a[0].toUpperCase() + a.slice(1)).join(' · ');
      ctx.strokeText(tag, e.x, e.y - SZ / 2 - 12); ctx.fillStyle = '#ffd24a'; ctx.fillText(tag, e.x, e.y - SZ / 2 - 12);
      const w = 36;
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(e.x - w / 2, e.y - SZ / 2 - 8, w, 4);
      ctx.fillStyle = '#c21f35'; ctx.fillRect(e.x - w / 2, e.y - SZ / 2 - 8, w * clamp(e.hp / e.maxHp, 0, 1), 4);
      if (e.maxArmor) { ctx.fillStyle = '#ffd24a'; ctx.fillRect(e.x - w / 2, e.y - SZ / 2 - 8, w * clamp(e.armor / e.maxArmor, 0, 1), 4); }
    }
    if (e.wind > 0) {
      ctx.font = 'bold 18px Georgia, serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText('!', e.x, e.y - SZ / 2 - 2); ctx.fillStyle = '#ff4a4a'; ctx.fillText('!', e.x, e.y - SZ / 2 - 2);
    } else if (e.stun > 0) {
      ctx.fillStyle = '#ffe07a';
      for (let k = 0; k < 3; k++) {
        const a = G.t * 6 + (k * TAU) / 3;
        ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * 10, e.y - SZ / 2 + Math.sin(a) * 3, 2.2, 0, TAU); ctx.fill();
      }
    }
    if (e.elite) {
      const w = 50;
      const by = hdD ? e.y + hdD.top - 8 : e.y - e.r - 26;
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(e.x - w / 2, by, w, 5);
      ctx.fillStyle = T.eldritch ? '#8a3fd0' : '#c21f35'; ctx.fillRect(e.x - w / 2, by, w * clamp(e.hp / e.maxHp, 0, 1), 5);
    }
  }

  // radio de detección (se aviva cuando hay una bestia adentro)
  ctx.save();
  ctx.setLineDash([6, 10]);
  ctx.lineDashOffset = -G.t * 12;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = p.alert ? 'rgba(224,86,107,0.35)' : 'rgba(201,163,90,0.14)';
  ctx.beginPath(); ctx.arc(p.x, p.y, p.range, 0, TAU); ctx.stroke();
  ctx.restore();

  // jugador
  drawShadow(p.x, p.y + 29, p.r + 2);
  // conjunto completo: halo a los pies del color de su rareza
  { const fs2 = fullSet(); if (fs2) { const col = RARITIES[ATTIRES[fs2].rarity].color; ctx.strokeStyle = col; ctx.globalAlpha = 0.45 + Math.sin(G.t * 3) * 0.2; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y + 29, 20, 7, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; } }
  const bob = p.moving ? Math.abs(Math.sin(p.anim)) * -2 : 0;
  for (const gh of G.ghosts) {
    ctx.globalAlpha = clamp(gh.life / 0.22, 0, 1) * 0.35;
    { const gi = hunterOutfitFrame(p.outfit, 'walk', 2); ctx.save(); ctx.translate(gh.x, gh.y); if (gh.face < 0) ctx.scale(-1, 1); ctx.imageSmoothingEnabled = false; ctx.drawImage(gi, -40, -46, 80, 80); ctx.restore(); }
  }
  ctx.globalAlpha = 1;
  if (p.beastT > 0) {
    // aura de bestialidad
    const gl = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 34);
    gl.addColorStop(0, `rgba(255,60,30,${0.25 + p.beastStacks / 120})`); gl.addColorStop(1, 'rgba(255,60,30,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.x, p.y, 34, 0, TAU); ctx.fill();
  }
  if (p.windT > 0) ctx.globalAlpha = 0.55;
  if (p.dodgeT > 0 || !(p.invuln > 0 && Math.floor(G.t * 20) % 2 === 0)) {
    let pose = 'idle', fr = Math.floor(G.t * 3) % 4;
    const sl = G.effects.find(fx => fx.kind === 'slash');
    if (sl) { pose = 'slash'; fr = Math.min(2, Math.floor((1 - sl.life / sl.max) * 3)); }
    else if (p.shootT > 0) { pose = 'shoot'; fr = 0; }
    else if (p.moving) { pose = 'walk'; fr = Math.floor(p.anim / 1.1) % 6; }
    const img = hunterOutfitFrame(p.outfit, pose, fr);
    ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y + bob));
    if (p.face < 0) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, -40, -46, 80, 80);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // cazadores aliados (azulados)
  for (const a of G.allies) {
    drawShadow(a.x, a.y + 4, 12);
    ctx.globalAlpha = a.t < 3 ? 0.4 + 0.4 * Math.abs(Math.sin(G.t * 8)) : 1;
    if (a.face < 0) { ctx.save(); ctx.translate(a.x, a.y); ctx.scale(-1, 1); ctx.imageSmoothingEnabled = false; ctx.drawImage(ALLY_SPR, -24, -24, 48, 48); ctx.restore(); }
    else crisp(() => ctx.drawImage(ALLY_SPR, a.x - 24, a.y - 24, 48, 48));
    ctx.globalAlpha = 1;
  }
  // locura (violeta) y veneno (verde) sobre la cabeza
  let sy = p.y - 30;
  if (p.madness > 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(p.x - 16, sy, 32, 4);
    ctx.fillStyle = '#a04fe0'; ctx.fillRect(p.x - 16, sy, 32 * clamp(p.madness / 100, 0, 1), 4); sy -= 6;
  }
  if (p.poison > 1 || p.poisonT > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(p.x - 16, sy, 32, 4);
    ctx.fillStyle = p.poisonT > 0 ? '#3fae4a' : '#7be38a'; ctx.fillRect(p.x - 16, sy, 32 * (p.poisonT > 0 ? p.poisonT / 6 : clamp(p.poison / 100, 0, 1)), 4);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(p.x - 16, p.y + 35, 32, 4);
  ctx.fillStyle = '#c21f35'; ctx.fillRect(p.x - 16, p.y + 35, 32 * clamp(p.hp / p.maxHp, 0, 1), 4);
  if (p.rally > 0.5) { ctx.fillStyle = '#e8892e'; ctx.fillRect(p.x - 16 + 32 * clamp(p.hp / p.maxHp, 0, 1), p.y + 22, 32 * clamp(p.rally / p.maxHp, 0, 1), 4); }

  // tajos cuerpo a cuerpo
  for (const fx of G.effects) {
    if (fx.kind === 'beams') {
      // el sacerdote cura y enfurece: hilos rojos hacia sus aliados
      ctx.strokeStyle = `rgba(255,70,90,${fx.life / fx.max})`; ctx.lineWidth = 2;
      for (const [tx, ty] of fx.to) { ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(tx, ty); ctx.stroke(); }
      continue;
    }
    if (fx.kind === 'roar' || fx.kind === 'notes' || fx.kind === 'tentacle') {
      const k = 1 - fx.life / fx.max;
      if (fx.kind === 'roar') {
        ctx.strokeStyle = `rgba(255,190,140,${0.7 * (1 - k)})`; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (0.3 + k * 0.7), 0, TAU); ctx.stroke();
      } else if (fx.kind === 'notes') {
        ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ffe07a';
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + k * 2; ctx.fillText('♪', p.x + Math.cos(a) * (30 + k * 160), p.y + Math.sin(a) * (30 + k * 160)); }
        ctx.globalAlpha = 1;
      } else {
        // tentáculo que brota del suelo
        const h = Math.sin(k * Math.PI) * 34;
        ctx.strokeStyle = '#5a2a7a'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(fx.x, fx.y + 6); ctx.quadraticCurveTo(fx.x + 10, fx.y - h * 0.5, fx.x - 2, fx.y - h); ctx.stroke();
        ctx.strokeStyle = '#a070d0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(fx.x, fx.y + 6); ctx.quadraticCurveTo(fx.x + 10, fx.y - h * 0.5, fx.x - 2, fx.y - h); ctx.stroke();
        ctx.fillStyle = 'rgba(40,10,60,0.5)'; ctx.beginPath(); ctx.ellipse(fx.x, fx.y + 6, 14, 5, 0, 0, TAU); ctx.fill();
      }
      continue;
    }
    if (fx.kind === 'trick') {
      // destello al transformar el arma
      const k = 1 - fx.life / fx.max;
      ctx.strokeStyle = `rgba(255,224,122,${0.8 * (1 - k)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, 16 + k * 30, 0, TAU); ctx.stroke();
      continue;
    }
    if (fx.kind !== 'slash') continue;
    const k = 1 - fx.life / fx.max;
    const a0 = -fx.arc / 2, aEnd = a0 + fx.arc * Math.min(1, k * 1.8);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(fx.ang);
    ctx.globalAlpha = 1 - k * 0.8;
    const trail = Math.max(a0, aEnd - fx.arc * 0.55);
    ctx.fillStyle = 'rgba(120,10,24,0.45)';
    ctx.beginPath(); ctx.arc(0, 0, fx.reach * 1.02, a0, aEnd); ctx.arc(0, 0, fx.reach * 0.45, aEnd, a0, true); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(240,235,255,0.75)';
    ctx.beginPath(); ctx.arc(0, 0, fx.reach, trail, aEnd); ctx.arc(0, 0, fx.reach * 0.7, aEnd, trail, true); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = fx.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, fx.reach, a0, aEnd); ctx.stroke();
    // anillos carmesí que se abren alrededor del cazador
    ctx.strokeStyle = `rgba(255,110,140,${0.85 * (1 - k)})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, fx.reach * (0.85 + k * 0.4), a0 - 0.5, aEnd + 0.3); ctx.stroke();
    ctx.strokeStyle = `rgba(200,30,60,${0.7 * (1 - k)})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, fx.reach * (0.55 + k * 0.3), aEnd - 1.6, aEnd + 0.2); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(Math.cos(aEnd) * fx.reach * 0.45, Math.sin(aEnd) * fx.reach * 0.45); ctx.lineTo(Math.cos(aEnd) * fx.reach * 1.05, Math.sin(aEnd) * fx.reach * 1.05); ctx.stroke();
    ctx.fillStyle = '#ffe07a';
    for (let i = 0; i < 4; i++) { const a = aEnd - i * 0.12, r = fx.reach * (0.9 + (i % 2) * 0.15); ctx.fillRect(Math.cos(a) * r, Math.sin(a) * r, 2, 2); }
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // faroles orbitando
  for (const t of p.tools) {
    if (t.id !== 'farol') continue;
    for (const o of t.orbs) {
      const fl = 1 + Math.sin(G.t * 25 + o.x) * 0.08;
      const gr = ctx.createRadialGradient(o.x, o.y, 1, o.x, o.y, 16 * fl);
      gr.addColorStop(0, 'rgba(255,240,190,1)'); gr.addColorStop(0.35, 'rgba(255,170,70,0.9)'); gr.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(o.x, o.y, 16 * fl, 0, TAU); ctx.fill();
    }
  }

  // balas y frascos
  for (const pr of G.projectiles) {
    if (pr.kind === 'bala' && pr.knife) {
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.ang);
      ctx.fillStyle = '#dfe3ee'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-2, -2.2); ctx.lineTo(-2, 2.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3d2b1f'; ctx.fillRect(-7, -1.3, 5, 2.6);
      ctx.restore();
    } else if (pr.kind === 'astral') {
      ctx.strokeStyle = 'rgba(190,150,255,0.5)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(pr.x - pr.vx * 0.04, pr.y - pr.vy * 0.04); ctx.lineTo(pr.x, pr.y); ctx.stroke();
      ctx.fillStyle = '#f0e6ff'; ctx.beginPath(); ctx.arc(pr.x, pr.y, 3.5, 0, TAU); ctx.fill();
    } else if (pr.kind === 'bala') {
      const ether = pr.boom > 0;
      ctx.strokeStyle = ether ? 'rgba(180,140,255,0.55)' : 'rgba(255,200,110,0.5)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(pr.x - pr.vx * 0.035, pr.y - pr.vy * 0.035); ctx.lineTo(pr.x, pr.y); ctx.stroke();
      ctx.fillStyle = ether ? '#e6d8ff' : '#fff3c4';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 2.6, 0, TAU); ctx.fill();
    } else if (pr.kind === 'onda') {
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.ang);
      ctx.globalAlpha = clamp(pr.life / 0.3, 0, 1);
      ctx.fillStyle = 'rgba(255,236,170,0.75)';
      ctx.beginPath(); ctx.arc(-10, 0, pr.r + 4, -1.1, 1.1); ctx.arc(-20, 0, pr.r, 1.0, -1.0, true); ctx.closePath(); ctx.fill();
      ctx.restore(); ctx.globalAlpha = 1;
    } else if (pr.kind === 'frasco') {
      const k = Math.min(1, pr.t / pr.dur), hgt = Math.sin(k * Math.PI) * 50;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(pr.x, pr.y + 4, 5, 2, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(pr.x, pr.y - hgt); ctx.rotate(pr.spin);
      ctx.fillStyle = '#5a3a1c'; ctx.beginPath(); ctx.arc(0, 2, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8a6a4a'; ctx.fillRect(-1.5, -6, 3, 5);
      ctx.fillStyle = '#ff9a3c'; ctx.fillRect(-1, -8, 2, 2);
      ctx.restore();
    }
  }
  if (G.muzzle) {
    const m = G.muzzle;
    const gr = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 10);
    gr.addColorStop(0, 'rgba(255,240,180,0.95)'); gr.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(m.x, m.y, 10, 0, TAU); ctx.fill();
  }

  // proyectiles enemigos: balas de mosquete (amarillentas) y orbes arcanos (violetas)
  for (const b of G.ebullets) {
    if (b.kind === 'bolt') {
      // virote: trazo largo y rojo
      ctx.strokeStyle = 'rgba(255,80,60,0.85)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03); ctx.lineTo(b.x, b.y); ctx.stroke();
      continue;
    }
    if (b.kind === 'spit') {
      ctx.fillStyle = 'rgba(120,230,80,0.9)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(200,255,150,0.8)'; ctx.beginPath(); ctx.arc(b.x - 1, b.y - 1, b.r * 0.4, 0, TAU); ctx.fill();
      continue;
    }
    if (b.kind === 'shot') {
      ctx.strokeStyle = 'rgba(255,160,90,0.6)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.04, b.y - b.vy * 0.04); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = '#ffd0a0'; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, TAU); ctx.fill();
      continue;
    }
    const gr = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.r + 5);
    gr.addColorStop(0, 'rgba(240,210,255,1)'); gr.addColorStop(0.5, 'rgba(150,70,220,0.9)'); gr.addColorStop(1, 'rgba(90,30,160,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 5, 0, TAU); ctx.fill();
  }

  // ondas de la campana y estallidos
  for (const fx of G.effects) {
    if (fx.kind === 'ring') {
      const a = fx.r < fx.maxR ? 0.9 : Math.max(0, fx.fade / 0.25) * 0.9;
      ctx.strokeStyle = `rgba(230,200,120,${a})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,240,200,${a * 0.4})`; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * 0.92, 0, TAU); ctx.stroke();
    } else if (fx.kind === 'blast') {
      const k = 1 - fx.life / fx.max;
      ctx.fillStyle = fx.ally ? `rgba(150,200,255,${0.4 * (1 - k)})` : fx.htype === 'veneno' ? `rgba(90,200,80,${0.5 * (1 - k)})` : fx.htype === 'fuego' ? `rgba(255,140,40,${0.55 * (1 - k)})` : `rgba(220,40,50,${0.5 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (0.8 + k * 0.3), 0, TAU); ctx.fill();
    } else if (fx.kind === 'boom') {
      const k = 1 - fx.life / fx.max;
      ctx.fillStyle = `rgba(170,120,255,${0.45 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (0.5 + k * 0.5), 0, TAU); ctx.fill();
    }
  }

  // partículas y números
  for (const q of G.particles) {
    ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
    ctx.fillStyle = q.color; ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 13px Georgia, serif'; ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  for (const t of G.texts) {
    ctx.globalAlpha = clamp(t.life / 0.6, 0, 1);
    ctx.strokeText(t.txt, t.x, t.y); ctx.fillStyle = t.color; ctx.fillText(t.txt, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  drawFog(x0, y0);
  ctx.restore();

  renderLights(Math.round(x0), Math.round(y0));
  drawLighting();
  drawVisions();
  drawEmbers();
  drawPost();
}

function drawLighting() {
  const R = Math.max(W, H);
  const k = clamp(G.t / RUN_LENGTH, 0, 1);
  ctx.fillStyle = `rgba(140,10,30,${0.04 + k * 0.12})`;
  ctx.fillRect(0, 0, W, H);
  if (G.rift.active) {
    const pulse = 0.5 + Math.sin(G.t * 3) * 0.5;
    ctx.fillStyle = `rgba(70,20,120,${0.16 + pulse * 0.08})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (G.phase === 2) {
    // Luna de sangre: el borde de la pantalla late en rojo
    const pulse = 0.5 + Math.sin(G.t * 1.6) * 0.5;
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, R * 0.75);
    v.addColorStop(0, 'rgba(150,0,20,0)'); v.addColorStop(1, `rgba(150,0,20,${0.22 + pulse * 0.1})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  if (G.lucidFlash > 0) {
    ctx.fillStyle = `rgba(190,150,255,${G.lucidFlash * 0.18})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// Con Lucidez alta, aparecen ojos que te miran desde la oscuridad
function drawVisions() {
  const L = G.player.lucidez;
  if (L < 5) return;
  const n = Math.min(16, Math.floor(L / 2));
  const epoch = Math.floor(G.t / 7);
  for (let i = 0; i < n; i++) {
    const h = hash(i, epoch);
    const side = h % 4;
    const u = ((h >>> 4) % 1000) / 1000, v = ((h >>> 14) % 120);
    let x, y;
    if (side === 0) { x = u * W; y = 20 + v; }
    else if (side === 1) { x = u * W; y = H - 20 - v; }
    else if (side === 2) { x = 20 + v; y = u * H; }
    else { x = W - 20 - v; y = u * H; }
    const open = Math.sin(G.t * 1.3 + i * 2.1);
    if (open < -0.2) continue;
    const s = 6 + (h % 6), op = Math.min(1, (open + 0.2) * 2);
    ctx.globalAlpha = 0.35 * op;
    ctx.fillStyle = '#c9a0ff';
    ctx.beginPath(); ctx.ellipse(x, y, s * 1.6, s * 0.6 * op, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#12061a';
    ctx.beginPath(); ctx.ellipse(x, y, s * 0.25, s * 0.55 * op, 0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- HUD gótico en pixel art
const hudCv = document.createElement('canvas'), hctx = hudCv.getContext('2d');
function drawOrnateHUD() {
  const p = G.player, HS = W >= 1600 ? 3 : 2, g = hctx;
  const bw = Math.floor(W / HS), bh = 74;
  if (hudCv.width !== bw || hudCv.height !== bh) { hudCv.width = bw; hudCv.height = bh; }
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, bw, bh);
  g.imageSmoothingEnabled = false;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const txt = (s, x, y, col, align = 'left', size = 8) => {
    g.font = `bold ${size}px Georgia, serif`; g.textAlign = align; g.lineJoin = 'round';
    g.lineWidth = 2.5; g.strokeStyle = '#0a0608'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y);
  };
  const GOLD = '#c9a35a', GOLD_HI = '#f0d890', GOLD_LO = '#6a4a1e', DARK = '#120a0c';

  // --- barra de vida con punta de hoja (crece con la vida máxima)
  const bx = 48, by = 16, L = Math.round(clamp(70 + p.maxHp * 0.45, 90, Math.min(200, bw - 120)));
  const hpK = clamp(p.hp / p.maxHp, 0, 1), rk = clamp(p.rally / p.maxHp, 0, 1 - hpK);
  R(bx - 2, by - 2, L + 3, 11, GOLD_LO); R(bx - 1, by - 1, L + 1, 9, DARK);
  R(bx - 2, by - 2, L + 3, 1, GOLD); R(bx - 2, by + 8, L + 3, 1, '#4a3014');
  R(bx, by, L * hpK, 7, '#9a1426'); R(bx, by, L * hpK, 1, '#e8505e'); R(bx, by + 5, L * hpK, 2, '#5a0a14');
  if (rk > 0.002) { R(bx + L * hpK, by, L * rk, 7, '#c8742a'); R(bx + L * hpK, by, L * rk, 1, '#f0b060'); }
  // la hoja: guarda dorada y punta de acero
  g.fillStyle = GOLD; g.beginPath(); g.moveTo(bx + L, by - 4); g.lineTo(bx + L + 3, by - 4); g.lineTo(bx + L + 3, by + 11); g.lineTo(bx + L, by + 11); g.fill();
  g.fillStyle = '#9aa0ac'; g.beginPath(); g.moveTo(bx + L + 3, by - 1); g.lineTo(bx + L + 14, by + 3.5); g.lineTo(bx + L + 3, by + 8); g.fill();
  R(bx + L + 3, by + 3, 9, 1, '#e0e4ec');
  txt(`${Math.ceil(p.hp)}`, bx + 3, by + 6.5, '#f1e6cf', 'left', 7);

  // --- aguante: barra fina azul con alambre de espinas al final
  const sy = by + 12, SL = Math.round(L * 0.72), sk = clamp(p.stamina / p.maxStamina, 0, 1);
  R(bx - 1, sy - 1, SL + 2, 5, DARK); R(bx - 1, sy - 1, SL + 2, 1, GOLD_LO);
  R(bx, sy, SL * sk, 3, p.stamina < 25 ? '#3a4a6a' : '#3a78c8'); R(bx, sy, SL * sk, 1, '#8ab8f0');
  g.strokeStyle = '#5a4636'; g.lineWidth = 1; g.beginPath();
  for (let i = 0; i < 6; i++) { const x = bx + SL + 2 + i * 4; g.moveTo(x, sy + 1.5); g.lineTo(x + 4, sy + 1.5); g.moveTo(x + 2, sy - 1); g.lineTo(x + 3, sy + 4); }
  g.stroke();

  // --- frascos de sangre
  const fy = sy + 9, nF = Math.max(1, Math.min(p.vials, 8));
  for (let i = 0; i < nF; i++) {
    const x = bx + i * 9, full = p.vials > 0;
    R(x + 2, fy, 3, 1, '#5a4630'); R(x + 2, fy + 1, 3, 2, '#d8d0c0');
    R(x, fy + 3, 7, 6, full ? '#7a0f1c' : '#2a1a1e'); R(x + 1, fy + 3, 5, 7, full ? '#c4304a' : '#3a2a2e');
    R(x + 1, fy + 3, 5, 1, '#1a0c10');
    if (full) { R(x + 1, fy + 4, 1, 2, '#ff9aaa'); R(x + 1, fy + 8, 5, 1, '#5a0a14'); }
  }
  if (p.vials > 8) txt('×' + p.vials, bx + 8 * 9 + 2, fy + 8, '#ff8a9a', 'left', 7);
  // munición
  const ax = bx + Math.min(8, Math.max(1, p.vials)) * 9 + (p.vials > 8 ? 20 : 6);
  R(ax, fy + 3, 2, 5, '#c9ccd8'); R(ax, fy + 7, 2, 2, GOLD); R(ax + 3, fy + 3, 2, 5, '#c9ccd8'); R(ax + 3, fy + 7, 2, 2, GOLD);
  txt(`${Math.floor(p.ammo)}/${p.maxAmmo}`, ax + 8, fy + 8.5, p.ammo < gunStats(p.gun).ammo ? '#ff5a5a' : '#d8dce8', 'left', 7);
  // lucidez: ojo violeta
  const ly = fy + 15;
  g.fillStyle = G.lucidFlash > 0 ? '#ffffff' : '#9a6ad8'; g.beginPath(); g.ellipse(bx + 4, ly, 4.5, 2.5, 0, 0, TAU); g.fill();
  R(bx + 3, ly - 1.5, 2, 3, '#14081e');
  txt(`Lucidez ${p.lucidez}`, bx + 11, ly + 3, '#c9a0ff', 'left', 7);
  if (G.mode !== 'stage') {
    const xk = clamp(p.xp / p.nextXp, 0, 1), xw = SL;
    R(bx + 60, ly - 2, xw * 0.6, 3, DARK); R(bx + 60, ly - 2, xw * 0.6 * xk, 3, GOLD); R(bx + 60, ly - 2, xw * 0.6 * xk, 1, GOLD_HI);
  }

  // --- medallón: corona de espinas dorada con el cazador y su luna carmesí
  const mx = 27, my = 27;
  g.fillStyle = GOLD_LO;
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * TAU + 0.1, r1 = 19, r2 = 24 + (i % 2) * 2;
    g.beginPath(); g.moveTo(mx + Math.cos(a - 0.12) * r1, my + Math.sin(a - 0.12) * r1); g.lineTo(mx + Math.cos(a) * r2, my + Math.sin(a) * r2); g.lineTo(mx + Math.cos(a + 0.12) * r1, my + Math.sin(a + 0.12) * r1); g.fill();
  }
  g.fillStyle = GOLD_LO; g.beginPath(); g.arc(mx, my, 19.5, 0, TAU); g.fill();
  g.fillStyle = GOLD; g.beginPath(); g.arc(mx, my, 18, 0, TAU); g.fill();
  g.fillStyle = GOLD_HI; g.beginPath(); g.arc(mx, my, 18, Math.PI * 1.05, Math.PI * 1.6); g.arc(mx, my, 16, Math.PI * 1.6, Math.PI * 1.05, true); g.fill();
  g.fillStyle = '#1a0e12'; g.beginPath(); g.arc(mx, my, 15, 0, TAU); g.fill();
  const hpLow = hpK < 0.3, moon = hpLow ? `rgb(${170 + Math.round(Math.sin(G.t * 8) * 60)},20,40)` : '#6a1222';
  g.fillStyle = moon; g.beginPath(); g.arc(mx + 3, my - 3, 9, 0, TAU); g.fill();
  // silueta del cazador: sombrero de ala ancha, cuello alto y ojos que brillan
  g.fillStyle = '#08050a';
  g.beginPath(); g.ellipse(mx, my - 3, 11, 2.6, -0.08, 0, TAU); g.fill();
  R(mx - 5, my - 10, 10, 7, '#08050a'); R(mx - 6, my - 4, 12, 1, '#3a2a20');
  R(mx - 4, my - 1, 8, 6, '#0e0a0e'); R(mx - 7, my + 4, 14, 8, '#08050a');
  R(mx - 3, my + 1, 2, 1, hpLow ? '#ff4040' : '#e8c070'); R(mx + 1, my + 1, 2, 1, hpLow ? '#ff4040' : '#e8c070');
  R(mx - 4, my + 3, 8, 2, '#2a1a1a');
  // colgante bajo el medallón
  R(mx, my + 19, 1, 6, GOLD_LO); R(mx - 2, my + 25, 5, 1, GOLD); R(mx, my + 24, 1, 5, GOLD);
  g.fillStyle = '#b8182e'; g.beginPath(); g.arc(mx + 0.5, my + 31, 2, 0, TAU); g.fill();
  // insignia de nivel
  const lvl = G.mode === 'stage' ? G.stage.n : p.level;
  g.fillStyle = GOLD; g.beginPath(); g.arc(9, 9, 6, 0, TAU); g.fill();
  g.fillStyle = DARK; g.beginPath(); g.arc(9, 9, 4.8, 0, TAU); g.fill();
  txt(String(lvl), 9, 11.8, '#f0d890', 'center', 7);

  // --- contador de esencia arriba a la derecha, entre ramas de espinas
  const cw = 58, cx = bw - cw - 34, cy = 12;
  g.strokeStyle = '#3a2a1e'; g.lineWidth = 1; g.beginPath();
  for (let i = 0; i < 5; i++) { const x = cx - 4 - i * 5; g.moveTo(x, cy + 8 + Math.sin(i) * 2); g.lineTo(x - 5, cy + 8 + Math.sin(i + 1) * 2); g.moveTo(x - 2, cy + 6 + (i % 2) * 5); g.lineTo(x - 3, cy + 8); }
  g.stroke();
  R(cx - 2, cy - 2, cw + 4, 20, GOLD_LO); R(cx - 1, cy - 1, cw + 2, 18, GOLD); R(cx, cy, cw, 16, '#1a1014');
  R(cx, cy, cw, 1, '#3a2a28'); R(cx - 1, cy - 1, cw + 2, 1, GOLD_HI);
  // emblema: rombo de sangre con aspa de espinas
  const ex = cx + cw + 12, ey = cy + 8;
  g.strokeStyle = GOLD_LO; g.lineWidth = 2; g.beginPath(); g.moveTo(ex - 11, ey - 11); g.lineTo(ex + 11, ey + 11); g.moveTo(ex + 11, ey - 11); g.lineTo(ex - 11, ey + 11); g.stroke();
  g.strokeStyle = GOLD; g.lineWidth = 1; g.beginPath(); g.moveTo(ex - 10, ey - 10); g.lineTo(ex + 10, ey + 10); g.moveTo(ex + 10, ey - 10); g.lineTo(ex - 10, ey + 10); g.stroke();
  g.fillStyle = GOLD; g.beginPath(); g.moveTo(ex, ey - 7); g.lineTo(ex + 6, ey); g.lineTo(ex, ey + 7); g.lineTo(ex - 6, ey); g.fill();
  g.fillStyle = '#b8182e'; g.beginPath(); g.moveTo(ex, ey - 5); g.lineTo(ex + 4, ey); g.lineTo(ex, ey + 5); g.lineTo(ex - 4, ey); g.fill();
  R(ex - 1, ey - 3, 1, 2, '#ff8a9a');
  txt(String(Math.floor(G.essence)), cx + cw / 2, cy + 11.5, '#f0e2c4', 'center', 9);
  txt(`☠ ${G.kills}   ◆ ${G.fragments}`, cx + cw, cy + 28, '#b8aca0', 'right', 7);

  mainCtx.save(); mainCtx.imageSmoothingEnabled = false;
  mainCtx.drawImage(hudCv, 0, 0, bw * HS, bh * HS);
  mainCtx.restore();
  return HS;
}

function drawHUD() {
  const p = G.player;
  const HS = drawOrnateHUD();
  const sAmmo = gunStats(p.gun).ammo;
  if (p.ammo < sAmmo) { ctx.textAlign = 'left'; ctx.font = 'bold 12px Georgia, serif'; ctx.fillStyle = '#ff5a5a'; ctx.fillText('Sin balas · R: balas de sangre', 16, HS * 70); }
  // estados activos
  const st = [];
  if (p.paper) st.push([`${ITEMS[p.paper.elem === 'fuego' ? 'papelFuego' : 'papelRayo'].icon} ${ELEMENTS[p.paper.elem].name} ${Math.ceil(p.paper.t)}s`, '#ffe07a']);
  if (p.beastT > 0) st.push([`🫀 Bestialidad +${40 + p.beastStacks}% · ${Math.ceil(p.beastT)}s`, '#ff6a4a']);
  if (p.windT > 0) st.push([`🪶 Viento ${Math.ceil(p.windT)}s`, '#d8f0ff']);
  if (p.sedT > 0) st.push([`💊 Calma ${Math.ceil(p.sedT)}s`, '#a8e0ff']);
  if (p.poisonT > 0) st.push([`☠ Envenenado ${Math.ceil(p.poisonT)}s`, '#7be38a']);
  if (p.madness > 50) st.push([`🌀 Locura ${Math.round(p.madness)}%`, '#d07cff']);
  ctx.font = '12px Georgia, serif';
  ctx.textAlign = 'left';
  st.forEach(([txt, col], i) => { ctx.fillStyle = col; ctx.fillText(txt, 16, HS * 70 + 18 + i * 16); });

  const mx = W / 2, my = 42;
  if (G.mode === 'stage') {
    // encabezado del modo normal: nivel, zona, IA y objetivo
    const S = G.stage, rem = G.enemies.filter(e => !e.dead).length + S.spawns.length + (S.waves > 0 ? S.second : 0);
    ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.font = 'bold 20px Georgia, serif';
    const t1 = isBossStage(S.n) ? `Nivel ${S.n} · JEFE` : `Nivel ${S.n}`;
    ctx.strokeText(t1, mx, 32); ctx.fillStyle = isBossStage(S.n) ? '#ff5a6a' : '#c9a35a'; ctx.fillText(t1, mx, 32);
    ctx.font = '13px Georgia, serif';
    const t2 = `${D().icon} ${D().name} · ${stageTheme(S.n).name} · IA ${'◆'.repeat(G.ai)}${'◇'.repeat(4 - G.ai)} · jefe en el nivel ${Math.ceil(S.n / BOSS_EVERY) * BOSS_EVERY}`;
    ctx.strokeText(t2, mx, 52); ctx.fillStyle = '#e8dcc4'; ctx.fillText(t2, mx, 52);
    const t3 = S.cleared ? (S.door ? 'Caminá hacia la puerta ➜' : 'Nivel superado') : `Enemigos restantes: ${rem}`;
    ctx.strokeText(t3, mx, 70); ctx.fillStyle = S.cleared ? '#ffe07a' : '#ff8a9a'; ctx.fillText(t3, mx, 70);
  } else {
  // luna-reloj: pasa de pálida a carmesí
  const k = clamp(G.t / RUN_LENGTH, 0, 1);
  let mr = Math.round(lerp(232, 196, k)), mg = Math.round(lerp(220, 30, k)), mb = Math.round(lerp(196, 48, k));
  if (G.rift.active) { mr = 150; mg = 90; mb = 230; }
  const glow = ctx.createRadialGradient(mx, my, 10, mx, my, 40);
  glow.addColorStop(0, `rgba(${mr},${mg},${mb},0.45)`); glow.addColorStop(1, `rgba(${mr},${mg},${mb},0)`);
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(mx, my, 40, 0, TAU); ctx.fill();
  ctx.fillStyle = `rgb(${mr},${mg},${mb})`; ctx.beginPath(); ctx.arc(mx, my, 20, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.arc(mx - 6, my - 4, 4, 0, TAU); ctx.arc(mx + 7, my + 5, 3, 0, TAU); ctx.fill();
  ctx.textAlign = 'center'; ctx.font = 'bold 20px Georgia, serif';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.strokeText(fmtTime(G.t), mx, my + 44); ctx.fillStyle = '#e8dcc4'; ctx.fillText(fmtTime(G.t), mx, my + 44);
  ctx.font = '11px Georgia, serif';
  if (G.rift.active) { ctx.fillStyle = '#b07cff'; ctx.fillText(`GRIETA ABIERTA · ${Math.ceil(G.rift.end - G.t)} s`, mx, my + 60); }
  else { ctx.fillStyle = G.phase === 2 ? '#ff5a6a' : '#8a7c66'; ctx.fillText(`${NIGHT[G.phase].name} · amanecer 10:00`, mx, my + 60); }
  }

  // barra de jefe: el élite vivo más relevante (prioriza al jefe final)
  let boss = null;
  for (const e of G.enemies) {
    if (e.dead || !e.elite) continue;
    if (!boss || ETYPES[e.type].boss || (!ETYPES[boss.type].boss && dist2(e.x, e.y, p.x, p.y) < dist2(boss.x, boss.y, p.x, p.y))) boss = e;
  }
  if (boss && (ETYPES[boss.type].boss || dist2(boss.x, boss.y, p.x, p.y) < 700 * 700)) {
    const T = ETYPES[boss.type], bw = Math.min(460, W - 40), bx = (W - bw) / 2, by = my + 82;
    ctx.font = 'bold 14px Georgia, serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    const title = T.name + (boss.phase2 ? ' · enfurecido' : '');
    ctx.strokeText(title, W / 2, by - 6); ctx.fillStyle = '#e8dcc4'; ctx.fillText(title, W / 2, by - 6);
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(bx, by, bw, 8);
    ctx.fillStyle = T.eldritch ? '#8a3fd0' : '#b8182e'; ctx.fillRect(bx, by, bw * clamp(boss.hp / boss.maxHp, 0, 1), 8);
    ctx.strokeStyle = '#5a2430'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx + bw * 0.5, by, 1, 8);
  }

  ctx.textAlign = 'right';
  if (muted) { ctx.font = '12px Georgia, serif'; ctx.fillStyle = '#8a7c66'; ctx.fillText('sonido apagado (M)', W - 16, HS * 48); }

  // flecha hacia el rastro de esencia perdida
  if (G.trace) {
    const sx = W / 2 + (G.trace.x - G.cam.x), sy = H / 2 + (G.trace.y - G.cam.y);
    if (sx < 20 || sx > W - 20 || sy < 20 || sy > H - 20) {
      const a = Math.atan2(sy - H / 2, sx - W / 2), r = Math.min(W, H) / 2 - 40;
      const ax = W / 2 + Math.cos(a) * r, ay = H / 2 + Math.sin(a) * r;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
      ctx.fillStyle = 'rgba(224,60,80,0.85)'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.textAlign = 'center'; ctx.font = '11px Georgia, serif'; ctx.fillStyle = '#ff8a9a';
      ctx.fillText(`◈ ${G.trace.amount} · ${Math.round(Math.hypot(G.trace.x - p.x, G.trace.y - p.y) / 10)} m`, ax, ay + 20);
    }
  }

  // inventario: armas (con rareza), atuendo, amuletos, herramientas y reliquias agrupadas
  const items = [];
  for (const kind of ['gun', 'melee']) { const w = p[kind], d = CATALOG[kind][w.id], pl = plusOf(w.id); items.push([d.icon, (kind === 'melee' ? (w.form ? 'B' : 'A') + ' ' : '') + 'nv' + w.level + (pl ? ' +' + pl : ''), RARITIES[d.rarity].color]); }
  const sets = {}; for (const k of PIECE_IDS) sets[p.outfit[k]] = (sets[p.outfit[k]] || 0) + 1;
  const mainSet = Object.keys(sets).sort((a, b) => sets[b] - sets[a])[0], at = ATTIRES[mainSet];
  items.push([at.icon, mainSet === 'viaje' ? '' : `${sets[mainSet]}/4`, at.rarity >= 0 ? RARITIES[at.rarity].color : NEUTRAL]);
  for (let i = 0; i < AMULET_SLOTS; i++) {
    const a = G.amulets[i];
    items.push(a ? [AMULETS[a.id].icon, '', RARITIES[a.rarity].color] : ['·', '', '#3a2a30']);
  }
  for (const t of p.tools) items.push([TOOL_DEFS[t.id].icon, 'nv' + t.level, NEUTRAL]);
  const grouped = {};
  for (const r of G.relics) { const g = grouped[r.id] || (grouped[r.id] = { n: 0, best: 0 }); g.n++; g.best = Math.max(g.best, r.rarity); }
  for (const id in grouped) items.push([RELICS[id].icon, '×' + grouped[id].n, RARITIES[grouped[id].best].color]);
  ctx.textAlign = 'center';
  let ix = 16, iy = H - 52;
  for (const [icon, lbl, col] of items) {
    if (ix + 36 > W - 16) { ix = 16; iy -= 42; }
    ctx.fillStyle = 'rgba(14,10,16,0.85)'; ctx.fillRect(ix, iy, 36, 36);
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(ix + 0.5, iy + 0.5, 36, 36);
    ctx.font = '19px serif'; ctx.fillStyle = '#fff'; ctx.fillText(icon, ix + 18, iy + 24);
    ctx.font = 'bold 10px Georgia, serif'; ctx.fillStyle = col; ctx.fillText(lbl, ix + 23, iy + 34);
    ix += 42;
  }
  // forma actual del arma cuerpo a cuerpo
  ctx.textAlign = 'left'; ctx.font = '12px Georgia, serif';
  ctx.fillStyle = p.melee.bonus ? '#ffe07a' : '#a99a80';
  const ms = meleeStats(p.melee);
  ctx.fillText(`${ms.name} (${ELEMENTS[ms.elem].icon} ${ELEMENTS[ms.elem].name})${p.melee.bonus ? ' · ¡golpe de transformación listo!' : ''}`, 16, iy - 8);
  // arte oculta (E) y cinturón (F / C), abajo a la derecha
  const box = (x, y, icon, label, col, cdFrac) => {
    ctx.fillStyle = 'rgba(14,10,16,0.85)'; ctx.fillRect(x, y, 44, 44);
    if (cdFrac > 0) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y + 44 * (1 - cdFrac), 44, 44 * cdFrac); }
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, 44, 44);
    ctx.textAlign = 'center'; ctx.font = '22px serif'; ctx.fillStyle = '#fff'; ctx.fillText(icon, x + 22, y + 30);
    ctx.font = 'bold 10px Georgia, serif'; ctx.fillStyle = col; ctx.fillText(label, x + 22, y + 56);
  };
  const bx0 = W - 16 - 44, by0 = H - 92;
  const selId = BELT[p.beltSel], selN = p.belt[selId];
  box(bx0, by0, selN ? ITEMS[selId].icon : '·', selN ? `F ×${selN}` : 'F vacío', selN ? '#c9a35a' : '#3a2a30', 0);
  if (selN) { ctx.textAlign = 'right'; ctx.font = '11px Georgia, serif'; ctx.fillStyle = '#a99a80'; ctx.fillText(ITEMS[selId].name + ' (C cambia)', W - 16, by0 - 6); }
  if (p.art) {
    const ad = ARTS[p.art.id], cdMax = ad.cd * (1 - 0.15 * (p.art.level - 1));
    box(bx0 - 52, by0, ad.icon, `E · ${ad.cost}⁍`, RARITIES[ad.rarity].color, clamp(p.art.cd / cdMax, 0, 1));
  }
  // recordatorio de controles
  ctx.textAlign = 'right'; ctx.fillStyle = '#7a6c58'; ctx.font = '11px Georgia, serif';
  ctx.fillText('Shift esquivar · Q vial · R balas de sangre · Espacio transformar · T tienda (Lucidez)', W - 16, H - 14);

  // aviso central
  if (G.banner) {
    const b = G.banner, a = clamp(Math.min(b.time, b.max - b.time) / 0.4, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = 'bold 24px Georgia, serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    const byy = G.mode === 'stage' ? H * 0.45 : H * 0.28;
    ctx.strokeText(b.text, W / 2, byy); ctx.fillStyle = b.color; ctx.fillText(b.text, W / 2, byy);
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- Bucle principal
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // el próximo cuadro se agenda primero: un error puntual nunca congela el juego
  requestAnimationFrame(frame);
  try {
    if (state === 'play') { if (G.hitstop > 0) G.hitstop -= dt; else update(dt); }
    render();
  } catch (err) { console.error(err); }
}
newRun(false);     // escena de fondo para el menú
setState('menu');
requestAnimationFrame(frame);

// Gancho de depuración para pruebas desde la consola
window.__vellmoor = {
  get G() { return G; }, get state() { return state; },
  skipTo(t) { G.t = t; G.nextElite = Math.max(G.nextElite, Math.ceil(t / 120) * 120); G.hordes = G.hordes.filter(h => h > t); if (G.rift.next < t) G.rift.next = t + 1; },
  step(dt) { if (state === 'play') update(dt); },
};
