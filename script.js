/* =======================================================
   Sheger Bingo — script.js
   Production-shaped frontend: persistent wallet (localStorage),
   pending-approval deposit/withdraw, Admin panel, Telegram
   WebApp user identification, verified-win receipts,
   multi-card play, live per-stake jackpots.

   NOTE ON "REAL MONEY" — read this before going live:
   This file makes the app behave like a real product (data
   persists, deposits/withdraws need Admin approval, wins are
   checked against the actual called numbers). But because it
   runs entirely in the player's browser, a determined user
   could edit this code on their own device. For real-money
   operation you should NOT trust the client for final balance
   or win decisions — put the wallet ledger, round state and
   win verification on a server you control (see the ADMIN /
   apiRequest() notes below for where that plugs in), and only
   use this file for the UI.
   ======================================================= */

/* ---------- Config ---------- */
const TOTAL_CARDS    = 250;
const ADMIN_CARDS    = [48, 68];
const STAKES         = [10, 20, 30, 50, 80, 100, 150];
const WINNER_SHARE   = 0.75;   // ለአሸናፊ 75%
const ADMIN_SHARE    = 0.25;   // ለAdmin (ተቆራጭ) 25%
const ADMIN_PASSWORD = "sheger-admin"; // ⚠️ ከመጀመርዎ በፊት ይቀይሩት! (real ስሪት ላይ ወደ backend ይዛወራል)

const COLUMN_RANGES = {
  0: { letter: "B", min: 1,  max: 15 },
  1: { letter: "I", min: 16, max: 30 },
  2: { letter: "N", min: 31, max: 45 },
  3: { letter: "G", min: 46, max: 60 },
  4: { letter: "O", min: 61, max: 75 },
};

/* =======================================================
   Player identity — use the real Telegram user when this
   runs inside Telegram, otherwise a local guest profile.
   ======================================================= */
let tgUser = null;
if (window.Telegram && window.Telegram.WebApp) {
  try {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
    tgUser = window.Telegram.WebApp.initDataUnsafe?.user || null;
  } catch (e) { /* not inside Telegram */ }
}
const USER_ID   = tgUser ? String(tgUser.id) : "guest";
const STORE_KEY = "shegerBingo_" + USER_ID;

/* =======================================================
   Persistent state (localStorage stands in for a backend
   database until this is wired to a real server)
   ======================================================= */
let state = loadState();

function defaultState() {
  return {
    balance: 0,
    gamesPlayed: 0,
    totalWinnings: 0,
    isAdmin: false,
    adminEarnings: 0,
    transactions: [],  // {id, type:'deposit'|'withdraw', amount, proof/account, status:'pending'|'approved'|'rejected', time}
    gameHistory: [],   // {id, stake, card, pattern, payout, time}
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? Object.assign(defaultState(), JSON.parse(raw)) : defaultState();
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) { /* storage unavailable */ }
}

/* Convenience accessors kept short for the rest of the file */
Object.defineProperty(window, "balance", {
  get() { return state.balance; },
  set(v) { state.balance = v; saveState(); },
});

let currentRoomStake = null;
const cardCache = {};

/* ---------- Rooms (one per stake) ---------- */
const rooms = {};
STAKES.forEach((stake) => {
  rooms[stake] = {
    stake,
    state: "registration",
    secondsLeft: randInt(15, 60),
    registeredCount: randInt(3, 45), // simulated pool of other players' cards
    calledNumbers: [],
    cards: [], // this player's cards in this room: [{number}]
  };
});

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* =======================================================
   Seeded card layout generator (same card # = same layout)
   ======================================================= */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
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
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return result;
}

function getCardLayout(cardNumber) {
  if (cardCache[cardNumber]) return cardCache[cardNumber];
  const rng = mulberry32(cardNumber * 9973 + 17);
  const columns = [];
  for (let c = 0; c < 5; c++) {
    const range = COLUMN_RANGES[c];
    if (c === 2) {
      const nums = pickUnique(rng, range.min, range.max, 4);
      nums.splice(2, 0, "FREE");
      columns.push(nums);
    } else {
      columns.push(pickUnique(rng, range.min, range.max, 5));
    }
  }
  cardCache[cardNumber] = columns;
  return columns;
}

