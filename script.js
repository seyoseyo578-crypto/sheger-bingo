/* =============================================
   Sheger Bingo — script.js
   Telegram Mini App
   ============================================= */

/* ---------- Telegram Web App Init ---------- */
const tg = window.Telegram && window.Telegram.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#1e1b4b');
  tg.setBackgroundColor('#0f0d1a');
}

/* ---------- Constants ---------- */
const TOTAL_CARDS        = 250;
const ADMIN_CARDS        = [48, 68];
const REGISTRATION_SECS  = 60;
const CALL_INTERVAL_MS   = 4000;

const COLUMN_RANGES = [
  { letter: 'B', min: 1,  max: 15,  cls: 'bingo-b' },
  { letter: 'I', min: 16, max: 30,  cls: 'bingo-i' },
  { letter: 'N', min: 31, max: 45,  cls: 'bingo-n' },
  { letter: 'G', min: 46, max: 60,  cls: 'bingo-g' },
  { letter: 'O', min: 61, max: 75,  cls: 'bingo-o' },
];

/* ---------- State ---------- */
let gamePhase        = 'registration'; // registration | playing | ended
let selectedCard     = null;
let registeredCards  = new Set();
let calledNumbers    = [];
let regTimer         = null;
let callTimer        = null;
let regSecsLeft      = REGISTRATION_SECS;
let betPerCartela    = loadLS('sheger_bet', 10);
let walletBalance    = loadLS('sheger_wallet', 0);
let currentLeaderTab = 'daily';

/* ---------- LocalStorage helpers ---------- */
function loadLS(key, def) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : def; }
  catch { return def; }
}
function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

/* ---------- Mulberry32 seeded RNG ---------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickUnique(rng, min, max, count) {
  const pool = [];
  for (let n = min; n <= max; n++) pool.push(n);
  const result = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

const cardCache = {};
function getCardLayout(cardNumber) {
  if (cardCache[cardNumber]) return cardCache[cardNumber];
  const rng = mulberry32(cardNumber * 9973 + 17);
  const cols = [];
  for (let c = 0; c < 5; c++) {
    const r = COLUMN_RANGES[c];
    if (c === 2) { // N column gets FREE in middle
      const nums = pickUnique(rng, r.min, r.max, 4);
      nums.splice(2, 0, 'FREE');
      cols.push(nums);
    } else {
      cols.push(pickUnique(rng, r.min, r.max, 5));
    }
  }
  cardCache[cardNumber] = cols;
  return cols;
}

/* ---------- Ball color by number ---------- */
function ballClass(num) {
  if (num <= 15) return 'bingo-b';
  if (num <= 30) return 'bingo-i';
  if (num <= 45) return 'bingo-n';
  if (num <= 60) return 'bingo-g';
  return 'bingo-o';
}

/* ---------- DOM helpers ---------- */
const $ = id => document.getElementById(id);

/* ============================================================
   NAVIGATION
   ============================================================ */
const screens = ['welcome', 'menu', 'game', 'settings'];

function navigate(screen) {
  screens.forEach(s => {
    $(`screen-${s}`).classList.remove('active');
    const nb = $(`nav-${s}`);
    if (nb) nb.classList.remove('active');
  });
  $(`screen-${screen}`).classList.add('active');
  const nb = $(`nav-${screen}`);
  if (nb) nb.classList.add('active');

  if (screen === 'welcome') refreshWelcome();
  if (screen === 'menu')    renderMenu();
  if (screen === 'game')    refreshGameUI();
  if (screen === 'settings') refreshSettings();
}

/* ============================================================
   WELCOME
   ============================================================ */
function refreshWelcome() {
  $('walletDisplay').textContent   = `${walletBalance} ብር`;
  $('welcomeBetDisplay').textContent = `${betPerCartela} ብር`;
}

/* ============================================================
   GAME PHASE ENGINE
   ============================================================ */
