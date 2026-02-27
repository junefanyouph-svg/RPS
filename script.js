// ─── Constants ───────────────────────────────────────────────────────────────
const TOTAL_ROUNDS = 5;
const MULTIPLIERS  = [1.96, 3.92, 7.84, 15.68, 31.36, 62.72];
const CHOICES      = ['rock', 'paper', 'scissors'];
const EMOJIS       = { rock: '✊', paper: '🖐', scissors: '✌️' };

// ─── Game State ───────────────────────────────────────────────────────────────
let balance          = 100.00;
let betAmount        = 0;
let currentRound     = 0;
let roundResults     = [];
let gameActive       = false;
let waitingForChoice = false;
let roundsPlayed     = 0;

// ─── Auto State ───────────────────────────────────────────────────────────────
let autoMode         = false;
let autoRunning      = false;   // true from startAuto → finishAuto (survives between bets)
let autoStrategy     = 'random';
let autoTotalBets    = 10;
let autoBetsPlayed   = 0;
let autoWins         = 0;
let autoLosses       = 0;
let autoTies         = 0;
let autoNetProfit    = 0;
let autoStopOnWin    = false;
let autoStopOnLoss   = true;
let autoStopRequested = false;  // user pressed Stop
let autoStartBalance = 0;
let autoSeq          = 0;       // increments each startAuto/stop cycle — orphan guard

// ─── Tab switching ───────────────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById('tabManual').classList.toggle('active', tab === 'manual');
  document.getElementById('tabAuto').classList.toggle('active', tab === 'auto');
  document.getElementById('manualPanel').style.display = tab === 'manual' ? 'block' : 'none';
  document.getElementById('autoPanel').style.display   = tab === 'auto'   ? 'block' : 'none';
}

// ─── Bracket Builder ─────────────────────────────────────────────────────────
function buildBracket() {
  const track = document.getElementById('bracketTrack');
  track.innerHTML = '';
  for (let r = 0; r < TOTAL_ROUNDS; r++) {
    const col = document.createElement('div');
    col.className = 'round-col';
    col.id = `roundCol_${r}`;

    const badge = document.createElement('div');
    badge.className = 'mult-badge';
    badge.id = `mult_${r}`;
    badge.textContent = `${MULTIPLIERS[r]}x`;
    col.appendChild(badge);

    const pair = document.createElement('div');
    pair.className = 'card-pair';

    // CPU on top
    const compCard = document.createElement('div');
    compCard.className = 'game-card empty';
    compCard.id = `comp_${r}`;
    pair.appendChild(compCard);

    const vs = document.createElement('div');
    vs.className = 'vs-divider';
    vs.textContent = 'VS';
    pair.appendChild(vs);

    // YOU on bottom
    const youLabel = document.createElement('div');
    youLabel.className = 'card-owner-label you-label';
    youLabel.textContent = 'YOU';
    pair.appendChild(youLabel);

    const playerCard = document.createElement('div');
    playerCard.className = 'game-card empty';
    playerCard.id = `player_${r}`;
    pair.appendChild(playerCard);

    col.appendChild(pair);
    track.appendChild(col);

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

    if (r < currentRound)        { col.classList.add('done');   badge.classList.add('passed'); }
    else if (r === currentRound) { col.classList.add('active'); badge.classList.add('active'); }

    if (r < TOTAL_ROUNDS - 1) {
      const conn = document.getElementById(`conn_${r}`);
      if (!conn) continue;
      conn.classList.remove('passed', 'active');
      if (r < currentRound)        conn.classList.add('passed');
      else if (r === currentRound) conn.classList.add('active');
    }
  }
  const pc = document.getElementById(`player_${currentRound}`);
  const cc = document.getElementById(`comp_${currentRound}`);
  if (pc) { pc.className = 'game-card current'; pc.textContent = '?'; }
  if (cc) { cc.className = 'game-card current'; cc.textContent = '?'; }
}

