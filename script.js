/* =======================================================
   Sheger Bingo — script.js
   Multi-stake rooms, multi-card play (+ / ×), live jackpot,
   big horizontal calling board, modal deposit/withdraw.
   ======================================================= */

/* ---------- Config ---------- */
const TOTAL_CARDS   = 250;
const ADMIN_CARDS   = [48, 68];
const STAKES        = [10, 20, 30, 50, 80, 100, 150];
const WINNER_SHARE  = 0.75;   // ለአሸናፊ 75%
const ADMIN_SHARE   = 0.25;   // ለAdmin (ተቆራጭ) 25% -- backend/ወደፊት ተግባራዊ ይሆናል

const COLUMN_RANGES = {
  0: { letter: "B", min: 1,  max: 15 },
  1: { letter: "I", min: 16, max: 30 },
  2: { letter: "N", min: 31, max: 45 },
  3: { letter: "G", min: 46, max: 60 },
  4: { letter: "O", min: 61, max: 75 },
};

/* ---------- Global demo state ---------- */
let balance        = 0;
let gamesPlayed     = 0;
let totalWinnings  = 0;
let currentRoomStake = null; // stake of the room currently open on screen
const cardCache = {};        // seeded card layouts, shared across all rooms

/* ---------- Rooms (one per stake) ---------- */
const rooms = {};
STAKES.forEach((stake) => {
  rooms[stake] = {
    stake,
    state: "registration",           // "registration" | "playing"
    secondsLeft: randInt(15, 60),
    registeredCount: randInt(3, 45), // simulated pool of other players
    calledNumbers: [],
    cards: [],                       // this player's cards in this room: [{number}]
  };
});

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* =======================================================
   Seeded random layout generator (same card # = same layout
   for every player, every room)
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

const $ = (id) => document.getElementById(id);

/* =======================================================
   Bottom nav tabs (Scores / History / Play / Wallet / Profile)
   ======================================================= */
function switchTab(tab) {
  ["scores", "history", "play", "wallet", "profile"].forEach((t) => {
    $("tab-" + t).classList.toggle("hidden", t !== tab);
    $("navbtn-" + t).classList.toggle("active", t === tab);
  });
  $("topMenuPanel").classList.add("hidden");
}

function toggleTopMenu() {
  $("topMenuPanel").classList.toggle("hidden");
}

function darkMode() {
  document.body.classList.toggle("dark");
}

/* ---------- Deposit / Withdraw modals ---------- */
function openModal(id) {
  $("topMenuPanel").classList.add("hidden");
  $(id).classList.remove("hidden");
}
function closeModal(id) {
  $(id).classList.add("hidden");
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

/* Add a card: pay the stake immediately and register it */
function addCard(number) {
  const room = rooms[currentRoomStake];
  if (room.state !== "registration") {
    alert("ምዝገባ ዝግ ነው። ቀጣዩ ዙር ሲጀምር ይሞክሩ።");
    return;
  }
  if (balance < room.stake) {
    alert("በቂ ቀሪ ሂሳብ የለዎትም። እባክዎ Deposit ያድርጉ።");
    return;
  }

  balance -= room.stake;
  room.registeredCount += 1;
  room.cards.push({ number });

  updateBalanceUI();
  $("cardsPanel").classList.add("hidden");
  renderRoomCards();
}

/* Remove a card with the (×) button — refunds the stake */
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
  balance += room.stake;

  updateBalanceUI();
  renderRoomCards();
}

/* =======================================================
   Render the player's cards row (+ add tile / × remove)
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
        cell.className = "cell";
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
   One horizontal row per letter (B/I/N/G/O), scrollable.
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
   BINGO check — row / column / diagonal, across all of the
   player's cards in this room
   ======================================================= */
function cardHasLine(cardNumber, calledNumbers) {
  const columns = getCardLayout(cardNumber);
  const marked = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const value = columns[c][r];
      marked.push(value === "FREE" || calledNumbers.includes(value));
    }
  }
  const idx = (r, c) => r * 5 + c;
  for (let r = 0; r < 5; r++) if ([0, 1, 2, 3, 4].every((c) => marked[idx(r, c)])) return true;
  for (let c = 0; c < 5; c++) if ([0, 1, 2, 3, 4].every((r) => marked[idx(r, c)])) return true;
  if ([0, 1, 2, 3, 4].every((i) => marked[idx(i, i)])) return true;
  if ([0, 1, 2, 3, 4].every((i) => marked[idx(i, 4 - i)])) return true;
  return false;
}

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

  const winningCard = room.cards.find((c) => cardHasLine(c.number, room.calledNumbers));

  if (winningCard) {
    const win = possibleWin(room);
    balance += win;
    gamesPlayed += 1;
    totalWinnings += win;
    updateBalanceUI();
    updateProfileStats();
    alert("🦁 BINGO! እንኳን ደስ አለዎት! ካርቴላ " + winningCard.number + " — " + win + " ETB አሸንፈዋል!");
    endPlaying(room);
  } else {
    alert("ገና BINGO አልሞላም። ተጨማሪ ቁጥሮች ይጠብቁ።");
  }
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
   Profile / Wallet — balance, deposit, withdraw, stats
   ======================================================= */
function updateBalanceUI() {
  $("balanceTop").textContent = balance + " ETB";
  $("profileBalance").textContent = "ETB " + balance;
}

function updateProfileStats() {
  $("statGames").textContent = gamesPlayed;
  $("statWinnings").textContent = "ETB " + totalWinnings;
  $("profileWinningsMini").textContent = "ETB " + totalWinnings;
}

function sendDeposit() {
  const amount = Number($("depositAmount").value);
  const proof = $("depositProof").value;

  if (!amount || amount <= 0 || !proof) {
    alert("ሁሉንም መረጃ ይሙሉ።");
    return;
  }

  // ማስታወሻ: ይህ ለDemo ብቻ ወዲያውኑ ባላንስ ይጨምራል።
  // እውነተኛው ስሪት Admin ማረጋገጫ ካገኘ በኋላ ብቻ ባላንስ ይጨምራል።
  balance += amount;
  updateBalanceUI();
  alert("Deposit ጥያቄ ተልኳል ✅ (Demo - ወዲያውኑ ታክሏል)\nመጠን: " + amount + " ብር");
  $("depositAmount").value = "";
  $("depositProof").value = "";
  closeModal("depositModal");
}

function sendWithdraw() {
  const amount = Number($("withdrawAmount").value);
  const account = $("withdrawAccount").value;

  if (!amount || amount < 200) {
    alert("ከ200 ብር በታች Withdraw ማድረግ አይቻልም።");
    return;
  }
  if (!account) {
    alert("የክፍያ አካውንት መረጃ ይሙሉ።");
    return;
  }
  if (amount > balance) {
    alert("በቂ ቀሪ ሂሳብ የለዎትም።");
    return;
  }

  balance -= amount;
  updateBalanceUI();
  alert("Withdraw ጥያቄ ተልኳል ✅");
  $("withdrawAmount").value = "";
  $("withdrawAccount").value = "";
  closeModal("withdrawModal");
}

/* =======================================================
   Boot
   ======================================================= */
window.addEventListener("DOMContentLoaded", () => {
  buildCallBoardOnce();
  renderStakesList();
  updateBalanceUI();
  updateProfileStats();
  setInterval(tickRooms, 1000);
});