function startRegistrationPhase() {
  gamePhase      = 'registration';
  regSecsLeft    = REGISTRATION_SECS;
  calledNumbers  = [];
  registeredCards.clear();
  selectedCard   = null;

  clearInterval(regTimer);
  clearInterval(callTimer);

  refreshGameUI();
  updateCountdown();

  regTimer = setInterval(() => {
    regSecsLeft--;
    updateCountdown();
    if (regSecsLeft <= 0) {
      clearInterval(regTimer);
      startPlayingPhase();
    }
  }, 1000);
}

function startPlayingPhase() {
  gamePhase = 'playing';
  updateStatusBadge();
  $('countdownBar').style.display = 'none';
  enableBingoBtn();

  // Shuffle pool 1-75
  const pool = Array.from({ length: 75 }, (_, i) => i + 1)
    .sort(() => Math.random() - 0.5);
  let poolIdx = 0;

  callTimer = setInterval(() => {
    if (poolIdx >= 75) { endRound(false); return; }
    const num = pool[poolIdx++];
    calledNumbers.push(num);
    animateCall(num);
    markCardCell(num);
    appendCalledBall(num);
  }, CALL_INTERVAL_MS);
}

function endRound(hasWinner) {
  gamePhase = 'ended';
  clearInterval(callTimer);
  updateStatusBadge();

  if (hasWinner && selectedCard) {
    const total  = registeredCards.size * betPerCartela;
    const prize  = Math.floor(total * 0.75);
    const admin  = Math.floor(total * 0.25);
    walletBalance += prize;
    saveLS('sheger_wallet', walletBalance);
    showWinnerModal(selectedCard, prize, admin);
  }

  setTimeout(startRegistrationPhase, hasWinner ? 6000 : 3000);
}

/* ---------- Prize auto-calculation ---------- */
function calcPrize() {
  const total   = registeredCards.size * betPerCartela;
  const winner  = Math.floor(total * 0.75);
  return { total, winner, admin: Math.floor(total * 0.25) };
}

function refreshPrizeDisplay() {
  const { winner } = calcPrize();
  $('prizeDisplay').textContent = `${winner} ብር`;
}

/* ============================================================
   GAME UI
   ============================================================ */
function refreshGameUI() {
  buildMachineGrid();
  renderCartelaGrid();
  updateStatusBadge();
  refreshPrizeDisplay();
  updateRegisterBtn();
  enableBingoBtn();

  $('countdownBar').style.display = gamePhase === 'registration' ? 'flex' : 'none';

  // Re-apply called numbers
  calledNumbers.forEach(n => {
    const mc = document.querySelector(`.machine-cell[data-num="${n}"]`);
    if (mc) mc.classList.add('called', ballClass(n));
  });
  const cb = $('calledBalls');
  cb.innerHTML = '';
  calledNumbers.forEach(n => appendCalledBall(n));
  if (calledNumbers.length > 0) animateCall(calledNumbers[calledNumbers.length - 1]);
}

function updateStatusBadge() {
  const el = $('roundStatus');
  if (gamePhase === 'registration') { el.textContent = 'ምዝገባ ክፍት'; el.className = 'status-badge'; }
  else if (gamePhase === 'playing') { el.textContent = 'ጨዋታ ቀጥሏል'; el.className = 'status-badge playing'; }
  else { el.textContent = 'ዙር አልቋል'; el.className = 'status-badge ended'; }
}

function updateCountdown() {
  const m = Math.floor(regSecsLeft / 60).toString().padStart(2, '0');
  const s = (regSecsLeft % 60).toString().padStart(2, '0');
  $('countdownText').textContent = `${m}:${s}`;
}

