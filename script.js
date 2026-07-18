// --- የቢንጎ ቁጥሮችን በትክክለኛው ክልል ማመንጨት ---
function getColumnNumbers(min, max, count) {
    let nums = [];
    while(nums.length < count) {
        let n = Math.floor(Math.random() * (max - min + 1)) + min;
        if(!nums.includes(n)) nums.push(n);
    }
    return nums;
}

function createCard(id) {
    // እያንዳንዱ አምድ የራሱ ክልል አለው
    let b = getColumnNumbers(1, 15, 5);
    let i = getColumnNumbers(16, 30, 5);
    let n = getColumnNumbers(31, 45, 4); // መሃል ነፃ ስለሆነ 4 ቁጥር
    let g = getColumnNumbers(46, 60, 5);
    let o = getColumnNumbers(61, 75, 5);
    
    // ቁጥሮቹን አንድ ላይ ማቀናጀት
    let allNumbers = [...b, ...i, ...n.slice(0,2), 0, ...n.slice(2), ...g, ...o]; 
    // 0 ማለት 'FREE' ቦታ ነው
    
    return { id: id, numbers: allNumbers, marked: Array(25).fill(false) };
}

function showCards() {
    const container = document.getElementById('bingo-card-container');
    container.innerHTML = '';
    registeredCards.forEach(card => {
        let cardDiv = document.createElement('div');
        cardDiv.className = 'card-view';
        cardDiv.innerHTML = `<h4>ካርቴላ #${card.id}</h4>`;
        
        let grid = document.createElement('div');
        grid.className = 'bingo-grid';
        
        card.numbers.forEach((num, index) => {
            let cell = document.createElement('div');
            cell.className = 'cell';
            cell.innerText = num === 0 ? 'FREE' : num;
            if(num === 0) cell.classList.add('free');
            if(card.marked[index]) cell.classList.add('marked');
            grid.appendChild(cell);
        });
        
        cardDiv.appendChild(grid);
        container.appendChild(cardDiv);
    });
}
