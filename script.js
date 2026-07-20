
<html lang="am">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sheger Bingo</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>

    <!-- ራስጌ: የቢንጎ ፊደላት በየየራሳቸው ደማቅ ከለር -->
    <div class="topbar">
        <img src="logo.png" alt="Sheger Bingo" class="topbarLogo">
        <h2 class="bingo-title">
            <span class="b">B</span><span class="i">I</span><span class="n">N</span><span class="g">G</span><span class="o">O</span>
        </h2>
        <div class="topbarBalance">Balance: <b id="topbarBalanceValue">0 ብር</b></div>
    </div>

    <!-- ========== TAB: 🎮 ጨዋታ (Game) ========== -->
    <div id="tab-game" class="tabContent">

        <div class="info">
            <div>የካርቴላ ዋጋ: <b>10 ብር</b></div>
            <div>Balance: <b id="balance">0 ብር</b></div>
            <div>ሽልማት: <b id="prize">0 ብር</b></div>
        </div>

        <!-- የ 1 ደቂቃ የካርቴላ መመዝገቢያ ሰዓት ቆጣሪ -->
        <div id="timer-section" class="timer-box">
            የካርቴላ መመዝገቢያ ጊዜ: <span id="countdown">60</span> ሰከንድ ይቀራል
        </div>

        <!-- ካርቴላ ራስጌ ማሸነፊያ (BINGO!) ቁልፍ -->
        <div class="panel win-action-panel">
            <button id="bingoWinBtn" class="bingo-main-btn" onclick="claimBingoWin()">🏆 BINGO! (አሸነፍኩ)</button>
        </div>

        <!-- 1ኛ. የካርቴላ መምረጫ እና የእኔ ካርቴላዎች ክፍል (ወደ ላይ መጥቷል) -->
        <div class="panel">
            <h2>🎫 ካርቴላ ምረጥ</h2>
            <button id="openCardsBtn" onclick="openCards()">+ ካርቴላ ይጨምሩ</button>
            <h3>የተመረጡ ካርቴላዎች: <span id="selectedCount">0</span></h3>
            <h3>ዋጋ: <span id="cardPrice">0</span> ብር</h3>
        </div>

        <div class="panel">
            <h2>🎫 የእኔ ካርቴላ</h2>
            <div id="myCards"></div>
        </div>

        <!-- 2ኛ. የቢንጎ መጫወቻ ሰሌዳ እና ማሽን ክፍል (ወደ ታች ዝቅ ብሏል) -->
        <div class="panel">
            <h2>🎱 Bingo Machine</h2>
            <div class="table-scroll">
                <table id="bingoTable"></table>
            </div>
        </div>

        <div class="panel">
            <h2>🎱 Bingo Caller</h2>
            <!-- የነበረው ማኑዋል Start/Stop በተን ሙሉ በሙሉ ጠፍቷል -->
            <h1 id="activeNumber">-</h1>
            <h3 style="margin-top:15px;">የተጠሩ ቁጥሮች</h3>
            <div id="calledNumbers"></div>
        </div>

        <div class="panel">
            <h2>🏆 የጨዋታ ውጤት</h2>
            <h3 id="winMessage">ጨዋታ በመቀጠል ላይ...</h3>
            <h3>ሽልማት: <span id="winPrize">0</span> ብር</h3>
        </div>

    </div>

    <!-- ========== TAB: 🏆 ደረጃ (Leaderboard) ========== -->
    <div id="tab-leaderboard" class="tabContent hidden">
        <div class="panel">
            <h2>🏆 Leaderboard</h2>
            <p>ብዙ-ተጫዋች የደረጃ ሰንጠረዥ በቅርቡ ይመጣል።</p>
        </div>
    </div>

    <!-- ========== TAB: 💰 ዋሌት (Wallet) ========== -->
    <div id="tab-wallet" class="tabContent hidden">
        <div class="panel">
            <h2>💰 Deposit</h2>
            <p>Telebirr:<br>SUED<br>+251964796846</p>
            <p>ንግድ ባንክ:<br>SIED MEBRAHTU<br>1000615139126</p>
            <input type="number" id="depositAmount" placeholder="የሚያስገቡት ብር">
            <input type="text" id="depositProof" placeholder="የክፍያ ማረጋገጫ">
            <button onclick="sendDeposit()">Deposit ላክ</button>
        </div>
        <div class="panel">
            <h2>💸 Withdraw</h2>
            <p>Minimum Withdraw: <b>200 ብር</b></p>
            <input type="number" id="withdrawAmount" placeholder="የሚወጣው ብር">
            <input type="text" id="withdrawAccount" placeholder="Telebirr / CBE ቁጥር">
            <button onclick="sendWithdraw()">Withdraw ጠይቅ</button>
        </div>
    </div>

    <!-- ========== TAB: 👤 መገለጫ እና ማስተካከያዎች (Profile & Settings) ========== -->
    <div id="tab-profile" class="tabContent hidden">
        <div class="panel">
            <h2>👤 መገለጫ</h2>
            <h3>Balance: <span id="profileBalance">0 ብር</span></h3>
        </div>
        <div class="panel">
            <h2>⚙ ማስተካከያዎች (Settings)</h2>
            <button id="themeToggleBtn" onclick="toggleTheme()">🌙 Dark Mode</button>
            <button id="soundToggleBtn" onclick="toggleSound()">🔊 ድምፅ በርቷል</button>
        </div>
    </div>

    <!-- Full-screen card picker ሞዳል -->
    <div id="cardList" class="cardPickerOverlay hidden">
        <div class="cardPickerHeader">
            <button class="closeBtn" onclick="closeCards()">✕</button>
            <h2>ካርቴላ ምረጡ</h2>
            <div class="cardPickerBalance">Balance: <b id="pickerBalance">0 ብር</b></div>
            <div class="cardPickerHint">46 እና 68 ሁሌም ነፃ ናቸው 🆓</div>
        </div>

        <div id="cards" class="cardGrid"></div>

        <!-- ቁጥር ሲነካ ወዲያው ወደ ታች የሚወርድበት ሰንጠረዥ -->
        <div class="picker-table-section">
            <h3>የተመረጡ ካርቴላዎች ዝርዝር</h3>
            <table id="pickerSelectedTable">
                <thead>
                    <tr>
                        <th>የተመረጠ ካርቴላ</th>
                        <th>ድርጊት</th>
                    </tr>
                </thead>
                <tbody id="pickerSelectedTableBody"></tbody>
            </table>
        </div>

        <div class="cardPickerFooter">
            <div>
                ተመርጧል: <b id="selectedCountModal">0</b>
                &nbsp;|&nbsp;
                ዋጋ: <b id="cardPriceModal">0</b> ብር
            </div>
            <button id="registerCardsBtn" onclick="registerCards()">🎫 ሁሉንም አመዝግብ</button>
        </div>
    </div>

    <!-- ========== Bottom Navigation (ሁሉም ሜኑዎች ከታች ሆነዋል) ========== -->
    <nav class="bottomNav">
        <button class="navBtn active" id="navBtn-game" onclick="showTab('game')">
            <span class="navIcon">🎮</span><span>ጨዋታ</span>
        </button>
        <button class="navBtn" id="navBtn-leaderboard" onclick="showTab('leaderboard')">
            <span class="navIcon">🏆</span><span>ደረጃ</span>
        </button>
        <button class="navBtn" id="navBtn-wallet" onclick="showTab('wallet')">
            <span class="navIcon">💰</span><span>ዋሌት</span>
        </button>
        <button class="navBtn" id="navBtn-profile" onclick="showTab('profile')">
            <span class="navIcon">👤</span><span>መገለጫ</span>
        </button>
    </nav>

    <script src="https://telegram.org"></script>
    <script src="script.js"></script>
</body>
</html>