// ─── Bet Controls ─────────────────────────────────────────────────────────────
function halveBet(inputId = 'betInput') {
  const input = document.getElementById(inputId);
  input.value = Math.max(1.00, parseFloat(input.value) / 2).toFixed(2);
}
function doubleBet(inputId = 'betInput') {
  const input = document.getElementById(inputId);
  input.value = (parseFloat(input.value) * 2).toFixed(2);
}

function maxBet(inputId = 'betInput') {
  const input = document.getElementById(inputId);
  input.value = Math.max(1.00, balance).toFixed(2);
}

function updateBalance(newBal) {
  balance = newBal;
  ['balanceDisplay','sidebarBalance','autoSidebarBalance','autoBalanceLive'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = balance.toFixed(2);
  });
}

// ─── Shared round starter ─────────────────────────────────────────────────────
function startRound(amount, isAuto) {
  betAmount        = amount;
  currentRound     = 0;
  roundResults     = [];
  roundsPlayed     = 0;
  gameActive       = true;
  waitingForChoice = true;

  updateBalance(balance - betAmount);

  if (!isAuto) {
    document.getElementById('preGamePanel').style.display = 'none';
    const inGame = document.getElementById('inGamePanel');
    inGame.style.cssText = 'display:flex; flex-direction:column; gap:14px;';
    document.getElementById('betAmountDisplay').textContent = betAmount.toFixed(2);
    updatePayoutDisplay(1, betAmount);
    setCashOutButton(false);
    setChoiceButtons(true);
    clearResultBanner('resultBanner');
  } else {
    setChoiceButtons(false);
  }

  buildBracket();
  highlightCurrentRound();
  document.getElementById('bracketContainer').scrollLeft = 0;
  // Reset current payout to show bet amount (nothing locked in yet)
  const curAmt  = document.getElementById('currentPayoutBar');
  const curMeta = document.getElementById('currentMultBar');
  if (curAmt)  { curAmt.textContent = '$' + betAmount.toFixed(2); curAmt.classList.remove('locked','active','payout-pop'); }
  if (curMeta) { curMeta.textContent = 'Bet placed — win to lock in'; }

  updatePayoutBar(betAmount * MULTIPLIERS[0], MULTIPLIERS[0],
    'Win round 1 to earn ' + MULTIPLIERS[0] + 'x', true);
}

// ─── Manual flow ──────────────────────────────────────────────────────────────
function placeBet() {
  betAmount = parseFloat(document.getElementById('betInput').value);
  if (isNaN(betAmount) || betAmount < 1) {
    showInputError('betInput', 'betError', 'Minimum bet amount is $1.00');
    return;
  }
  if (betAmount > balance) {
    showInputError('betInput', 'betError', 'Not enough balance for this bet');
    return;
  }
  clearInputError('betInput', 'betError');
  closeMobileSidebar();
  startRound(betAmount, false);
}

function setChoiceButtons(enabled) {
  ['btnRock', 'btnPaper', 'btnScissors'].forEach(id => {
    const btn = document.getElementById(id);
    // Never use disabled — it swallows click events so the "place a bet" float won't fire
    btn.classList.toggle('btn-inactive', !enabled);
  });
  const hint = document.getElementById('choiceHint');
  if (hint) hint.textContent = enabled ? '👆 Pick your move' : '⏳ Waiting...';
}

function setCashOutButton(enabled) {
  const btn = document.getElementById('cashOutBtn');
  if (!btn) return;
  btn.disabled = !enabled;
  btn.style.opacity = enabled ? '1' : '0.35';
  btn.style.cursor  = enabled ? 'pointer' : 'not-allowed';
}

function playerChoose(choice) {
  if (!gameActive || !waitingForChoice) {
    if (!gameActive) showNoBetFloat(choice);
    return;
  }
  waitingForChoice = false;
  setChoiceButtons(false);
  setCashOutButton(false); // disable while round is resolving

  const btnMap = { rock: 'btnRock', paper: 'btnPaper', scissors: 'btnScissors' };
  const btn = document.getElementById(btnMap[choice]);
  btn.classList.add('selected');
  setTimeout(() => btn.classList.remove('selected'), 500);

  resolveChoice(choice);
}