/* ---------- Bingo machine grid (1-75) ---------- */
function buildMachineGrid() {
  const grid = $('machineGrid');
  if (grid.children.length > 0) return; // already built
  // B=1-15, I=16-30, N=31-45, G=46-60, O=61-75 arranged as 5 rows x 15 cols
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const num = COLUMN_RANGES[col].min + row;
      const cell = document.createElement('div');
      cell.className = 'machine-cell';
      cell.dataset.num = num;
      cell.textContent = num;
      grid.appendChild(cell);
    }
  }
  // Actually render 5 rows per column = 75 cells arranged in 15-wide grid
  // Re-do: 5 columns × 15 numbers = 75, show as 15 columns × 5 rows
  grid.innerHTML = '';
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      for (let offset = 0; offset < 3; offset++) {
        const num = COLUMN_RANGES[col].min + (row * 3) + offset;
        if (num > COLUMN_RANGES[col].max) continue;
        const cell = document.createElement('div');
        cell.className = 'machine-cell';
        cell.dataset.num = num;
        cell.textContent = num;
        grid.appendChild(cell);
      }
    }
  }
}

function animateCall(num) {
  const ball = $('currentCallBall');
  ball.textContent = num;
  ball.className   = `call-ball ${ballClass(num)} pop`;
  setTimeout(() => ball.classList.remove('pop'), 300);

  const mc = document.querySelector(`.machine-cell[data-num="${num}"]`);
  if (mc) mc.classList.add('called', ballClass(num));
}

function appendCalledBall(num) {
  const el = document.createElement('div');
  el.className = `small-ball ${ballClass(num)}`;
  el.textContent = num;
  $('calledBalls').appendChild(el);
}

/* ---------- Player cartela ---------- */
function renderCartelaGrid() {
  const grid = $('cartelaGrid');
  grid.innerHTML = '';

  if (!selectedCard) {
    $('cartelaTitle').textContent = 'ካርቴላ አልተመረጠም';
    return;
  }

  $('cartelaTitle').textContent = `ካርቴላ #${selectedCard}`;
  const cols = getCardLayout(selectedCard);

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const val  = cols[col][row];
      const cell = document.createElement('div');
      if (val === 'FREE') {
        cell.className   = 'card-cell free';
        cell.textContent = 'FREE';
      } else {
        cell.className   = 'card-cell' + (calledNumbers.includes(val) ? ' marked' : '');
        cell.textContent = val;
        cell.dataset.num = val;
      }
      grid.appendChild(cell);
    }
  }
}

function markCardCell(num) {
  const cell = document.querySelector(`#cartelaGrid .card-cell[data-num="${num}"]`);
  if (cell) cell.classList.add('marked');
}

function updateRegisterBtn() {
  const btn = $('registerBtn');
  if (!selectedCard) { btn.disabled = true; btn.textContent = 'አመዝግብ'; btn.classList.remove('registered'); return; }
  if (gamePhase !== 'registration') { btn.disabled = true; return; }
  if (registeredCards.has(selectedCard)) {
    btn.disabled = true; btn.textContent = 'ተመዝግቧል ✅'; btn.classList.add('registered');
  } else {
    btn.disabled = false; btn.textContent = 'አመዝግብ'; btn.classList.remove('registered');
  }
}

function enableBingoBtn() {
  const btn = $('bingoBtn');
  btn.disabled = !(gamePhase === 'playing' && selectedCard && registeredCards.has(selectedCard));
}

/* ---------- Register action ---------- */
function registerCartela() {
  if (!selectedCard)              return showTgAlert('መጀመሪያ ካርቴላ ይምረጡ።');
  if (gamePhase !== 'registration') return showTgAlert('ምዝገባ ዝግ ነው።');
  if (registeredCards.has(selectedCard)) return;

  registeredCards.add(selectedCard);
  refreshPrizeDisplay();
  updateRegisterBtn();
}

