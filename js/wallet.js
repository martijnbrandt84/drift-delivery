// =========================================================
// PORTEMONNEE: geld verdien je met minigames (oogsten, de race winnen).
// Het saldo blijft bewaard in de browser.
// =========================================================
import { showToast } from './ui-controls.js';

const cashEl = document.getElementById('cash');
let cash = 0;
try {
  const v = parseInt(localStorage.getItem('pinewood-cash') ?? '0', 10);
  if (Number.isFinite(v) && v > 0) cash = v;
} catch (e) { /* geen opslag beschikbaar */ }

const fmtCash = (n) => `$${n.toLocaleString('en-US')}`;

function render(pop = false) {
  if (!cashEl) return;
  cashEl.textContent = fmtCash(cash);
  if (pop && cashEl.classList) {
    cashEl.classList.remove('pop');
    void cashEl.offsetWidth; // animatie opnieuw starten
    cashEl.classList.add('pop');
  }
}
render();

export function getCash() {
  return cash;
}

export function addCash(amount, reason = '') {
  cash += Math.round(amount);
  try { localStorage.setItem('pinewood-cash', String(cash)); } catch (e) { /* niet opslaan */ }
  render(true);
  if (reason) showToast(`+${fmtCash(Math.round(amount))} — ${reason}`);
}