function ballClass(num) {
  if (num <= 15) return "ball-b";
  if (num <= 30) return "ball-i";
  if (num <= 45) return "ball-n";
  if (num <= 60) return "ball-g";
  return "ball-o";
}
function colLetterOf(col) { return COLUMN_RANGES[col].letter.toLowerCase(); }

const $ = (id) => document.getElementById(id);

/* =======================================================
   Bottom nav tabs (Scores / History / Play / Wallet / Profile
   / Admin — Admin has no bottom-nav icon, opened via ☰ menu)
   ======================================================= */
function switchTab(tab) {
  ["scores", "history", "play", "wallet", "profile", "admin"].forEach((t) => {
    $("tab-" + t).classList.toggle("hidden", t !== tab);
    const nav = $("navbtn-" + t);
    if (nav) nav.classList.toggle("active", t === tab);
  });
  $("topMenuPanel").classList.add("hidden");
  if (tab === "history") renderHistory();
  if (tab === "admin") renderAdminPanel();
}

function toggleTopMenu() {
  $("topMenuPanel").classList.toggle("hidden");
}

function darkMode() {
  document.body.classList.toggle("dark");
}

/* ---------- Modals ---------- */
function openModal(id) {
  $("topMenuPanel").classList.add("hidden");
  $(id).classList.remove("hidden");
}
function closeModal(id) {
  $(id).classList.add("hidden");
}

/* =======================================================
   Admin login / logout
   ======================================================= */
function adminLogin() {
  $("topMenuPanel").classList.add("hidden");
  const pass = prompt("የAdmin የይለፍ ቃል ያስገቡ:");
  if (pass === null) return;
  if (pass === ADMIN_PASSWORD) {
    state.isAdmin = true;
    saveState();
    updateAdminMenuVisibility();
    alert("✅ እንደ Admin ገብተዋል።");
    switchTab("admin");
  } else {
    alert("❌ የተሳሳተ የይለፍ ቃል።");
  }
}

function adminLogout() {
  state.isAdmin = false;
  saveState();
  updateAdminMenuVisibility();
  switchTab("play");
}

function updateAdminMenuVisibility() {
  $("adminLoginBtn").classList.toggle("hidden", state.isAdmin);
  $("adminPanelBtn").classList.toggle("hidden", !state.isAdmin);
}

/* =======================================================
   Stakes list (Play tab, room-selection screen)
   ======================================================= */
function possibleWin(room) {
  return Math.round(room.registeredCount * room.stake * WINNER_SHARE);
}

function renderStakesList() {
  const list = $("stakesList");
  list.innerHTML = "";

  STAKES.forEach((stake) => {
    const room = rooms[stake];
    const row = document.createElement("div");
    row.className = "stake-row" + (room.state === "playing" ? " is-playing" : "");

    const win = possibleWin(room);
    const cap = stake * 50;
    const fillPct = Math.min(100, Math.round((win / cap) * 100));

    const statusHtml =
      room.state === "registration"
        ? '<span class="status-pill">' + formatTime(room.secondsLeft) + "</span>"
        : '<span class="status-pill playing">Playing</span>';

    row.innerHTML =
      '<div class="stake-top">' +
        '<div class="stake-amount">' + stake + " ETB</div>" +
        '<div class="stake-win">Possible Win<br><b>' + win + " ETB</b></div>" +
        statusHtml +
        '<button class="join-btn">Join</button>' +
      "</div>" +
      '<div class="jackpot-bar"><div class="jackpot-fill" style="width:' + fillPct + '%"></div>' +
      '<span class="jackpot-label">JACKPOT ' + win + " / " + cap + " ETB</span></div>";

    row.querySelector(".join-btn").onclick = () => joinRoom(stake);
    list.appendChild(row);
  });
}

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return m + ":" + s;
}

