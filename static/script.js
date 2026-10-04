const $ = id => document.getElementById(id);

const listEl          = $('list');
const enInput         = $('enInput');
const faInput         = $('faInput');
const hintEl          = $('hint');
const countEl         = $('count');
const hiddenCountEl   = $('hiddenCount');
const revealedCountEl = $('revealedCount');
const faBtn           = $('hideFaBtn');
const enBtn           = $('hideEnBtn');
const resetBtn        = $('resetBtn');
const addBtn          = $('addBtn');

const settingsBtn     = $('settingsBtn');
const closeSettings   = $('closeSettings');
const drawer          = $('drawer');
const drawerOverlay   = $('drawerOverlay');
const clearAllBtn     = $('clearAll');

const toastContainer  = $('toastContainer');
const confettiHolder  = $('confettiHolder');

let words = [];
let hideEn = false;
let hideFa = false;
const revealedEn = new Set();
const revealedFa = new Set();

/* ====== تنظیمات ====== */
const settingsKey = 'vocab_settings_v1';
let settings = { theme: 'dark', fontSize: 'medium', animations: 'on', sound: 'off' };

function loadSettings() {
  try { settings = { ...settings, ...JSON.parse(localStorage.getItem(settingsKey) || '{}') }; } catch (e) {}
  applySettings();
}
function saveSettings() { localStorage.setItem(settingsKey, JSON.stringify(settings)); }
function applySettings() {
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.dataset.anim  = settings.animations;

  const scale = settings.fontSize === 'small' ? 0.9 : settings.fontSize === 'large' ? 1.15 : 1;
  document.documentElement.style.setProperty('--font-scale', scale);

  document.querySelectorAll('.theme-swatch').forEach(sw =>
    sw.classList.toggle('active', sw.dataset.themeValue === settings.theme));

  document.querySelectorAll('.segmented').forEach(seg => {
    const key = seg.dataset.setting;
    seg.querySelectorAll('button').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.value === settings[key]));
  });
}

/* ====== Toast ====== */
function showToast(message, type = 'info') {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML = `<div class="toast-icon">${icons[type] || 'ℹ'}</div><div class="toast-message">${message}</div>`;
  toastContainer.appendChild(toast);
  setTimeout(() => { toast.classList.add('out'); setTimeout(() => toast.remove(), 300); }, 3000);
}

