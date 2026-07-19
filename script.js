/* ================================
   Sheger Bingo - script.js
   ================================ */

let balance = 0;
let calledNumbers = [];
let selectedCards = [];       // array of card numbers the player has selected
let unpaidCards = [];         // card numbers selected without enough balance (cannot win)
let isCalling = false;
let callerTimer = null;
let soundOn = true;

const CARD_PRICE = 10;
const MIN_WITHDRAW = 200;
const CALL_INTERVAL_MS = 5000;
const FREE_CARDS = [46, 68]; // always free to play, always eligible to win


/* ---------- Bingo Machine Table (horizontal: one row per letter) ---------- */

const machineColumns = {
    B: range(1, 15),
    I: range(16, 30),
    N: range(31, 45),
    G: range(46, 60),
    O: range(61, 75)
};

function range(min, max) {
    let arr = [];
    for (let n = min; n <= max; n++) arr.push(n);
    return arr;
}

function buildMachineTable() {
    let table = document.getElementById("bingoTable");
    table.innerHTML = "";

    for (let letter in machineColumns) {
        let row = document.createElement("tr");

        let head = document.createElement("th");
        head.innerHTML = letter;
        row.appendChild(head);

        machineColumns[letter].forEach(num => {
            let cell = document.createElement("td");
            cell.innerHTML = num;
            cell.dataset.number = num;
            row.appendChild(cell);
        });

        table.appendChild(row);
    }
}

buildMachineTable();


/* ---------- Number Caller ---------- */

function numberLetter(number) {
    if (number <= 15) return "B";
    if (number <= 30) return "I";
    if (number <= 45) return "N";
    if (number <= 60) return "G";
    return "O";
}

function beep() {
    if (!soundOn) return;
    try {
        let ctx = new (window.AudioContext || window.webkitAudioContext)();
        let osc = ctx.createOscillator();
        let gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
        // audio not available, ignore
    }
}

function callNumber() {
    if (calledNumbers.length >= 75) {
        alert("ሁሉም ቁጥሮች ተጠርተዋል");
        stopCaller();
        return;
    }

    let number;
    do {
        number = Math.floor(Math.random() * 75) + 1;
    } while (calledNumbers.includes(number));

    calledNumbers.push(number);

    let letter = numberLetter(number);

    document.getElementById("activeNumber").innerHTML = letter + "-" + number;

    // Highlight it on the big machine board
    document.querySelectorAll("#bingoTable td").forEach(cell => {
        if (Number(cell.dataset.number) === number) {
            cell.classList.add("active");
        }
    });

    // Add to the "called numbers" history strip
    let circle = document.createElement("div");
    circle.className = "numberCircle";
    circle.innerHTML = letter + "-" + number;
    document.getElementById("calledNumbers").appendChild(circle);

    beep();

    // Mark it on the player's cards (if any) + check for a win
    markCard(number);
}

// The caller machine works on its own — players do not need to be
// registered for it to start calling numbers.
function startCaller() {
    let btn = event.target;

    if (isCalling) {
        stopCaller();
        btn.innerHTML = "▶ Start";
        return;
    }

    isCalling = true;
    btn.innerHTML = "⏸ Stop";

    callNumber(); // call the first number immediately
    callerTimer = setInterval(callNumber, CALL_INTERVAL_MS);
}

function stopCaller() {
    isCalling = false;
    let btn = document.getElementById("callerStartBtn");
    if (btn) btn.innerHTML = "▶ Start";
    if (callerTimer) {
        clearInterval(callerTimer);
        callerTimer = null;
    }
}


/* ---------- Card Selection (1 - 250) ---------- */

function openCards() {
    let box = document.getElementById("cardList");
    box.classList.toggle("hidden");

    let cards = document.getElementById("cards");
    cards.innerHTML = "";

    for (let i = 1; i <= 250; i++) {
        let btn = document.createElement("button");
        btn.innerHTML = "" + i;
        btn.className = "cardButton";

        if (FREE_CARDS.includes(i)) {
            btn.classList.add("freeCardBtn");
        }

        if (selectedCards.includes(i)) {
            btn.classList.add("selectedCard");
        }

        btn.onclick = function () {
            selectCard(i, btn);
        };

        cards.appendChild(btn);
    }
}

function selectCard(number, button) {
    let isFree = FREE_CARDS.includes(number);

    if (selectedCards.includes(number)) {
        // Deselect. Refund only if it was actually paid for.
        selectedCards = selectedCards.filter(c => c !== number);

        if (!isFree && !unpaidCards.includes(number)) {
            balance += CARD_PRICE;
        }
        unpaidCards = unpaidCards.filter(c => c !== number);

        button.classList.remove("selectedCard");
    } else {
        // Select. Free cards never cost anything. Otherwise, take the
        // card even without enough balance — it just won't be able to win.
        if (isFree) {
            // no charge
        } else if (balance >= CARD_PRICE) {
            balance -= CARD_PRICE;
        } else {
            unpaidCards.push(number);
        }

        selectedCards.push(number);
        button.classList.add("selectedCard");
    }

    document.getElementById("balance").innerHTML = balance + " ብር";
    document.getElementById("selectedCount").innerHTML = selectedCards.length;
    document.getElementById("cardPrice").innerHTML = selectedCards.length * CARD_PRICE;

    showSelectedCards();
}