/* ---------- BINGO check ---------- */
function claimBingo() {
  if (gamePhase !== 'playing')                    return showTgAlert('ጨዋታው አልተጀመረም።');
  if (!selectedCard || !registeredCards.has(selectedCard)) return showTgAlert('ካርቴላዎን አስቀድመው ያስመዝግቡ።');

  const cols   = getCardLayout(selectedCard);
  const called = new Set(calledNumbers);
  called.add('FREE');

  const isMarked = (c, r) => {
    const v = cols[c][r];
    return v === 'FREE' || called.has(v);
  };

  let won = false;
  // Rows
  for (let r = 0; r < 5 && !won; r++) won = [0,1,2,3,4].every(c => isMarked(c, r));
  // Cols
  for (let c = 0; c < 5 && !won; c++) won = [0,1,2,3,4].every(r => isMarked(c, r));
  // Diagonals
  if (!won) won = [0,1,2,3,4].every(i => isMarked(i, i));
  if (!won) won = [0,1,2,3,4].every(i => isMarked(i, 4-i));

  if (won) {
    endRound(true);
  } else {
    showTgAlert('ገና BINGO አልሞላም። ተጨማሪ ቁጥሮች ይጠብቁ።');
  }
}

/* ============================================================
   CARTELA PICKER MODAL
   ============================================================ */
function openCartelaModal() {
  const grid = $('cartelaPickerGrid');
  grid.innerHTML = '';

  for (let i = 1; i <= TOTAL_CARDS; i++) {
    const cell  = document.createElement('div');
    const isAdmin = ADMIN_CARDS.includes(i);
    const isTaken = registeredCards.has(i) && i !== selectedCard;
    const isSelected = i === selectedCard;
    const locked = gamePhase !== 'registration';

    cell.className = 'picker-cell' +
      (isAdmin    ? ' admin-card' : '') +
      (isSelected ? ' selected'   : '') +
      (isTaken || locked ? ' taken' : '');
    cell.textContent = isAdmin ? `⭐${i}` : i;

    if (!isTaken && !locked && !isAdmin) {
      cell.onclick = () => { selectCard(i); closeCartelaModal(); };
    } else if (isAdmin) {
      cell.onclick = () => showTgAlert(`ካርቴላ ${i} ለAdmin የተያዘ ነው።`);
    } else if (locked) {
      cell.onclick = () => showTgAlert('ጨዋታ ተጀምሯል። ቀጣይ ዙር ይጠብቁ።');
    } else {
      cell.onclick = () => showTgAlert(`ካርቴላ ${i} ተይዟል። ሌላ ይምረጡ።`);
    }
    grid.appendChild(cell);
  }

  $('cartelaModal').classList.remove('hidden');
}

function closeCartelaModal(e) {
  if (!e || e.target === $('cartelaModal')) {
    $('cartelaModal').classList.add('hidden');
  }
}

function selectCard(num) {
  selectedCard = num;
  renderCartelaGrid();
  updateRegisterBtn();
  enableBingoBtn();
}

/* ============================================================
   WINNER MODAL
   ============================================================ */
function showWinnerModal(cardNum, prize, adminCut) {
  const total = registeredCards.size * betPerCartela;
  $('winnerTitle').textContent = '🏆 BINGO!';
  $('winnerPrizeDisplay').textContent = `+${prize} ብር`;
  $('winnerNote').textContent =
    `ካርቴላ #${cardNum} | ጠቅላላ: ${total} ብር | ለNET ተቆራጭ: ${adminCut} ብር`;
  $('winnerModal').classList.remove('hidden');
}

function closeWinnerModal() {
  $('winnerModal').classList.add('hidden');
  refreshWelcome();
}

/* ============================================================
   MENU SCREEN
   ============================================================ */
const BET_OPTIONS = [
  { bet: 10,  status: '26s' },
  { bet: 20,  status: 'waiting' },
  { bet: 50,  status: 'waiting' },
  { bet: 80,  status: 'waiting' },
  { bet: 100, status: 'waiting' },
  { bet: 150, status: 'waiting' },
];