/* ====== Confetti ====== */
function fireConfetti() {
  if (settings.animations === 'off') return;
  const colors = ['#8b5cf6','#ec4899','#06b6d4','#10b981','#f59e0b','#ef4444'];
  const rect = addBtn.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  for (let i = 0; i < 25; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti';
    piece.style.left = cx + 'px';
    piece.style.top = cy + 'px';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    const size = (6 + Math.random() * 8) + 'px';
    piece.style.width = size;
    piece.style.height = size;

    const angle = Math.random() * Math.PI * 2;
    const dist = 100 + Math.random() * 250;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const rot = Math.random() * 720 - 360;

    piece.animate([
      { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rot}deg)`, opacity: 0 }
    ], {
      duration: 900 + Math.random() * 500,
      easing: 'cubic-bezier(0.15, 0.6, 0.4, 1)',
      fill: 'forwards'
    });

    confettiHolder.appendChild(piece);
    setTimeout(() => piece.remove(), 1500);
  }
}

/* ====== صدا ====== */
let audioCtx = null;
function playBeep(freq = 800, duration = 0.08) {
  if (settings.sound !== 'on') return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

/* ====== API ====== */
async function fetchWords() {
  try {
    const res = await fetch('/api/words');
    words = await res.json();
    render();
  } catch { showToast('خطا در دریافت داده‌ها', 'error'); }
}

async function addWordToServer(en, fa) {
  const res = await fetch('/api/words', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ en, fa })
  });
  if (!res.ok) { showToast('خطا در ذخیره', 'error'); return; }
  words = await res.json();
  render(); fireConfetti(); playBeep(900);
  showToast('کلمه اضافه شد', 'success');
}

async function deleteWordFromServer(index) {
  const res = await fetch('/api/words/' + index, { method: 'DELETE' });
  if (!res.ok) return;
  words = await res.json();
  revealedEn.clear(); revealedFa.clear();
  render(); playBeep(400, 0.1);
  showToast('کلمه حذف شد', 'info');
}

async function clearAllWords() {
  for (let i = words.length - 1; i >= 0; i--) await fetch('/api/words/' + i, { method: 'DELETE' });
  words = []; revealedEn.clear(); revealedFa.clear();
  render(); showToast('همه کلمات پاک شدند', 'success');
}

/* ====== ساخت المان‌ها ====== */
function makeCell(text, lang, index, hidden, revealedSet) {
  const cell = document.createElement('div');
  cell.className = 'cell ' + lang;
  cell.textContent = text;
  if (hidden) {
    if (revealedSet.has(index)) cell.classList.add('revealed');
    else {
      cell.classList.add('covered');
      cell.title = 'برای دیدن کلیک کن';
      cell.addEventListener('click', () => {
        revealedSet.add(index); playBeep(600, 0.06); render();
      });
    }
  }
  return cell;
}

function makeDeleteBtn(index) {
  const btn = document.createElement('button');
  btn.className = 'del';
  btn.title = 'حذف';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>`;
  btn.addEventListener('click', () => deleteWordFromServer(index));
  return btn;
}

/* ====== رندر ====== */
function render() {
  listEl.innerHTML = '';

  if (words.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = `<span class="empty-icon">📭</span>هنوز هیچ کلمه‌ای اضافه نکردی.<br>اولین کلمه‌ت رو از بالا اضافه کن!`;
    listEl.appendChild(empty);
  } else {
    words.forEach((w, i) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.appendChild(makeCell(w.en, 'en', i, hideEn, revealedEn));
      row.appendChild(makeCell(w.fa, 'fa', i, hideFa, revealedFa));
      row.appendChild(makeDeleteBtn(i));
      listEl.appendChild(row);
    });
  }
  updateStats(); updateToolbar();
}

function updateStats() {
  countEl.textContent = words.length;

  let revealed = 0, hidden = 0;
  if (hideEn || hideFa) {
    const totalHidden = (hideEn ? words.length : 0) + (hideFa ? words.length : 0);
    const revealedTotal = revealedEn.size + revealedFa.size;
    revealed = revealedTotal;
    hidden = totalHidden - revealedTotal;
  } else {
    revealed = words.length;
  }
  revealedCountEl.textContent = revealed;
  hiddenCountEl.textContent = hidden;
}

function updateToolbar() {
  faBtn.classList.toggle('active', hideFa);
  enBtn.classList.toggle('active', hideEn);

  const faSpan = faBtn.querySelector('span');
  const enSpan = enBtn.querySelector('span');
  if (faSpan) faSpan.textContent = hideFa ? 'نمایش فارسی' : 'پنهان کردن فارسی';
  if (enSpan) enSpan.textContent = hideEn ? 'نمایش انگلیسی' : 'پنهان کردن انگلیسی';

  const msgs = [];
  if (hideFa) msgs.push('کلمه‌های فارسی پوشیده شدن');
  if (hideEn) msgs.push('کلمه‌های انگلیسی پوشیده شدن');
  hintEl.textContent = msgs.length ? msgs.join(' و ') + ' — روی هر کلمه بزن تا فقط همون یکی نمایان بشه' : '';
}

/* ====== افزودن ====== */
function addWord() {
  const en = enInput.value.trim();
  const fa = faInput.value.trim();
  if (!en && !fa) { showToast('هر دو فیلد را پر کن', 'error'); enInput.focus(); return; }
  if (!en) { showToast('کلمه انگلیسی را بنویس', 'error'); enInput.focus(); return; }
  if (!fa) { showToast('ترجمه فارسی را بنویس', 'error'); faInput.focus(); return; }

  enInput.value = ''; faInput.value = ''; enInput.focus();
  addWordToServer(en, fa);
}

/* ====== رویدادها ====== */
addBtn.addEventListener('click', addWord);
enInput.addEventListener('keydown', e => { if (e.key === 'Enter') faInput.focus(); });
faInput.addEventListener('keydown', e => { if (e.key === 'Enter') addWord(); });

faBtn.addEventListener('click', () => {
  hideFa = !hideFa;
  if (!hideFa) revealedFa.clear();
  render(); playBeep(hideFa ? 500 : 700, 0.06);
});
enBtn.addEventListener('click', () => {
  hideEn = !hideEn;
  if (!hideEn) revealedEn.clear();
  render(); playBeep(hideEn ? 500 : 700, 0.06);
});
resetBtn.addEventListener('click', () => {
  hideEn = hideFa = false;
  revealedEn.clear(); revealedFa.clear();
  render(); playBeep(1000, 0.08);
});

/* تنظیمات */
function openDrawer()  { drawer.classList.add('open'); drawerOverlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeDrawer() { drawer.classList.remove('open'); drawerOverlay.classList.remove('open'); document.body.style.overflow = ''; }
settingsBtn.addEventListener('click', openDrawer);
closeSettings.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

document.querySelectorAll('.theme-swatch').forEach(sw => {
  sw.addEventListener('click', () => {
    settings.theme = sw.dataset.themeValue;
    saveSettings(); applySettings(); playBeep(750, 0.06);
  });
});

document.querySelectorAll('.segmented').forEach(seg => {
  const key = seg.dataset.setting;
  seg.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      settings[key] = btn.dataset.value;
      saveSettings(); applySettings(); playBeep(650, 0.06);
    });
  });
});

clearAllBtn.addEventListener('click', async () => {
  if (!confirm('همه کلمه‌ها حذف شوند؟ این عمل قابل بازگشت نیست.')) return;
  await clearAllWords(); closeDrawer();
});

/* ====== شروع ====== */
loadSettings();
fetchWords();