function resolveChoice(choice) {
  const compChoice = CHOICES[Math.floor(Math.random() * 3)];
  const result     = getResult(choice, compChoice);
  roundResults.push({ player: choice, computer: compChoice, result });

  const playerCard = document.getElementById(`player_${currentRound}`);
  const compCard   = document.getElementById(`comp_${currentRound}`);

  // Step 1 — Player reveals their hand first (200ms)
  setTimeout(() => {
    playerCard.textContent = EMOJIS[choice];
    playerCard.className = 'game-card player-revealed reveal-anim';
    // CPU card shows suspense while player's hand is visible
    compCard.textContent = '⏳';
    compCard.className = 'game-card cpu-waiting';
    const hint = document.getElementById('choiceHint');
    if (hint) hint.textContent = '👀 CPU is thinking...';
  }, 200);

  // Step 2 — CPU reveals (950ms — clear suspense gap after player)
  setTimeout(() => {
    compCard.textContent = EMOJIS[compChoice];
    compCard.className = 'game-card reveal-anim';
    const hint = document.getElementById('choiceHint');
    if (hint) hint.textContent = '⚡ Result incoming...';
  }, 950);

  // Step 3 — Apply win/lose colours + bounce on tie (1300ms)
  setTimeout(() => {
    playerCard.className = `game-card ${result === 'win' ? 'win win-anim' : result === 'lose' ? 'lose' : 'empty'} reveal-anim`;
    compCard.className   = `game-card ${result === 'win' ? 'lose' : result === 'lose' ? 'win' : 'empty'} reveal-anim`;

    if (result === 'tie') {
      compCard.className = 'game-card tie';
      void compCard.offsetWidth;
      compCard.className = 'game-card tie card-bounce';
      playerCard.className = 'game-card tie';
      void playerCard.offsetWidth;
      playerCard.className = 'game-card tie card-bounce';
    }
    const hint = document.getElementById('choiceHint');
    if (hint) hint.textContent = result === 'win' ? '🏆 You won this round!' : result === 'lose' ? '💔 CPU wins this round' : '🤝 Tie!';
    if (autoMode) processAutoRoundResult(result, choice, compChoice);
    else          processRoundResult(result, choice, compChoice);
  }, 1300);
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

// ─── Manual result handling ───────────────────────────────────────────────────
function processRoundResult(result, playerChoice, compChoice) {
  if (result === 'tie') {
    redoResultBanner('🤝 Tie! Play again...', 'resultBanner');
    waitingForChoice = true;
    setChoiceButtons(true);
    return;
  }
  roundsPlayed++;

  if (result === 'win') {
    const wonRounds = currentRound + 1;
    const mult = MULTIPLIERS[wonRounds - 1];
    updatePayoutDisplay(mult, betAmount * mult);
    setCashOutButton(true);

    const conn = document.getElementById(`conn_${currentRound}`);
    if (conn) { conn.classList.remove('active'); conn.classList.add('passed'); }

    if (wonRounds >= TOTAL_ROUNDS) {
      const payout = betAmount * MULTIPLIERS[TOTAL_ROUNDS - 1];
      updateBalance(balance + payout);
      endGame();
      showFloatingPayout(currentRound, payout);
      updatePayoutBar(payout, MULTIPLIERS[TOTAL_ROUNDS - 1], '🏆 Full bracket won!', true);
      showGameOver(true, payout, MULTIPLIERS[TOTAL_ROUNDS - 1]);
    } else {
      showResultBanner('✅ +' + mult + 'x — Keep going or Cash Out!', false, 'resultBanner');
      showFloatingPayout(currentRound, betAmount * mult);
      currentRound++;
      const nextMult = MULTIPLIERS[currentRound];
      updatePayoutBar(betAmount * nextMult, nextMult,
        'Win round ' + (currentRound + 1) + ' to earn ' + nextMult + 'x', true);
      setTimeout(() => {
        clearResultBanner('resultBanner');
        highlightCurrentRound();
        scrollToCurrent();
        waitingForChoice = true;
        setChoiceButtons(true);
      }, 1000);
    }
  } else {
    showResultBanner('❌ ' + EMOJIS[compChoice] + ' beats ' + EMOJIS[playerChoice] + ' — You lost!', true, 'resultBanner');
    endGame();
    updatePayoutBar(null, 0, '❌ Better luck next time', false);
    setTimeout(() => showGameOver(false, 0, 0), 800);
  }
}

function scrollToCurrent() {
  const col = document.getElementById(`roundCol_${currentRound}`);
  if (!col) return;
  col.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function updatePayoutDisplay(mult, amount) {
  // Update the "Current Payout" side of the top bar
  const amountEl = document.getElementById('currentPayoutBar');
  const metaEl   = document.getElementById('currentMultBar');
  if (!amountEl || !metaEl) return;

  amountEl.classList.remove('payout-pop', 'locked', 'active');
  void amountEl.offsetWidth;
  amountEl.textContent = '$' + amount.toFixed(2);
  amountEl.classList.add('locked', 'payout-pop');
  metaEl.textContent = mult + '× locked in';
}

function showResultBanner(msg, isLose, bannerId = 'resultBanner') {
  const banner = document.getElementById(bannerId);
  if (!banner) return;
  banner.textContent = msg;
  banner.className = `result-banner ${isLose ? 'lose' : 'win'}`;
}

function clearResultBanner(bannerId = 'resultBanner') {
  const banner = document.getElementById(bannerId);
  if (!banner) return;
  banner.className = 'result-banner';
  banner.textContent = '';
  banner.style.display = 'none';
  setTimeout(() => { banner.style.display = ''; }, 10);
}

function redoResultBanner(msg, bannerId = 'resultBanner') {
  const banner = document.getElementById(bannerId);
  if (!banner) return;
  banner.className = 'result-banner';
  banner.textContent = '';
  void banner.offsetWidth;
  banner.textContent = msg;
  banner.className = 'result-banner win tie-pop';
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
  showToast('💰 Cashed out +$' + payout.toFixed(2) + ' (' + mult + 'x)', 'win');
  setTimeout(() => resetToStart(), 1800);
}

function endGame() {
  gameActive       = false;
  waitingForChoice = false;
  setChoiceButtons(false);
}

function showGameOver(won, amount, mult, cashout = false) {
  if (won) {
    const label = cashout ? '💰 Cashed out' : '🏆 You won';
    showToast(label + ' +$' + amount.toFixed(2) + ' (' + mult + 'x)', 'win');
  } else {
    showToast('💔 You lost -$' + betAmount.toFixed(2), 'lose');
  }
  setTimeout(() => resetToStart(), 2200);
}

function closeGameOver() {
  if (autoRunning) resetAutoToConfig();
  else resetToStart();
}

function resetToStart() {
  gameActive       = false;
  currentRound     = 0;
  roundResults     = [];
  roundsPlayed     = 0;
  waitingForChoice = false;

  document.getElementById('inGamePanel').style.display  = 'none';
  document.getElementById('preGamePanel').style.display = 'block';
  document.getElementById('sidebarBalance').textContent = balance.toFixed(2);

  setChoiceButtons(false);
  buildBracket();
  clearResultBanner('resultBanner');
  resetPayoutBar();
}

// ─── AUTO MODE ────────────────────────────────────────────────────────────────
function setStrategy(s) {
  autoStrategy = s;
  ['random','rock','paper','scissors'].forEach(k => {
    document.getElementById(`strat_${k}`).classList.toggle('active', k === s);
  });
}

function startAuto() {
  const amt = parseFloat(document.getElementById('autoBetInput').value);
  if (isNaN(amt) || amt < 1) {
    showInputError('autoBetInput', 'autoBetError', 'Minimum bet amount is $1.00');
    return;
  }
  if (amt > balance) {
    showInputError('autoBetInput', 'autoBetError', 'Not enough balance for this bet');
    return;
  }
  clearInputError('autoBetInput', 'autoBetError');

  autoTotalBets     = Math.max(1, parseInt(document.getElementById('autoRoundsInput').value) || 10);
  autoStopOnWin     = document.getElementById('stopOnWin').checked;
  autoStopOnLoss    = document.getElementById('stopOnLose').checked;
  betAmount         = amt;
  autoBetsPlayed    = 0;
  autoWins          = 0;
  autoLosses        = 0;
  autoTies          = 0;
  autoNetProfit     = 0;
  autoStopRequested = false;
  autoStartBalance  = balance;
  autoMode          = true;
  autoRunning       = true;
  autoSeq++;                    // invalidate any orphaned callbacks from a previous run

  document.getElementById('autoConfigPanel').style.display    = 'none';
  const runPanel = document.getElementById('autoRunPanel');
  runPanel.style.display        = 'flex';
  runPanel.style.flexDirection  = 'column';
  runPanel.style.gap            = '14px';

  updateAutoStats();
  runNextAutoBet(autoSeq);
}

function stopAuto() {
  autoStopRequested = true;
  document.getElementById('stopAutoBtn').disabled = true;
  document.getElementById('stopAutoBtn').textContent = '⏳ Stopping...';
  // If we're between bets (not mid-game), finish immediately
  if (!gameActive) {
    finishAuto();
  }
  // Otherwise finishAuto() will be called at the end of the current game
}

function runNextAutoBet(seq) {
  // Orphan guard — if seq doesn't match current run, bail silently
  if (seq !== autoSeq) return;
  if (autoStopRequested || autoBetsPlayed >= autoTotalBets || balance < betAmount) {
    finishAuto();
    return;
  }
  updateAutoStats();
  startRound(betAmount, true);
  // Small delay so the bracket renders before auto picks
  setTimeout(() => autoPickChoice(seq), 600);
}

function autoPickChoice(seq) {
  if (seq !== autoSeq) return;
  if (!gameActive || !waitingForChoice) return;
  waitingForChoice = false;

  const choice = autoStrategy === 'random'
    ? CHOICES[Math.floor(Math.random() * 3)]
    : autoStrategy;

  const btnMap = { rock: 'btnRock', paper: 'btnPaper', scissors: 'btnScissors' };
  const btn = document.getElementById(btnMap[choice]);
  btn.classList.add('selected');
  setTimeout(() => btn.classList.remove('selected'), 500);

  resolveChoice(choice);
}

function processAutoRoundResult(result, playerChoice, compChoice) {
  const seq = autoSeq; // capture at time of call

  if (result === 'tie') {
    autoTies++;
    updateAutoStats();
    redoResultBanner('🤝 Tie! Replaying...', 'autoResultBanner');
    // Re-enable waitingForChoice then pick again
    setTimeout(() => {
      if (seq !== autoSeq) return;
      waitingForChoice = true;
      autoPickChoice(seq);
    }, 900);
    return;
  }

  if (result === 'win') {
    const wonRounds = currentRound + 1;
    const conn = document.getElementById(`conn_${currentRound}`);
    if (conn) { conn.classList.remove('active'); conn.classList.add('passed'); }

    if (wonRounds >= TOTAL_ROUNDS) {
      // Full bracket win
      const payout = betAmount * MULTIPLIERS[TOTAL_ROUNDS - 1];
      autoNetProfit += payout - betAmount;
      autoWins++;
      autoBetsPlayed++;
      updateBalance(balance + payout);
      updateAutoStats();
      showFloatingPayout(currentRound, payout);
      showResultBanner('🏆 +' + MULTIPLIERS[TOTAL_ROUNDS-1] + 'x — Full win!', false, 'autoResultBanner');
      endGame();

      const shouldStop = autoStopRequested || autoStopOnWin || autoBetsPlayed >= autoTotalBets || balance < betAmount;
      setTimeout(() => {
        if (seq !== autoSeq) return;
        clearResultBanner('autoResultBanner');
        if (shouldStop) finishAuto();
        else runNextAutoBet(seq);
      }, 1200);

    } else {
      // Won this round — continue to next round automatically
      showFloatingPayout(currentRound, betAmount * mult);
      currentRound++;
      highlightCurrentRound();
      scrollToCurrent();
      showResultBanner('✅ Round ' + wonRounds + ' won — continuing...', false, 'autoResultBanner');
      setTimeout(() => {
        if (seq !== autoSeq) return;
        clearResultBanner('autoResultBanner');
        waitingForChoice = true;
        setTimeout(() => autoPickChoice(seq), 400);
      }, 800);
    }

  } else {
    // Lost this game
    autoNetProfit -= betAmount;
    autoLosses++;
    autoBetsPlayed++;
    updateAutoStats();
    showResultBanner('❌ ' + EMOJIS[compChoice] + ' beats ' + EMOJIS[playerChoice] + ' — Lost $' + betAmount.toFixed(2), true, 'autoResultBanner');
    endGame();

    const shouldStop = autoStopRequested || autoStopOnLoss || autoBetsPlayed >= autoTotalBets || balance < betAmount;
    setTimeout(() => {
      if (seq !== autoSeq) return;
      clearResultBanner('autoResultBanner');
      if (shouldStop) finishAuto();
      else runNextAutoBet(seq);
    }, 1200);
  }
}

function updateAutoStats() {
  document.getElementById('autoWins').textContent    = autoWins;
  document.getElementById('autoLosses').textContent  = autoLosses;
  document.getElementById('autoTies').textContent    = autoTies;

  const remaining = autoTotalBets - autoBetsPlayed;
  document.getElementById('autoCurrentRound').textContent =
    autoBetsPlayed + ' / ' + autoTotalBets + ' (' + remaining + ' left)';

  const netEl = document.getElementById('autoNetDisplay');
  netEl.textContent = (autoNetProfit >= 0 ? '+' : '') + '$' + Math.abs(autoNetProfit).toFixed(2);
  netEl.className   = 'payout-amount ' + (autoNetProfit >= 0 ? 'profit' : 'loss');

  document.getElementById('autoBalanceLive').textContent = balance.toFixed(2);
}

function finishAuto() {
  autoMode    = false;
  // keep autoRunning = true so closeGameOver routes back to auto config
  gameActive       = false;
  waitingForChoice = false;
  autoSeq++;        // kill any remaining callbacks
  setChoiceButtons(false);

  const won = autoNetProfit >= 0;
  const sign = autoNetProfit >= 0 ? '+' : '-';
  showToast(
    (won ? '📊 Auto done: ' : '📉 Auto done: ') + sign + '$' + Math.abs(autoNetProfit).toFixed(2) +
    '  (' + autoWins + 'W / ' + autoLosses + 'L)',
    won ? 'win' : 'lose'
  );
  setTimeout(() => resetAutoToConfig(), 2500);
}

function resetAutoToConfig() {
  autoMode    = false;
  autoRunning = false;

  const stopBtn = document.getElementById('stopAutoBtn');
  if (stopBtn) { stopBtn.disabled = false; stopBtn.textContent = '⏹ Stop Auto'; }

  document.getElementById('autoRunPanel').style.display    = 'none';
  document.getElementById('autoConfigPanel').style.display = 'block';
  document.getElementById('autoSidebarBalance').textContent = balance.toFixed(2);
  setChoiceButtons(false);
  buildBracket();
  clearResultBanner('autoResultBanner');
  resetPayoutBar();
}

// ─── Payout Bar ──────────────────────────────────────────────────────────────
function updatePayoutBar(amount, mult, meta, isActive) {
  const amountEl = document.getElementById('payoutBarAmount');
  const metaEl   = document.getElementById('payoutBarMeta');
  if (!amountEl || !metaEl) return;

  const formatted = amount != null ? '$' + amount.toFixed(2) : '—';

  // Pop animation — strip then reapply
  amountEl.classList.remove('payout-pop', 'active');
  void amountEl.offsetWidth;
  amountEl.textContent = formatted;
  if (isActive) {
    amountEl.classList.add('active', 'payout-pop');
  }

  metaEl.textContent = meta || '';
}

function resetPayoutBar() {
  const potAmt  = document.getElementById('payoutBarAmount');
  const potMeta = document.getElementById('payoutBarMeta');
  const curAmt  = document.getElementById('currentPayoutBar');
  const curMeta = document.getElementById('currentMultBar');

  if (potAmt)  { potAmt.textContent = '—';  potAmt.classList.remove('active', 'payout-pop'); }
  if (potMeta) { potMeta.textContent = 'Place a bet to start'; }
  if (curAmt)  { curAmt.textContent = '—';  curAmt.classList.remove('locked', 'active', 'payout-pop'); }
  if (curMeta) { curMeta.textContent = 'No active bet'; }
}

// ─── Toast Notification ──────────────────────────────────────────────────────
function showToast(msg, type = 'win') {
  // Remove any existing toast first
  const existing = document.getElementById('gameToast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'gameToast';
  toast.className = 'game-toast game-toast-' + type;
  toast.textContent = msg;
  document.getElementById('bracketContainer').prepend(toast);

  // Auto remove after animation
  toast.addEventListener('animationend', () => toast.remove());
}

// ─── Floating Payout Text ────────────────────────────────────────────────────
function showFloatingPayout(roundIndex, amount) {
  const badge = document.getElementById('mult_' + roundIndex);
  if (!badge) return;

  const el = document.createElement('div');
  el.className = 'floating-payout';
  el.textContent = '+$' + amount.toFixed(2);

  // Position relative to the badge
  const badgeRect = badge.getBoundingClientRect();
  el.style.left = (badgeRect.left + badgeRect.width / 2) + 'px';
  el.style.top  = (badgeRect.top + window.scrollY) + 'px';
  document.body.appendChild(el);

  // Auto-remove after animation completes
  el.addEventListener('animationend', () => el.remove());
}

// ─── No Bet Float ────────────────────────────────────────────────────────────
function showNoBetFloat(choice) {
  const btnMap = { rock: 'btnRock', paper: 'btnPaper', scissors: 'btnScissors' };
  const btn = document.getElementById(btnMap[choice]);
  if (!btn) return;

  // Don't stack duplicates
  if (document.querySelector('.no-bet-float')) return;

  const rect = btn.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'no-bet-float';
  el.textContent = '⚠ Place a bet first!';
  el.style.left = (rect.left + rect.width / 2) + 'px';
  el.style.top  = (rect.top + window.scrollY) + 'px';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

// ─── Mobile Sidebar ──────────────────────────────────────────────────────────
function toggleMobileSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('mobileSidebarBackdrop');
  const isOpen   = sidebar.classList.contains('mobile-open');
  if (isOpen) closeMobileSidebar();
  else        openMobileSidebar();
}

function openMobileSidebar() {
  document.getElementById('sidebar').classList.add('mobile-open');
  document.getElementById('mobileSidebarBackdrop').classList.add('show');
}

function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('mobileSidebarBackdrop').classList.remove('show');
}

// ─── Input Error Helpers ─────────────────────────────────────────────────────
function showInputError(inputId, errorId, message) {
  const input = document.getElementById(inputId);
  const err   = document.getElementById(errorId);
  if (!input || !err) return;

  err.textContent = '⚠ ' + message;
  err.classList.add('show');
  input.classList.remove('input-shake', 'input-invalid');
  // Force reflow so shake restarts if already showing
  void input.offsetWidth;
  input.classList.add('input-shake', 'input-invalid');
  input.addEventListener('animationend', () => input.classList.remove('input-shake'), { once: true });
}

function clearInputError(inputId, errorId) {
  const input = document.getElementById(inputId);
  const err   = document.getElementById(errorId);
  if (input) input.classList.remove('input-invalid', 'input-shake');
  if (err)   err.classList.remove('show');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
buildBracket();
setChoiceButtons(false);
updateBalance(100);