function registerCards() {
    if (selectedCards.length === 0) {
        alert("እባክዎ ቢያንስ አንድ ካርቴላ ይምረጡ");
        return;
    }

    showSelectedCards();

    let box = document.getElementById("cardList");
    box.classList.add("hidden");

    alert("ካርቴላዎ ተመዝግቧል ✅");
}

function showSelectedCards() {
    let box = document.getElementById("myCards");
    box.innerHTML = "";

    selectedCards.forEach(cardNumber => {
        createMyCard(cardNumber);
    });
}


/* ---------- Player Bingo Cards ---------- */

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function createMyCard(cardNumber) {
    let box = document.getElementById("myCards");
    let isFree = FREE_CARDS.includes(cardNumber);
    let isUnpaid = unpaidCards.includes(cardNumber);

    let wrapper = document.createElement("div");
    wrapper.className = "bingoCardWrapper";

    let label = document.createElement("h3");
    label.innerHTML = "ካርቴላ #" + cardNumber
        + (isFree ? " 🆓" : "")
        + (isUnpaid ? " ⚠️ ያልተከፈለ" : "");
    wrapper.appendChild(label);

    let card = document.createElement("div");
    card.className = "bingoCard";
    card.dataset.cardId = cardNumber;
    if (isUnpaid) card.dataset.unpaid = "true";

    let letters = ["B", "I", "N", "G", "O"];
    letters.forEach(l => {
        let cell = document.createElement("div");
        cell.className = "bingoCell bingoHead";
        cell.innerHTML = l;
        card.appendChild(cell);
    });

    let ranges = [
        [1, 15],
        [16, 30],
        [31, 45],
        [46, 60],
        [61, 75]
    ];

    // Pick unique numbers per column so no duplicates appear
    let columnValues = ranges.map(([min, max]) => shuffle(range(min, max)));

    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            let cell = document.createElement("div");
            cell.className = "bingoCell";

            if (row === 2 && col === 2) {
                cell.innerHTML = "FREE";
                cell.classList.add("free");
            } else {
                let num = columnValues[col][row];
                cell.innerHTML = num;
                cell.dataset.number = num;
            }

            card.appendChild(cell);
        }
    }

    wrapper.appendChild(card);
    box.appendChild(wrapper);
}


/* ---------- Marking called numbers + win check ---------- */

function markCard(number) {
    document.querySelectorAll(".bingoCell").forEach(cell => {
        if (Number(cell.dataset.number) === number) {
            cell.classList.add("marked");
        }
    });

    checkBingo();
}

function checkBingo() {
    let cards = document.querySelectorAll(".bingoCard");
    let winner = null;

    cards.forEach(card => {
        // Unpaid cards can be played and marked, but can never win.
        if (card.dataset.unpaid === "true") return;

        let cells = card.querySelectorAll(".bingoCell:not(.bingoHead)");
        let allMarked = true;

        cells.forEach(cell => {
            if (!cell.classList.contains("marked") && !cell.classList.contains("free")) {
                allMarked = false;
            }
        });

        if (allMarked && !winner) {
            winner = card.dataset.cardId;
        }
    });

    if (winner) {
        stopCaller();
        document.getElementById("winMessage").innerHTML =
            "🎉 BINGO! ካርቴላ #" + winner + " አሸናፊ ነው";
        document.getElementById("winPrize").innerHTML = 100;
        document.getElementById("prize").innerHTML = "100 ብር";
    }
}


/* ---------- Menu (Deposit / Withdraw live inside it) ---------- */

function toggleMenu() {
    document.getElementById("menuPanel").classList.toggle("hidden");
}

function sendDeposit() {
    let amountInput = document.getElementById("depositAmount");
    let amount = Number(amountInput.value);

    if (!amount || amount <= 0) {
        alert("የብር መጠን አስገባ");
        return;
    }

    balance += amount;
    document.getElementById("balance").innerHTML = balance + " ብር";
    amountInput.value = "";

    alert("Deposit ተጨምሯል ✅");
}

function sendWithdraw() {
    let amountInput = document.getElementById("withdrawAmount");
    let amount = Number(amountInput.value);

    if (!amount || amount < MIN_WITHDRAW) {
        alert("Minimum Withdraw " + MIN_WITHDRAW + " ብር ነው");
        return;
    }

    if (amount > balance) {
        alert("በቂ Balance የለም");
        return;
    }

    balance -= amount;
    document.getElementById("balance").innerHTML = balance + " ብር";
    amountInput.value = "";

    alert("Withdraw ጥያቄ ተልኳል ✅");
}


/* ---------- Settings (theme + sound) — only closes via the ✕ button ---------- */

function openSettings() {
    document.getElementById("settingsModal").classList.remove("hidden");
}

function closeSettings() {
    document.getElementById("settingsModal").classList.add("hidden");
}

function toggleTheme() {
    document.body.classList.toggle("dark");
    let isDark = document.body.classList.contains("dark");
    document.getElementById("themeToggleBtn").innerHTML =
        isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
}

function toggleSound() {
    soundOn = !soundOn;
    document.getElementById("soundToggleBtn").innerHTML =
        soundOn ? "🔊 ድምፅ በርቷል" : "🔇 ድምፅ ጠፍቷል";
}
