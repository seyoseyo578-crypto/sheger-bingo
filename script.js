/* =======================================================
   Sheger Bingo — script.js
   ======================================================= */

/* ---------- Settings you can tune ---------- */
const TOTAL_CARDS          = 250;      // ጠቅላላ ካርቴላ ብዛት
const ADMIN_CARDS          = [48, 68]; // ለAdmin የተያዙ ካርቴላዎች
const REGISTRATION_SECONDS = 60;       // ካርቴላ መመዝገቢያ ሰዓት (1 ደቂቃ)
const CALL_INTERVAL_MS     = 4000;     // ቁጥር በራስሰር በምን ያህል ፍጥነት እንደሚጠራ

/* ---------- Game state ---------- */
let gameState        = "registration"; // "registration" | "playing" | "ended"
let selectedCardNumber = null;
let registeredCards   = new Set();
let calledNumbers     = [];
let callTimerId       = null;
let regTimerId        = null;
let regSecondsLeft    = REGISTRATION_SECONDS;
const cardCache       = {}; // { cardNumber: [[col0],[col1],[col2],[col3],[col4]] }

/* ---------- Column ranges (standard B I N G O) ---------- */
const COLUMN_RANGES = {
  0: { letter: "B", min: 1,  max: 15, cls: "head-b" },
  1: { letter: "I", min: 16, max: 30, cls: "head-i" },
  2: { letter: "N", min: 31, max: 45, cls: "head-n" },
  3: { letter: "G", min: 46, max: 60, cls: "head-g" },
  4: { letter: "O", min: 61, max: 75, cls: "head-o" },
};