const LEADERBOARD = {
  daily: [
    { name: 'Sami',     phone: '2519****287', wins: 12, earned: 900 },
    { name: 'Tigist',   phone: '2519****403', wins: 9,  earned: 675 },
    { name: 'Enoch',    phone: '2519****737', wins: 8,  earned: 600 },
    { name: 'Selam',    phone: '2519****142', wins: 6,  earned: 450 },
    { name: 'Habtamu',  phone: '2519****282', wins: 5,  earned: 375 },
  ],
  weekly: [
    { name: 'Sami',     phone: '2519****287', wins: 77, earned: 4000 },
    { name: 'Getabalew',phone: '2519****282', wins: 75, earned: 3300 },
    { name: 'Enoch',    phone: '2519****737', wins: 73, earned: 2800 },
    { name: 'Selam',    phone: '2519****403', wins: 53, earned: 2300 },
    { name: 'Habtamu',  phone: '2519****142', wins: 46, earned: 1900 },
  ],
  monthly: [
    { name: 'Getabalew',phone: '2519****282', wins: 310, earned: 23200 },
    { name: 'Sami',     phone: '2519****287', wins: 298, earned: 22350 },
    { name: 'Tigist',   phone: '2519****403', wins: 241, earned: 18075 },
    { name: 'Enoch',    phone: '2519****737', wins: 199, earned: 14925 },
    { name: 'Selam',    phone: '2519****142', wins: 175, earned: 13125 },
  ],
};

const RANKS = ['🥇', '🥈', '🥉', '4', '5'];

function renderMenu() {
  // Games list
  const gl = $('gamesList');
  gl.innerHTML = '';
  BET_OPTIONS.forEach(({ bet, status }) => {
    const possibleWin = Math.floor(bet * 20 * 0.75);
    const div = document.createElement('div');
    div.className = 'game-list-item';
    div.innerHTML = `
      <div>
        <div class="game-bet">${bet} ብር</div>
        <div class="game-win">ሊያሸንፉ: ${possibleWin}+ ብር</div>
        <div class="game-status">${status === '26s' ? '⏱ 26ሰ' : '⌛ ምዝገባ'}</div>
      </div>
      <button class="game-join-btn" onclick="joinGame(${bet})">ይቀላቀሉ</button>
    `;
    gl.appendChild(div);
  });

  renderLeaderboard(currentLeaderTab);
}

function switchTab(tab, el) {
  currentLeaderTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderLeaderboard(tab);
}

function renderLeaderboard(tab) {
  const list = $('leaderboardList');
  list.innerHTML = '';
  (LEADERBOARD[tab] || []).forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'lb-item';
    div.innerHTML = `
      <div class="lb-rank">${RANKS[i]}</div>
      <div class="lb-avatar">${p.name[0]}</div>
      <div>
        <div class="lb-name">${p.name}</div>
        <div class="lb-phone">${p.phone}</div>
      </div>
      <div class="lb-stats">
        <div class="lb-wins">${p.wins} wins</div>
        <div class="lb-earning">${p.earned.toLocaleString()} ETB</div>
      </div>
    `;
    list.appendChild(div);
  });
}

function joinGame(bet) {
  betPerCartela = bet;
  saveLS('sheger_bet', bet);
  startRegistrationPhase();
  navigate('game');
}

/* ============================================================
   SETTINGS SCREEN
   ============================================================ */
function refreshSettings() {
  $('settingsWalletDisplay').textContent = `${walletBalance} ብር`;
  $('betInput').value = betPerCartela;
}

function saveBet() {
  const val = parseInt($('betInput').value, 10);
  if (!val || val < 1) return showTgAlert('ትክክለኛ ዋጋ ያስገቡ።');
  betPerCartela = val;
  saveLS('sheger_bet', betPerCartela);
  showTgAlert(`ዋጋ ወደ ${betPerCartela} ብር ተቀይሯል!`);
}

function toggleDark(checkbox) {
  document.body.classList.toggle('light', !checkbox.checked);
  saveLS('sheger_dark', checkbox.checked);
}

function copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => showTgAlert(`${text} ተቀድሷል! ✅`))
      .catch(() => showTgAlert(text));
  } else {
    showTgAlert(text);
  }
}

