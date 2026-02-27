// ─── Constants ───────────────────────────────────────────────────────────────
const TOTAL_ROUNDS = 5;
const MULTIPLIERS  = [1.96, 3.92, 7.84, 15.68, 31.36, 62.72];
const CHOICES      = ['rock', 'paper', 'scissors'];
const EMOJIS       = { rock: '✊', paper: '🖐', scissors: '✌️' };

// ─── Game State ───────────────────────────────────────────────────────────────
let balance        = 100.00;
let betAmount      = 0;
let currentRound   = 0;
let roundResults   = [];
let gameActive     = false;
let waitingForChoice = false;

// ─── Bracket Builder (horizontal) ────────────────────────────────────────────
function buildBracket() {
  const track = document.getElementById('bracketTrack');
  track.innerHTML = '';

  for (let r = 0; r < TOTAL_ROUNDS; r++) {
    // ── Column ──
    const col = document.createElement('div');
    col.className = 'round-col';
    col.id = `roundCol_${r}`;

    // Multiplier badge
    const badge = document.createElement('div');
    badge.className = 'mult-badge';
    badge.id = `mult_${r}`;
    badge.textContent = `${MULTIPLIERS[r]}x`;
    col.appendChild(badge);

    // Card pair wrapper
    const pair = document.createElement('div');
    pair.className = 'card-pair';

    // Computer card (top)
    const compCard = document.createElement('div');
    compCard.className = 'game-card empty';
    compCard.id = `comp_${r}`;
    pair.appendChild(compCard);

    // VS divider
    const vs = document.createElement('div');
    vs.className = 'vs-divider';
    vs.textContent = 'VS';
    pair.appendChild(vs);

    // Player card (bottom)
    const playerCard = document.createElement('div');
    playerCard.className = 'game-card empty';
    playerCard.id = `player_${r}`;
    pair.appendChild(playerCard);

    col.appendChild(pair);
    track.appendChild(col);

    // ── Arrow connector (between columns, not after last) ──
    if (r < TOTAL_ROUNDS - 1) {
      const arrow = document.createElement('div');
      arrow.className = 'h-connector';
      arrow.id = `conn_${r}`;
      track.appendChild(arrow);
    }
  }
}

// ─── Highlight state ─────────────────────────────────────────────────────────
function highlightCurrentRound() {
  for (let r = 0; r < TOTAL_ROUNDS; r++) {
    const col   = document.getElementById(`roundCol_${r}`);
    const badge = document.getElementById(`mult_${r}`);
    if (!col || !badge) continue;

    col.classList.remove('active', 'done');
    badge.classList.remove('active', 'passed');

    if (r < currentRound) {
      col.classList.add('done');
      badge.classList.add('passed');
    } else if (r === currentRound) {
      col.classList.add('active');
      badge.classList.add('active');
    }

    // Connectors
    if (r < TOTAL_ROUNDS - 1) {
      const conn = document.getElementById(`conn_${r}`);
      if (!conn) continue;
      conn.classList.remove('passed', 'active');
      if (r < currentRound)      conn.classList.add('passed');
      else if (r === currentRound) conn.classList.add('active');
    }
  }

  // Mark current round cards as "waiting"
  const pc = document.getElementById(`player_${currentRound}`);
  const cc = document.getElementById(`comp_${currentRound}`);
  if (pc) { pc.className = 'game-card current'; pc.textContent = '?'; }
  if (cc) { cc.className = 'game-card current'; cc.textContent = '?'; }
}

// ─── Bet Controls ─────────────────────────────────────────────────────────────
function halveBet() {
  const input = document.getElementById('betInput');
  input.value = Math.max(0.50, parseFloat(input.value) / 2).toFixed(2);
}

function doubleBet() {
  const input = document.getElementById('betInput');
  input.value = (parseFloat(input.value) * 2).toFixed(2);
}

function updateBalance(newBal) {
  balance = newBal;
  document.getElementById('balanceDisplay').textContent  = balance.toFixed(2);
  document.getElementById('sidebarBalance').textContent  = balance.toFixed(2);
}

// ─── Game Flow ────────────────────────────────────────────────────────────────
function placeBet() {
  betAmount = parseFloat(document.getElementById('betInput').value);
  if (isNaN(betAmount) || betAmount <= 0) return;
  if (betAmount > balance) { alert('Insufficient balance!'); return; }

  updateBalance(balance - betAmount);
  currentRound     = 0;
  roundResults     = [];
  gameActive       = true;
  waitingForChoice = true;

  document.getElementById('preGamePanel').style.display = 'none';
  const inGame = document.getElementById('inGamePanel');
  inGame.style.cssText = 'display:flex; flex-direction:column; gap:14px;';

  document.getElementById('betAmountDisplay').textContent = betAmount.toFixed(2);
  updatePayoutDisplay(1, betAmount);

  setChoiceButtons(true);
  clearResultBanner();
  buildBracket();
  highlightCurrentRound();

  // Scroll bracket to the start
  document.getElementById('bracketContainer').scrollLeft = 0;
}

function setChoiceButtons(enabled) {
  ['btnRock', 'btnPaper', 'btnScissors'].forEach(id => {
    document.getElementById(id).disabled = !enabled;
  });
}