/* =======================================================
   Entering / leaving a room
   ======================================================= */
function joinRoom(stake) {
  currentRoomStake = stake;
  $("stakesView").classList.add("hidden");
  $("roomView").classList.remove("hidden");
  $("roomStakeLabel").textContent = stake + " ETB Room";
  $("cardsPanel").classList.add("hidden");
  renderRoomCards();
  renderCallBoard();
  renderRoomStatus();
}

function leaveRoom() {
  currentRoomStake = null;
  $("roomView").classList.add("hidden");
  $("stakesView").classList.remove("hidden");
  $("cardsPanel").classList.add("hidden");
}

/* =======================================================
   Card picker (+) — add a new card to the room
   ======================================================= */
function showCards() {
  const room = rooms[currentRoomStake];
  if (room.state !== "registration") {
    alert("ጨዋታው ተጀምሯል። ቀጣዩ ዙር እስኪጀምር ካርቴላ መጨመር አይቻልም።");
    return;
  }
  const panel = $("cardsPanel");
  panel.classList.toggle("hidden");
  if (!panel.classList.contains("hidden")) renderCardsList();
}

function renderCardsList() {
  const room = rooms[currentRoomStake];
  const takenByPlayer = room.cards.map((c) => c.number);
  const list = $("cardsList");
  list.innerHTML = "";

  for (let i = 1; i <= TOTAL_CARDS; i++) {
    const btn = document.createElement("button");
    const isAdmin = ADMIN_CARDS.includes(i);
    const already = takenByPlayer.includes(i);

    btn.className = "card-btn";
    if (isAdmin) btn.classList.add("admin-card");
    if (already) btn.classList.add("disabled-card");

    btn.innerHTML = isAdmin ? "⭐ " + i : i;

    btn.onclick = () => {
      if (isAdmin) {
        alert("ካርቴላ " + i + " ለAdmin የተያዘ ነው።");
        return;
      }
      if (already) {
        alert("ይህ ካርቴላ አስቀድመው ጨምረውታል።");
        return;
      }
      addCard(i);
    };
    list.appendChild(btn);
  }
}

function addCard(number) {
  const room = rooms[currentRoomStake];
  if (room.state !== "registration") {
    alert("ምዝገባ ዝግ ነው። ቀጣዩ ዙር ሲጀምር ይሞክሩ።");
    return;
  }
  if (state.balance < room.stake) {
    alert("በቂ ቀሪ ሂሳብ የለዎትም። እባክዎ Deposit ያድርጉ።");
    return;
  }

  window.balance -= room.stake;
  room.registeredCount += 1;
  room.cards.push({ number });

  updateBalanceUI();
  $("cardsPanel").classList.add("hidden");
  renderRoomCards();
}

function removeCard(number) {
  const room = rooms[currentRoomStake];
  if (room.state !== "registration") {
    alert("ጨዋታው ተጀምሯል። ካርቴላ ማስወገድ አይቻልም።");
    return;
  }
  const idx = room.cards.findIndex((c) => c.number === number);
  if (idx === -1) return;

  room.cards.splice(idx, 1);
  room.registeredCount -= 1;
  window.balance += room.stake;

  updateBalanceUI();
  renderRoomCards();
}

/* =======================================================
   Render the player's cards row (+ add tile / × remove)
   Column letters are colour-coded on the header AND on
   every number, matching classic bingo card styling.
   ======================================================= */
function renderRoomCards() {
  const room = rooms[currentRoomStake];
  const row = $("cardsRow");
  row.innerHTML = "";

  room.cards.forEach((c) => {
    row.appendChild(buildCardPanel(c.number, room));
  });

  const addTile = document.createElement("div");
  addTile.className = "card-add-tile";
  addTile.textContent = "+";
  addTile.onclick = showCards;
  row.appendChild(addTile);

  $("bingoClaimBtn").disabled = !(room.state === "playing" && room.cards.length > 0);
}

