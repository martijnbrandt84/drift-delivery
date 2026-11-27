// =========================================================
// TOUCH CONTROLS FOR MOBILE
// All fingers are tracked centrally: on every touch event we work out which buttons are under a
// finger and press/release keys from that. Nothing can get stuck, and you can slide between buttons.
// Buttons send the same key codes as the keyboard, so car, plane and race just work.
// =========================================================
const isTouch = (typeof window !== 'undefined') && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia?.('(pointer: coarse)').matches);

function sendKey(code, down) {
  window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
}

const holdButtons = []; // { el, code }
const tapButtons = [];  // { el, code | action }
const activePointers = new Map(); // pointerId -> { x, y, tapped: Set }
const pressed = new Set();

function makeButton(parent, label, code, cls = '', opts = {}) {
  const b = document.createElement('div');
  b.className = `tc-btn ${cls}`;
  b.innerHTML = label;
  parent.appendChild(b);
  if (opts.tap) tapButtons.push({ el: b, code, action: opts.action });
  else holdButtons.push({ el: b, code });
  return b;
}

// Een vinger telt ook als hij net naast de knop zit (ruimere raakzone dan de knop zelf)
function hit(el, x, y, pad = 12) {
  if (el.id === 'hijack-prompt') { if (!el.classList.contains('visible')) return false; }
  else if (!el.offsetParent) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0) return false;
  return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
}

function overAnyControl(x, y) {
  return holdButtons.some((b) => hit(b.el, x, y)) || tapButtons.some((b) => hit(b.el, x, y, 6));
}

function refresh() {
  const want = new Set();
  activePointers.forEach((p) => {
    holdButtons.forEach((b) => { if (hit(b.el, p.x, p.y)) want.add(b.code); });
  });
  pressed.forEach((code) => { if (!want.has(code)) { pressed.delete(code); sendKey(code, false); } });
  want.forEach((code) => { if (!pressed.has(code)) { pressed.add(code); sendKey(code, true); } });
  holdButtons.forEach((b) => b.el.classList.toggle('down', pressed.has(b.code)));
}

function releaseAll() {
  activePointers.clear();
  refresh();
}

function onDown(e) {
  if (e.pointerType === 'mouse') return;
  const p = { x: e.clientX, y: e.clientY };
  activePointers.set(e.pointerId, p);
  // Grote kaart open: die vangt de tik zelf af (sluiten), de knoppen eronder niet
  const ov = document.getElementById('fullmap-overlay');
  if (ov && !ov.hidden) return;
  // Tikknoppen reageren direct bij aanraken
  tapButtons.forEach((b) => {
    if (!hit(b.el, p.x, p.y, 6)) return;
    if (b.action) b.action();
    else { sendKey(b.code, true); sendKey(b.code, false); }
    b.el.classList.add('down');
    setTimeout(() => b.el.classList.remove('down'), 140);
  });
  if (overAnyControl(p.x, p.y)) e.preventDefault();
  refresh();
}
function onMove(e) {
  const p = activePointers.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX;
  p.y = e.clientY;
  refresh();
}
function onUp(e) {
  if (!activePointers.has(e.pointerId)) return;
  activePointers.delete(e.pointerId);
  refresh();
}

// ---------- Fullscreen + liggend ----------
function toggleFullscreen() {
  const d = document;
  const el = d.documentElement;
  const isFs = d.fullscreenElement || d.webkitFullscreenElement;
  if (isFs) {
    (d.exitFullscreen || d.webkitExitFullscreen)?.call(d);
    return;
  }
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) {
    showHint('Fullscreen: use “Add to Home Screen” in your browser menu');
    return;
  }
  Promise.resolve(req.call(el, { navigationUI: 'hide' }))
    .then(() => screen.orientation?.lock?.('landscape'))
    .catch(() => {});
}

let hintEl = null;
function showHint(text) {
  if (!hintEl) {
    hintEl = document.createElement('div');
    hintEl.id = 'tc-hint';
    document.body.appendChild(hintEl);
  }
  hintEl.textContent = text;
  hintEl.classList.add('show');
  clearTimeout(showHint.t);
  showHint.t = setTimeout(() => hintEl.classList.remove('show'), 3500);
}

if (isTouch) {
  document.body.classList.add('touch');

  const left = document.createElement('div');
  left.id = 'tc-left';
  document.body.appendChild(left);
  makeButton(left, '◀', 'ArrowLeft', 'steer');
  makeButton(left, '▶', 'ArrowRight', 'steer');

  const right = document.createElement('div');
  right.id = 'tc-right';
  document.body.appendChild(right);
  const flyCol = document.createElement('div');
  flyCol.className = 'tc-fly';
  right.appendChild(flyCol);
  makeButton(flyCol, '▲<small>climb</small>', 'ArrowUp', 'small');
  makeButton(flyCol, '▼<small>dive</small>', 'ArrowDown', 'small');
  const pedals = document.createElement('div');
  pedals.className = 'tc-pedals';
  right.appendChild(pedals);
  makeButton(pedals, 'DRIFT', 'Space', 'drift');
  makeButton(pedals, 'BRAKE', 'KeyS', 'brake');
  makeButton(pedals, 'GAS', 'KeyW', 'gas');

  const actions = document.createElement('div');
  actions.id = 'tc-actions';
  document.body.appendChild(actions);
  makeButton(actions, 'Map', 'KeyK', 'mini', { tap: true });
  makeButton(actions, 'Reset', 'KeyR', 'mini', { tap: true });
  makeButton(actions, 'Horn', 'KeyH', 'mini', { tap: true });
  makeButton(actions, '⛶', null, 'mini fs', { tap: true, action: toggleFullscreen });

  // De instap-melding is ook een tikknop: tikken = F
  const prompt = document.getElementById('hijack-prompt');
  if (prompt) tapButtons.push({ el: prompt, code: 'KeyF' });

  window.addEventListener('pointerdown', onDown, { passive: false });
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  // Vangnetten: alles loslaten als de app de focus verliest of het scherm draait
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  window.addEventListener('orientationchange', releaseAll);
  // Geen lang-drukken-menu, zoom of tekstselectie op de knoppen
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  // Grote kaart sluiten door te tikken
  const overlay = document.getElementById('fullmap-overlay');
  if (overlay) {
    overlay.addEventListener('pointerdown', (e) => {
      if (e.target && e.target.id === 'contour-btn') return;
      if (!overlay.hidden) { sendKey('KeyK', true); sendKey('KeyK', false); }
    });
  }

  // Menu standaard ingeklapt op een klein scherm
  const collapseBtn = document.getElementById('collapse-btn');
  const cardBody = document.getElementById('card-body');
  if (collapseBtn && cardBody && !cardBody.classList.contains('collapsed')) collapseBtn.click();

  // Staand scherm: vriendelijke hint om te draaien (blokkeert niets)
  const checkOrientation = () => {
    if (window.innerHeight > window.innerWidth) showHint('Turn your phone sideways for the best view ↻');
  };
  window.addEventListener('resize', checkOrientation);
  setTimeout(checkOrientation, 800);
}