/* =======================================================
   Seeded random number generator (so every card number
   always produces the SAME layout for everyone)
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

/* Build (or fetch from cache) the 5x5 layout for a card number */
function getCardLayout(cardNumber) {
  if (cardCache[cardNumber]) return cardCache[cardNumber];

  const rng = mulberry32(cardNumber * 9973 + 17);
  const columns = [];

  for (let c = 0; c < 5; c++) {
    const range = COLUMN_RANGES[c];
    if (c === 2) {
      // N column: 4 numbers + FREE at the middle (index 2)
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

/* =======================================================
   DOM helpers
   ======================================================= */
const $ = (id) => document.getElementById(id);

/* ---------- Menu / Dark mode ---------- */
function openMenu() {
  $("menuPanel").classList.toggle("hidden");
}

function darkMode() {
  document.body.classList.toggle("dark");
}

/* =======================================================
   Card selection list (1–250)
   ======================================================= */
function showCards() {
  const panel = $("cardsPanel");
  panel.classList.toggle("hidden");
  if (panel.classList.contains("hidden")) return;

  const list = $("cardsList");
  list.innerHTML = "";

  for (let i = 1; i <= TOTAL_CARDS; i++) {
    const btn = document.createElement("button");
    const isAdmin = ADMIN_CARDS.includes(i);
    const isTaken = registeredCards.has(i) && i !== selectedCardNumber;
    const locked  = gameState !== "registration";

    btn.className = "card-btn";
    if (isAdmin) btn.classList.add("admin-card");
    if (i === selectedCardNumber) btn.classList.add("selected-card");
    if (isTaken || locked) btn.classList.add("disabled-card");

    btn.innerHTML = isAdmin ? "⭐ " + i : i;

    btn.onclick = () => {
      if (locked) {
        alert("ጨዋታው ተጀምሯል። ቀጣዩ ዙር እስኪጀምር ድረስ ካርቴላ መምረጥ አይቻልም።");
        return;
      }
      if (isAdmin) {
        alert("ካርቴላ " + i + " ለAdmin የተያዘ ነው።");
        return;
      }
      if (isTaken) {
        alert("ካርቴላ " + i + " ተይዟል፣ ሌላ ምረጥ።");
        return;
      }
      selectCard(i);
    };

    list.appendChild(btn);
  }
}

/* User taps a card number from the list */
function selectCard(cardNumber) {
  selectedCardNumber = cardNumber;
  renderCardGrid(cardNumber);

  $("cardTitle").textContent = "ካርቴላ " + cardNumber;
  $("cardsPanel").classList.add("hidden");

  const registerBtn = $("registerBtn");
  registerBtn.disabled = false;
  registerBtn.textContent = "አመዝግብ";
  registerBtn.classList.remove("registered");

  $("bingoClaimBtn").disabled = true;

  // ወደ ጨዋታው ቴብል ወዲያውኑ ውረድ
  $("gameSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* =======================================================
   Draw the 5x5 card grid (25 cells, header stays fixed in HTML)
   ======================================================= */
function renderCardGrid(cardNumber) {
  const columns = getCardLayout(cardNumber);
  const grid = $("cardGrid");
  grid.innerHTML = "";

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const value = columns[col][row];
      const cell = document.createElement("div");

      if (value === "FREE") {
        cell.className = "cell free";
        cell.textContent = "FREE";
      } else {
        cell.className = "cell";
        cell.textContent = value;
        cell.dataset.number = value;
        if (calledNumbers.includes(value)) cell.classList.add("marked");
      }
      grid.appendChild(cell);
    }
  }
}

/* =======================================================
   Register the selected card for this round
   ======================================================= */
function sendRegisterCard() {
  if (gameState !== "registration") {
    alert("ምዝገባ ዝግ ነው። ቀጣዩ ዙር ሲጀምር ይሞክሩ።");
    return;
  }
  if (!selectedCardNumber) {
    alert("መጀመሪያ ካርቴላ ይምረጡ።");
    return;
  }

  registeredCards.add(selectedCardNumber);

  const registerBtn = $("registerBtn");
  registerBtn.disabled = true;
  registerBtn.textContent = "ተመዝግቧል ✅";
  registerBtn.classList.add("registered");

  updateRegisteredCount();
}

function updateRegisteredCount() {
  $("registeredCount").textContent = registeredCards.size;
}

/* =======================================================
   Bingo caller (fully automatic — no start/stop button)
   =======================================================
   ጨዋታ የሚሠራው በ3 ደረጃ ነው፦
   1) registration  → ካርቴላ የሚመረጥበት/የሚመዘገብበት 1 ደቂቃ
   2) playing       → ቁጥር በራስሰር ይጠራል
   3) ended         → ውጤት ይታያል፣ ወዲያው ወደ registration ይመለሳል
*/

function startRegistrationPhase() {
  gameState = "registration";
  regSecondsLeft = REGISTRATION_SECONDS;

  // ዙር አዲስ ስለሆነ ሁሉንም ነገር አጽዳ
  calledNumbers = [];
  registeredCards.clear();
  selectedCardNumber = null;
  updateRegisteredCount();

  $("calledList").innerHTML = "";
  $("activeNumber").textContent = "-";
  $("cardTitle").textContent = "ካርቴላ -";
  $("cardGrid").innerHTML = "";
  $("registerBtn").disabled = true;
  $("registerBtn").textContent = "አመዝግብ";
  $("registerBtn").classList.remove("registered");
  $("bingoClaimBtn").disabled = true;

  updateRoundStatus("🟢 ካርቴላ የመመዝገቢያ ጊዜ");

  clearInterval(regTimerId);
  updateCountdownText();
  regTimerId = setInterval(() => {
    regSecondsLeft--;
    updateCountdownText();
    if (regSecondsLeft <= 0) {
      clearInterval(regTimerId);
      startPlayingPhase();
    }
  }, 1000);
}

function updateCountdownText() {
  const m = Math.floor(regSecondsLeft / 60).toString().padStart(2, "0");
  const s = (regSecondsLeft % 60).toString().padStart(2, "0");
  $("regCountdown").textContent = "አዲስ ጨዋታ በ: " + m + ":" + s;
}

function startPlayingPhase() {
  gameState = "playing";
  updateRoundStatus("🔴 ጨዋታ በመካሄድ ላይ — ካርቴላ መያዝ አይቻልም");
  $("regCountdown").textContent = "";

  // ካርቴላ ከመረጡ/ከመዘገቡ ማን አሸናፊ መጫወት እንደሚችል ክፈት
  if (selectedCardNumber && registeredCards.has(selectedCardNumber)) {
    $("bingoClaimBtn").disabled = false;
  }

  clearInterval(callTimerId);
  callTimerId = setInterval(callNumber, CALL_INTERVAL_MS);
}

function endRound(hasWinner) {
  gameState = "ended";
  clearInterval(callTimerId);
  updateRoundStatus(hasWinner ? "🏆 ዙሩ አልቋል" : "⏹️ ቁጥሮች አልቀዋል — አሸናፊ አልተገኘም");
  $("bingoClaimBtn").disabled = true;

  // ትንሽ ቆይቶ ወደ አዲስ ምዝገባ ተመለስ
  setTimeout(startRegistrationPhase, 3000);
}

function updateRoundStatus(text) {
  $("roundStatus").textContent = text;
}

/* ---------- Calling a number ---------- */
function ballClass(num) {
  if (num <= 15) return "ball-b";
  if (num <= 30) return "ball-i";
  if (num <= 45) return "ball-n";
  if (num <= 60) return "ball-g";
  return "ball-o";
}

function callNumber() {
  if (calledNumbers.length >= 75) {
    endRound(false);
    return;
  }

  let num;
  do {
    num = Math.floor(Math.random() * 75) + 1;
  } while (calledNumbers.includes(num));

  calledNumbers.push(num);
  $("activeNumber").textContent = num;
  $("activeNumber").className = ballClass(num);

  const circle = document.createElement("div");
  circle.className = "circle " + ballClass(num);
  circle.textContent = num;
  $("calledList").appendChild(circle);

  // በተጫዋቹ ካርቴላ ላይ ካለ በራስሰር ምልክት አድርግ
  document.querySelectorAll("#cardGrid .cell").forEach((cell) => {
    if (Number(cell.dataset.number) === num) {
      cell.classList.add("marked");
    }
  });

  if (calledNumbers.length >= 75) {
    endRound(false);
  }
}

/* =======================================================
   BINGO check — any complete row, column or diagonal wins
   ======================================================= */
function claimBingo() {
  if (gameState !== "playing") {
    alert("ጨዋታው አልተጀመረም ወይም አልቋል።");
    return;
  }
  if (!selectedCardNumber || !registeredCards.has(selectedCardNumber)) {
    alert("መጀመሪያ ካርቴላዎን ያስመዝግቡ።");
    return;
  }

  const cells = Array.from(document.querySelectorAll("#cardGrid .cell"));
  const marked = cells.map((c) => c.classList.contains("marked") || c.classList.contains("free"));

  // marked[] is in row-major order (5 rows x 5 cols), index = row*5+col
  const idx = (r, c) => r * 5 + c;
  let won = false;

  // rows
  for (let r = 0; r < 5 && !won; r++) {
    won = [0, 1, 2, 3, 4].every((c) => marked[idx(r, c)]);
  }
  // columns
  for (let c = 0; c < 5 && !won; c++) {
    won = [0, 1, 2, 3, 4].every((r) => marked[idx(r, c)]);
  }
  // diagonals
  if (!won) won = [0, 1, 2, 3, 4].every((i) => marked[idx(i, i)]);
  if (!won) won = [0, 1, 2, 3, 4].every((i) => marked[idx(i, 4 - i)]);

  if (won) {
    alert("🎉 እንኳን ደስ አለዎት! BINGO! ካርቴላ " + selectedCardNumber + " አሸናፊ ነው!");
    endRound(true);
  } else {
    alert("ገና BINGO አልሞላም። ተጨማሪ ቁጥሮች ይጠብቁ።");
  }
}

/* =======================================================
   Prize calculator
   ======================================================= */
function calculatePrize() {
  const totalInput = $("players").value;
  const total = totalInput === "" ? registeredCards.size : Number(totalInput);

  if (!total || total <= 0) {
    $("result").textContent = "እባክዎ ትክክለኛ ቁጥር ያስገቡ።";
    return;
  }

  const owner = (total * 0.25).toFixed(2);
  const winner = (total * 0.75).toFixed(2);

  $("result").innerHTML =
    "የአንተ 25%: " + owner + " ብር<br>" +
    "የአሸናፊ 75%: " + winner + " ብር";
}

/* =======================================================
   Payment functions
   ======================================================= */
function sendDeposit() {
  const amount = $("depositAmount").value;
  const proof = $("depositProof").value;

  if (!amount || !proof) {
    alert("ሁሉንም መረጃ ይሙሉ።");
    return;
  }

  alert("Deposit ጥያቄ ተልኳል ✅\nመጠን: " + amount + " ብር");
  $("depositAmount").value = "";
  $("depositProof").value = "";
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

  alert("Withdraw ጥያቄ ተልኳል ✅");
  $("withdrawAmount").value = "";
  $("withdrawAccount").value = "";
}

/* =======================================================
   Boot
   ======================================================= */
window.addEventListener("DOMContentLoaded", () => {
  startRegistrationPhase();
});