function buildCardPanel(cardNumber, room) {
  const panel = document.createElement("div");
  panel.className = "card-panel";

  const removeBtn = document.createElement("div");
  removeBtn.className = "card-remove-btn";
  removeBtn.textContent = "×";
  removeBtn.title = "ካርቴላ አስወግድ";
  removeBtn.onclick = () => removeCard(cardNumber);
  panel.appendChild(removeBtn);

  const title = document.createElement("div");
  title.className = "card-panel-title";
  title.textContent = "ካርቴላ " + cardNumber;
  panel.appendChild(title);

  const header = document.createElement("div");
  header.className = "bingo-header mini";
  ["B", "I", "N", "G", "O"].forEach((l) => {
    const h = document.createElement("div");
    h.className = "cell head-" + l.toLowerCase();
    h.textContent = l;
    header.appendChild(h);
  });
  panel.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "bingo-card mini";
  const columns = getCardLayout(cardNumber);
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const value = columns[c][r];
      const cell = document.createElement("div");
      if (value === "FREE") {
        cell.className = "cell free";
        cell.textContent = "FREE";
      } else {
        cell.className = "cell num-" + colLetterOf(c);
        cell.textContent = value;
        cell.dataset.number = value;
        if (room.calledNumbers.includes(value)) cell.classList.add("marked");
      }
      grid.appendChild(cell);
    }
  }
  panel.appendChild(grid);

  return panel;
}

/* =======================================================
   Big calling board — "Bingo Machine Table"
   Fixed grid (no horizontal scroll): one row per letter,
   all 15 numbers of that letter always visible at once.
   ======================================================= */
function buildCallBoardOnce() {
  const board = $("callBoard");
  board.innerHTML = "";
  Object.values(COLUMN_RANGES).forEach((range) => {
    const rowDiv = document.createElement("div");
    rowDiv.className = "call-row";

    const head = document.createElement("div");
    head.className = "call-head head-" + range.letter.toLowerCase();
    head.textContent = range.letter;
    rowDiv.appendChild(head);

    for (let n = range.min; n <= range.max; n++) {
      const cell = document.createElement("div");
      cell.className = "call-cell";
      cell.dataset.number = n;
      cell.textContent = n;
      rowDiv.appendChild(cell);
    }
    board.appendChild(rowDiv);
  });
}

function renderCallBoard() {
  const room = rooms[currentRoomStake];
  document.querySelectorAll("#callBoard .call-cell").forEach((cell) => {
    const num = Number(cell.dataset.number);
    cell.classList.toggle("called", room.calledNumbers.includes(num));
  });
}

/* =======================================================
   Round status / countdown for the open room
   ======================================================= */
function renderRoomStatus() {
  const room = rooms[currentRoomStake];
  const statusText =
    room.state === "registration"
      ? "🟢 ካርቴላ የመመዝገቢያ ጊዜ — " + formatTime(room.secondsLeft)
      : "🔴 ጨዋታ በመካሄድ ላይ";

  $("roundStatus").textContent = statusText;
  $("roomPossibleWin").textContent = possibleWin(room) + " ETB";

  const last = room.calledNumbers[room.calledNumbers.length - 1];
  const activeEl = $("activeNumber");
  activeEl.textContent = last || "-";
  activeEl.className = "circle " + (last ? ballClass(last) : "");

  $("bingoClaimBtn").disabled = !(room.state === "playing" && room.cards.length > 0);
}

/* =======================================================
   Game rule: WIN = any complete row / column / diagonal
   OR all four corner squares. Returns the pattern name
   (used in the winner receipt) or null.
   ======================================================= */