/* ============================================================
   DEPOSIT VERIFICATION FLOW
   ============================================================ */
function submitDeposit() {
  const amount = parseInt($('depositAmount').value, 10);
  const method = $('depositMethod').value;
  const ref    = $('depositRef').value.trim().toUpperCase();

  if (!amount || amount < 1) return showTgAlert('እባክዎ መጠን ያስገቡ።');
  if (!ref || ref.length < 4) return showTgAlert('Transaction ID ያስገቡ (ምሳሌ: CE535PPHGP).');

  const methodLabel = method === 'telebirr' ? 'Telebirr (+251964796846)' : 'ንግድ ባንክ (1000615139126)';

  // Show confirmation modal
  $('confirmDetail').innerHTML = `
    <strong>መጠን:</strong> ${amount} ብር<br>
    <strong>መንገድ:</strong> ${methodLabel}<br>
    <strong>Transaction ID:</strong> <span style="color:#fbbf24;font-family:monospace">${ref}</span><br>
    <strong>ሁናቴ:</strong> ቁጥር ምርምር ላይ…
  `;
  $('depositModal').classList.remove('hidden');

  // Send data to Telegram bot if available
  if (tg && tg.sendData) {
    tg.sendData(JSON.stringify({
      type:   'deposit_request',
      amount: amount,
      method: method,
      ref:    ref,
      user:   tg.initDataUnsafe?.user?.id || 'unknown'
    }));
  }

  // Clear form
  $('depositAmount').value = '';
  $('depositRef').value    = '';
}

function closeDepositModal() {
  $('depositModal').classList.add('hidden');
}

/* ============================================================
   WITHDRAW
   ============================================================ */
function submitWithdraw() {
  const amount  = parseInt($('withdrawAmount').value, 10);
  const method  = $('withdrawMethod').value;
  const account = $('withdrawAccount').value.trim();

  if (!amount || amount < 200) return showTgAlert('ዝቅተኛ Withdraw 200 ብር ነው።');
  if (!account)                 return showTgAlert('አካውንት ቁጥር ያስገቡ።');
  if (amount > walletBalance)   return showTgAlert(`ቀሪ ሒሳብዎ ${walletBalance} ብር ብቻ ነው።`);

  walletBalance -= amount;
  saveLS('sheger_wallet', walletBalance);
  $('settingsWalletDisplay').textContent = `${walletBalance} ብር`;

  if (tg && tg.sendData) {
    tg.sendData(JSON.stringify({
      type:    'withdraw_request',
      amount:  amount,
      method:  method,
      account: account,
      user:    tg.initDataUnsafe?.user?.id || 'unknown'
    }));
  }

  $('withdrawAmount').value  = '';
  $('withdrawAccount').value = '';
  showTgAlert(`Withdraw ጥያቄ (${amount} ብር) ተልኳል! ✅\nAdmin ያረጋግጡና ${method === 'telebirr' ? 'Telebirr' : 'CBE'} ቁጥርዎ ላይ ይደርስዎታል።`);
}

/* ============================================================
   UTILITY
   ============================================================ */
function showTgAlert(msg) {
  if (tg && tg.showAlert) {
    tg.showAlert(msg);
  } else {
    alert(msg);
  }
}

/* ============================================================
   BOOT
   ============================================================ */
window.addEventListener('DOMContentLoaded', () => {
  // Restore dark mode preference
  const isDark = loadLS('sheger_dark', true);
  document.body.classList.toggle('light', !isDark);
  const toggle = $('darkToggle');
  if (toggle) toggle.checked = isDark;

  // Build machine grid on game screen
  buildMachineGrid();

  // Start the first registration phase
  startRegistrationPhase();

  // Render initial welcome
  refreshWelcome();

  // Listen for Telegram back button
  if (tg) {
    tg.BackButton.onClick(() => navigate('welcome'));
  }
});
