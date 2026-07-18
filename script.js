// --- Global State ---
let registeredCards = [];
let drawnNumbers = [];
let totalCardsCount = 0;
const MAX_CARDS = 250;

// --- 1. Bingo Card System ---
function generateBingoNumbers() {
    let nums = [];
    while(nums.length < 24) {
        let n = Math.floor(Math.random() * 75) + 1;
        if(!nums.includes(n)) nums.push(n);
    }
    return nums;
}

function createCard(id) {
    let card = { 
        id: id, 
        numbers: generateBingoNumbers(), 
        marked: Array(25).fill(false) 
    };
    card.marked[12] = true; // መሃል FREE
    return card;
}

// --- 2. Card Selection ---
function addCard() {
    if(totalCardsCount < MAX_CARDS) {
        totalCardsCount++;
        registeredCards.push(createCard(totalCardsCount));
        document.getElementById('p-count').innerText = totalCardsCount;
        updatePrize();
        showCards();
    }
}

function showCards() {
    const container = document.getElementById('bingo-card-container');
    container.innerHTML = ''; // ማጽጃ
    registeredCards.forEach(card => {
        let cardDiv = document.createElement('div');
        cardDiv.className = 'card-view';
        cardDiv.innerHTML = `<h4>ካርቴላ #${card.id}</h4>`;
        // እዚህ ጋር የ 5x5 Grid ይፈጠራል...
        container.appendChild(cardDiv);
    });
}

// --- 3 & 4. Bingo Caller & Auto Mark ---
function callNumber() {
    let num;
    do { num = Math.floor(Math.random() * 75) + 1; } while (drawnNumbers.includes(num));
    drawnNumbers.push(num);
    document.getElementById('current-num').innerText = "የወጣ ቁጥር: " + num;
    
    // Auto Mark logic
    registeredCards.forEach(card => {
        let index = card.numbers.indexOf(num);
        if(index !== -1) card.marked[index] = true;
    });
}

// --- 6. Prize Calculator ---
function updatePrize() {
    let revenue = totalCardsCount * 10; // 10 ብር ለካርቴላ
    let prize = revenue * 0.75; // 75% ለአሸናፊ
    document.getElementById('prize-pool-text').innerText = "ሽልማት: $" + prize;
}

// --- 7. Payment Functions ---
function sendWithdraw(amount) {
    if(amount < 200) {
        alert("ቢያንስ 200 ብር መውጣት አለበት!");
        return;
    }
    alert("የ" + amount + " ብር የWithdraw ጥያቄ ለAdmin ተልኳል!");
}

// --- 8. UI Helpers ---
function toggleDarkMode() {
    document.body.classList.toggle('dark');
}

function openMenu() {
    document.getElementById('menu-panel').style.display = 'block';
}

// በየ 3 ሰከንድ ቁጥር እንዲጠራ
setInterval(callNumber, 3000);