function checkCardPattern(cardNumber, calledNumbers) {
  const columns = getCardLayout(cardNumber);
  const marked = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const value = columns[c][r];
      marked.push(value === "FREE" || calledNumbers.includes(value));
    }
  }
  const idx = (r, c) => r * 5 + c;

  for (let r = 0; r < 5; r++) {
    if ([0, 1, 2, 3, 4].every((c) => marked[idx(r, c)])) return "Row " + (r + 1);
  }
  for (let c = 0; c < 5; c++) {
    if ([0, 1, 2, 3, 4].every((r) => marked[idx(r, c)])) return "Column " + ["B","I","N","G","O"][c];
  }
  if ([0, 1, 2, 3, 4].every((i) => marked[idx(i, i)])) return "Diagonal";
  if ([0, 1, 2, 3, 4].every((i) => marked[idx(i, 4 - i)])) return "Diagonal";
  if (marked[idx(0,0)] && marked[idx(0,4)] && marked[idx(4,0)] && marked[idx(4,4)]) return "Four Corners";

  return null;
}

/* =======================================================
   BINGO claim — validates against the room's actual called
   numbers, then shows a verified-winner receipt and logs
   it to Game History.
   ======================================================= */
function claimBingo() {
  const room = rooms[currentRoomStake];
  if (room.state !== "playing") {
    alert("ጨዋታው አልተጀመረም ወይም አልቋል።");
    return;
  }
  if (room.cards.length === 0) {
    alert("መጀመሪያ ካርቴላ ይጨምሩ።");
    return;
  }

  let winningCard = null, pattern = null;
  for (const c of room.cards) {
    const p = checkCardPattern(c.number, room.calledNumbers);
    if (p) { winningCard = c.number; pattern = p; break; }
  }

  if (winningCard) {
    const pot = room.registeredCount * room.stake;
    const win = Math.round(pot * WINNER_SHARE);
    const adminCut = Math.round(pot * ADMIN_SHARE);

    window.balance += win;
    state.gamesPlayed += 1;
    state.totalWinnings += win;
    state.adminEarnings += adminCut;

    const record = {
      id: Date.now(),
      stake: room.stake,
      card: winningCard,
      pattern,
      payout: win,
      time: new Date().toLocaleString("en-GB"),
    };
    state.gameHistory.unshift(record);
    saveState();

    updateBalanceUI();
    updateProfileStats();
    showWinReceipt(record);
    endPlaying(room);
  } else {
    alert("ገና BINGO አልሞላም። ተጨማሪ ቁጥሮች ይጠብቁ።");
  }
}

function showWinReceipt(record) {
  $("winReceiptBody").innerHTML =
    '<div class="list-row"><span>ካርቴላ</span><b>' + record.card + '</b></div>' +
    '<div class="list-row"><span>ንድፍ (Pattern)</span><b>' + record.pattern + '</b></div>' +
    '<div class="list-row"><span>ስቴክ</span><b>' + record.stake + ' ETB</b></div>' +
    '<div class="list-row"><span>ክፍያ</span><b>' + record.payout + ' ETB</b></div>' +
    '<div class="list-row"><span>ሰዓት</span><b>' + record.time + '</b></div>' +
    '<p class="muted">✅ ይህ ውጤት ከተጠሩት ቁጥሮች ጋር ተረጋግጦ ትክክለኛ ሆኖ ተገኝቷል።</p>';
  openModal("winModal");
}

/* =======================================================
   Room lifecycle — fully automatic, no start/stop buttons
   ======================================================= */
function beginPlaying(room) {
  room.state = "playing";
  room.secondsLeft = randInt(45, 90);
  room.calledNumbers = [];
  if (currentRoomStake === room.stake) {
    renderRoomCards();
    renderCallBoard();
    renderRoomStatus();
  }
}

function endPlaying(room) {
  room.state = "registration";
  room.secondsLeft = randInt(15, 60);
  room.registeredCount = randInt(3, 45);
  room.cards = [];
  room.calledNumbers = [];

  if (currentRoomStake === room.stake) {
    renderRoomCards();
    renderCallBoard();
    renderRoomStatus();
  }
}

