/* =======================================================
   Sheger Bingo — style.css
   ======================================================= */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: "Segoe UI", Arial, sans-serif;
}

body {
  background: #f2f2f2;
  color: #222;
  transition: background .3s, color .3s;
  padding-bottom: 30px;
}

body.dark {
  background: #111;
  color: #fff;
}

/* ---------- Header ---------- */
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 20;
  box-shadow: 0 1px 4px rgba(0,0,0,.08);
}

body.dark header {
  background: #1c1c1c;
}

.logo {
  width: 46px;
  height: 46px;
  object-fit: contain;
  border-radius: 50%;
}

header h2 {
  font-size: 18px;
  flex: 1;
  margin-left: 10px;
}

.menu {
  font-size: 26px;
  cursor: pointer;
  padding: 4px 8px;
}

/* ---------- Layout ---------- */
.container {
  padding: 12px;
  text-align: center;
  max-width: 480px;
  margin: 0 auto;
}

.balance {
  font-size: 18px;
  margin: 10px 0;
  font-weight: bold;
}

.panel {
  background: #fff;
  padding: 15px;
  border-radius: 12px;
  margin: 12px 0;
  text-align: left;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
}

body.dark .panel {
  background: #1e1e1e;
}

.panel h3 {
  margin-bottom: 10px;
  font-size: 16px;
}

.panel input {
  width: 100%;
  padding: 10px;
  margin: 6px 0;
  border-radius: 8px;
  border: 1px solid #ccc;
  font-size: 14px;
}

body.dark .panel input {
  background: #333;
  border-color: #555;
  color: #fff;
}

button {
  padding: 10px 15px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  margin: 5px 0;
  font-size: 14px;
  background: #008cff;
  color: #fff;
}

button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.hidden { display: none !important; }

/* ---------- Section headings ---------- */
.section-title {
  font-size: 17px;
  margin: 18px 0 8px;
  text-align: left;
}

/* ---------- Card selection list ---------- */
.plus-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.plus {
  font-size: 26px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #008cff;
  color: #fff;
  flex-shrink: 0;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  max-height: 260px;
  overflow-y: auto;
  margin-top: 10px;
}

.card-btn {
  background: #eef4ff;
  color: #222;
  padding: 8px 0;
  font-size: 13px;
  border-radius: 6px;
  margin: 0;
}

body.dark .card-btn {
  background: #2a2a2a;
  color: #fff;
}

.card-btn.selected-card {
  background: #008cff;
  color: #fff;
}

.card-btn.admin-card {
  background: #ffe08a;
  color: #7a5b00;
}

.card-btn.disabled-card {
  opacity: .4;
  cursor: not-allowed;
}

/* ---------- Game table ---------- */
#gameSection {
  scroll-margin-top: 70px;
}

.round-status {
  font-weight: bold;
  margin: 8px 0;
}

.reg-countdown {
  font-size: 14px;
  color: #008cff;
  font-weight: bold;
  margin-bottom: 8px;
}

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.card-header-row h3 {
  font-size: 16px;
}

.bingo-claim-btn {
  background: #ff9f1c;
  font-weight: bold;
}

.register-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 10px 0;
}

.register-btn {
  background: #2a9d8f;
  flex: 1;
}

.register-btn.registered {
  background: #4caf50;
}

/* ---------- Bingo card grid ---------- */
.bingo-header,
.bingo-card {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
  max-width: 320px;
  margin: 10px auto;
}

.cell {
  aspect-ratio: 1 / 1;
  border: 1px solid #ccc;
  border-radius: 6px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #fff;
  font-weight: bold;
  font-size: 15px;
}

body.dark .cell {
  background: #2a2a2a;
  color: #fff;
  border-color: #444;
}

.cell.free {
  background: #ffcc00;
  color: #222;
  font-size: 12px;
}

.cell.marked {
  background: #00c853 !important;
  color: #fff !important;
  border: 2px solid #00863a;
}

/* Letter colors — each BINGO letter has its own identity */
.head-b { background: #e63946; color: #fff; }
.head-i { background: #f4a261; color: #fff; }
.head-n { background: #2a9d8f; color: #fff; }
.head-g { background: #457b9d; color: #fff; }
.head-o { background: #ffb703; color: #222; }

/* ---------- Caller ---------- */
.active-number-box {
  margin: 15px 0;
}

.active-number-box .circle {
  width: 70px;
  height: 70px;
  font-size: 26px;
  margin: 0 auto;
}

.called {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin: 15px 0;
  max-height: 160px;
  overflow-y: auto;
}

.circle {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  color: #fff;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  font-size: 13px;
}

.ball-b { background: #e63946; }
.ball-i { background: #f4a261; }
.ball-n { background: #2a9d8f; }
.ball-g { background: #457b9d; }
.ball-o { background: #ffb703; color: #222; }

/* ---------- Prize calculator ---------- */
.registered-count {
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
}

body.dark .registered-count {
  color: #aaa;
}