function playerChoose(choice) {
  if (!gameActive || !waitingForChoice) return;
  waitingForChoice = false;
  setChoiceButtons(false);

  // Flash chosen button
  const btnMap = { rock: 'btnRock', paper: 'btnPaper', scissors: 'btnScissors' };
  const btn = document.getElementById(btnMap[choice]);
  btn.classList.add('selected');
  setTimeout(() => btn.classList.remove('selected'), 500);

  const compChoice = CHOICES[Math.floor(Math.random() * 3)];
  const result     = getResult(choice, compChoice);
  roundResults.push({ player: choice, computer: compChoice, result });

  const playerCard = document.getElementById(`player_${currentRound}`);
  const compCard   = document.getElementById(`comp_${currentRound}`);

  // Reveal computer card first
  setTimeout(() => {
    compCard.textContent = EMOJIS[compChoice];
    const compState = result === 'win' ? 'lose' : result === 'lose' ? 'win' : 'empty';
    compCard.className = `game-card ${compState} reveal-anim`;
  }, 200);

  // Then player card
  setTimeout(() => {
    playerCard.textContent = EMOJIS[choice];
    const playerState = result === 'win' ? 'win win-anim' : result === 'lose' ? 'lose' : 'empty';
    playerCard.className = `game-card ${playerState} reveal-anim`;
  }, 400);

  setTimeout(() => processRoundResult(result, choice, compChoice), 800);
}

function getResult(player, computer) {
  if (player === computer) return 'tie';
  if (
    (player === 'rock'     && computer === 'scissors') ||
    (player === 'paper'    && computer === 'rock')     ||
    (player === 'scissors' && computer === 'paper')
  ) return 'win';
  return 'lose';
}

function processRoundResult(result, playerChoice, compChoice) {
  if (result === 'tie') {
    showResultBanner('🤝 Tie! Play again...', false);
    waitingForChoice = true;
    setChoiceButtons(true);
    return;
  }

  if (result === 'win') {
    const wonRounds = currentRound + 1;
    const mult = MULTIPLIERS[wonRounds - 1];
    updatePayoutDisplay(mult, betAmount * mult);

    // Mark connector as passed
    const conn = document.getElementById(`conn_${currentRound}`);
    if (conn) { conn.classList.remove('active'); conn.classList.add('passed'); }

    if (wonRounds >= TOTAL_ROUNDS) {
      const payout = betAmount * MULTIPLIERS[TOTAL_ROUNDS - 1];
      updateBalance(balance + payout);
      endGame();
      showGameOver(true, payout, MULTIPLIERS[TOTAL_ROUNDS - 1]);
    } else {
      showResultBanner(`✅ +${mult}x — Keep going or Cash Out!`, false);
      currentRound++;
      setTimeout(() => {
        clearResultBanner();
        highlightCurrentRound();
        // Scroll to keep current column visible
        scrollToCurrent();
        waitingForChoice = true;
        setChoiceButtons(true);
      }, 1000);
    }
  } else {
    showResultBanner(`❌ ${EMOJIS[compChoice]} beats ${EMOJIS[playerChoice]} — You lost!`, true);
    endGame();
    setTimeout(() => showGameOver(false, 0, 0), 800);
  }
}

function scrollToCurrent() {
  const col = document.getElementById(`roundCol_${currentRound}`);
  if (!col) return;
  col.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────
function updatePayoutDisplay(mult, amount) {
  document.getElementById('currentMultDisplay').textContent  = `${mult}×`;
  document.getElementById('currentPayoutDisplay').textContent = `$${amount.toFixed(2)}`;
}

function showResultBanner(msg, isLose) {
  const banner = document.getElementById('resultBanner');
  banner.textContent = msg;
  banner.className = `result-banner ${isLose ? 'lose' : 'win'}`;
}

function clearResultBanner() {
  const banner = document.getElementById('resultBanner');
  banner.className = 'result-banner';
  banner.textContent = '';
  banner.style.display = 'none';
  setTimeout(() => { banner.style.display = ''; }, 10);
}

function randomBet() {
  if (!gameActive || !waitingForChoice) return;
  playerChoose(CHOICES[Math.floor(Math.random() * 3)]);
}

function cashOut() {
  if (!gameActive) return;
  const mult   = currentRound > 0 ? MULTIPLIERS[currentRound - 1] : 1;
  const payout = currentRound > 0 ? betAmount * mult : betAmount;
  updateBalance(balance + payout);
  endGame();
  showGameOver(true, payout, mult, true);
}

function endGame() {
  gameActive       = false;
  waitingForChoice = false;
  setChoiceButtons(false);
}

function showGameOver(won, amount, mult, cashout = false) {
  const overlay = document.getElementById('gameoverOverlay');
  const box     = document.getElementById('gameoverBox');
  box.className = `gameover-box ${won ? 'win-box' : 'lose-box'}`;
  document.getElementById('gameoverIcon').textContent    = won ? '🏆' : '💔';
  document.getElementById('gameoverTitle').textContent   = cashout ? 'Cashed Out!' : (won ? 'You Won!' : 'You Lost!');
  document.getElementById('gameoverAmount').textContent  = won
    ? `+$${amount.toFixed(2)}`
    : `-$${betAmount.toFixed(2)}`;
  overlay.classList.add('show');
}

function closeGameOver() {
  document.getElementById('gameoverOverlay').classList.remove('show');
  resetToStart();
}

function resetToStart() {
  gameActive       = false;
  currentRound     = 0;
  roundResults     = [];
  waitingForChoice = false;

  document.getElementById('inGamePanel').style.display  = 'none';
  document.getElementById('preGamePanel').style.display = 'block';
  document.getElementById('sidebarBalance').textContent = balance.toFixed(2);

  setChoiceButtons(false);
  buildBracket();
  clearResultBanner();
}

// ─── Init ─────────────────────────────────────────────────────────────────────
buildBracket();
setChoiceButtons(false);
updateBalance(100);