function callNumberForRoom(room) {
  if (room.calledNumbers.length >= 75) return;
  let num;
  do {
    num = randInt(1, 75);
  } while (room.calledNumbers.includes(num));
  room.calledNumbers.push(num);

  if (currentRoomStake === room.stake) {
    document.querySelectorAll("#cardsRow .cell").forEach((cell) => {
      if (Number(cell.dataset.number) === num) cell.classList.add("marked");
    });
    renderCallBoard();
    renderRoomStatus();
  }
}

/* Global 1-second heartbeat driving every room */
function tickRooms() {
  STAKES.forEach((stake) => {
    const room = rooms[stake];
    if (room.state === "registration") {
      room.secondsLeft--;
      if (room.secondsLeft <= 0) beginPlaying(room);
    } else if (room.state === "playing") {
      room.secondsLeft--;
      if (currentRoomStake === stake && room.secondsLeft % 4 === 0) {
        callNumberForRoom(room);
      }
      if (room.secondsLeft <= 0 || room.calledNumbers.length >= 75) {
        endPlaying(room);
      }
    }
  });

  renderStakesList();
  if (currentRoomStake) renderRoomStatus();
}

/* =======================================================
   Wallet — balance, deposit / withdraw (pending → Admin
   approval, mirroring a real payment-verification flow)
   ======================================================= */
function updateBalanceUI() {
  $("balanceTop").textContent = state.balance + " ETB";
  $("profileBalance").textContent = "ETB " + state.balance;
}

function updateProfileStats() {
  $("statGames").textContent = state.gamesPlayed;
  $("statWinnings").textContent = "ETB " + state.totalWinnings;
  $("profileWinningsMini").textContent = "ETB " + state.totalWinnings;
}

function sendDeposit() {
  const amount = Number($("depositAmount").value);
  const proof = $("depositProof").value.trim();

  if (!amount || amount <= 0 || !proof) {
    alert("ሁሉንም መረጃ ይሙሉ (መጠን እና የክፍያ ማረጋገጫ)።");
    return;
  }

  state.transactions.unshift({
    id: Date.now(),
    type: "deposit",
    amount,
    proof,
    status: "pending",
    time: new Date().toLocaleString("en-GB"),
  });
  saveState();

  alert("🕐 Deposit ጥያቄ ተልኳል። Admin ካረጋገጠ በኋላ ባላንስዎ ላይ ይታከላል።");
  $("depositAmount").value = "";
  $("depositProof").value = "";
  closeModal("depositModal");
  renderHistory();
}

function sendWithdraw() {
  const amount = Number($("withdrawAmount").value);
  const account = $("withdrawAccount").value.trim();

  if (!amount || amount < 200) {
    alert("ከ200 ብር በታች Withdraw ማድረግ አይቻልም።");
    return;
  }
  if (!account) {
    alert("የክፍያ አካውንት መረጃ ይሙሉ።");
    return;
  }
  if (amount > state.balance) {
    alert("በቂ ቀሪ ሂሳብ የለዎትም።");
    return;
  }

  // መጠኑ ወዲያውኑ ይያዛል (reserved) ስለዚህ ሁለት ጊዜ መጠቀም አይቻልም
  window.balance -= amount;
  state.transactions.unshift({
    id: Date.now(),
    type: "withdraw",
    amount,
    account,
    status: "pending",
    time: new Date().toLocaleString("en-GB"),
  });
  saveState();
  updateBalanceUI();

  alert("🕐 Withdraw ጥያቄ ተልኳል። Admin ካረጋገጠ በኋላ ይላካል።");
  $("withdrawAmount").value = "";
  $("withdrawAccount").value = "";
  closeModal("withdrawModal");
  renderHistory();
}

/* =======================================================
   History tab — real transaction + game-win records
   ======================================================= */
