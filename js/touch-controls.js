// =========================================================
// TOUCHBESTURING VOOR MOBIEL
// Knoppen sturen dezelfde toetscodes als het toetsenbord, zodat auto, vliegtuig en race gewoon werken.
// =========================================================
const isTouch = (typeof window !== 'undefined') && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia?.('(pointer: coarse)').matches);

function sendKey(code, down) {
  window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
}

function makeButton(parent, label, code, cls = '', opts = {}) {
  const b = document.createElement('button');
  b.className = `tc-btn ${cls}`;
  b.innerHTML = label;
  b.type = 'button';
  parent.appendChild(b);
  const active = new Set();
  const press = (e) => {
    e.preventDefault();
    active.add(e.pointerId);
    try { b.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
    if (active.size === 1) {
      b.classList.add('down');
      sendKey(code, true);
      if (opts.tap) {
        sendKey(code, false);
      }
    }
  };
  const release = (e) => {
    if (!active.has(e.pointerId)) return;
    active.delete(e.pointerId);
    if (active.size === 0) {
      b.classList.remove('down');
      if (!opts.tap) sendKey(code, false);
    }
  };
  b.addEventListener('pointerdown', press);
  b.addEventListener('pointerup', release);
  b.addEventListener('pointercancel', release);
  b.addEventListener('lostpointercapture', release);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  return b;
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
  makeButton(pedals, 'BRAKE<small>reverse</small>', 'KeyS', 'brake');
  makeButton(pedals, 'GAS', 'KeyW', 'gas');
  makeButton(right, 'DRIFT', 'Space', 'drift');

  const actions = document.createElement('div');
  actions.id = 'tc-actions';
  document.body.appendChild(actions);
  makeButton(actions, 'Map', 'KeyK', 'mini', { tap: true });
  makeButton(actions, 'Reset', 'KeyR', 'mini', { tap: true });
  makeButton(actions, 'Horn', 'KeyH', 'mini', { tap: true });

  // De instap-melding wordt een knop: tikken = F
  const prompt = document.getElementById('hijack-prompt');
  if (prompt) {
    prompt.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sendKey('KeyF', true);
      sendKey('KeyF', false);
    });
  }

  // Grote kaart sluiten door te tikken
  const overlay = document.getElementById('fullmap-overlay');
  if (overlay) {
    overlay.addEventListener('pointerdown', () => {
      if (!overlay.hidden) {
        sendKey('KeyK', true);
        sendKey('KeyK', false);
      }
    });
  }

  // Menu standaard ingeklapt op een klein scherm
  const collapseBtn = document.getElementById('collapse-btn');
  const cardBody = document.getElementById('card-body');
  if (collapseBtn && cardBody && !cardBody.classList.contains('collapsed')) collapseBtn.click();

  // Alle toetsen loslaten als de app naar de achtergrond gaat
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'Space'].forEach((c) => sendKey(c, false));
  });
}