function renderHistory() {
  const gEl = $("gameHistoryList");
  if (state.gameHistory.length === 0) {
    gEl.innerHTML = '<p class="muted">እስካሁን ምንም ጨዋታ አልተጫወቱም።</p>';
  } else {
    gEl.innerHTML = state.gameHistory.slice(0, 20).map((r) =>
      '<div class="list-row"><span>🦁 ካርቴላ ' + r.card + ' — ' + r.pattern + '<br><span class="muted">' + r.time + '</span></span><b>+' + r.payout + ' ETB</b></div>'
    ).join("");
  }

  const tEl = $("txnHistoryList");
  if (state.transactions.length === 0) {
    tEl.innerHTML = '<p class="muted">እስካሁን ምንም እንቅስቃሴ የለም።</p>';
  } else {
    tEl.innerHTML = state.transactions.slice(0, 20).map((t) => {
      const label = t.type === "deposit" ? "💰 Deposit" : "💸 Withdraw";
      const pillClass = t.status === "pending" ? "status-pill" : t.status === "approved" ? "status-pill playing" : "status-pill";
      const pillColor = t.status === "rejected" ? "background:#b5361c;color:#fff;" : "";
      return '<div class="list-row"><span>' + label + ' — ' + t.amount + ' ETB<br><span class="muted">' + t.time + '</span></span><span class="' + pillClass + '" style="' + pillColor + '">' + t.status + '</span></div>';
    }).join("");
  }
}

/* =======================================================
   Admin panel — approve/reject deposits & withdrawals,
   view accumulated 25% earnings.
   In a real deployment these actions should call your
   backend (e.g. apiRequest('/admin/approve-deposit', {id}))
   instead of editing localStorage directly.
   ======================================================= */
function renderAdminPanel() {
  $("adminEarnings").textContent = state.adminEarnings + " ETB";

  const deposits = state.transactions.filter((t) => t.type === "deposit" && t.status === "pending");
  const withdraws = state.transactions.filter((t) => t.type === "withdraw" && t.status === "pending");

  const dEl = $("pendingDepositsList");
  dEl.innerHTML = deposits.length === 0
    ? '<p class="muted">የለም።</p>'
    : deposits.map((t) =>
        '<div class="list-row"><span>' + t.amount + ' ETB<br><span class="muted">Proof: ' + t.proof + '</span></span>' +
        '<span><button onclick="approveTxn(' + t.id + ')">✅</button> <button onclick="rejectTxn(' + t.id + ')">❌</button></span></div>'
      ).join("");

  const wEl = $("pendingWithdrawsList");
  wEl.innerHTML = withdraws.length === 0
    ? '<p class="muted">የለም።</p>'
    : withdraws.map((t) =>
        '<div class="list-row"><span>' + t.amount + ' ETB<br><span class="muted">Account: ' + t.account + '</span></span>' +
        '<span><button onclick="approveTxn(' + t.id + ')">✅</button> <button onclick="rejectTxn(' + t.id + ')">❌</button></span></div>'
      ).join("");
}

function approveTxn(id) {
  const t = state.transactions.find((x) => x.id === id);
  if (!t) return;
  t.status = "approved";
  if (t.type === "deposit") {
    window.balance += t.amount; // credit now that Admin confirmed the payment
  }
  // withdraw amounts were already reserved when requested — approving just marks it paid
  saveState();
  updateBalanceUI();
  renderAdminPanel();
  renderHistory();
}

function rejectTxn(id) {
  const t = state.transactions.find((x) => x.id === id);
  if (!t) return;
  t.status = "rejected";
  if (t.type === "withdraw") {
    window.balance += t.amount; // refund the reserved amount
  }
  saveState();
  updateBalanceUI();
  renderAdminPanel();
  renderHistory();
}

/* =======================================================
   Boot
   ======================================================= */
window.addEventListener("DOMContentLoaded", () => {
  buildCallBoardOnce();
  renderStakesList();
  updateBalanceUI();
  updateProfileStats();
  updateAdminMenuVisibility();
  setInterval(tickRooms, 1000);
});
