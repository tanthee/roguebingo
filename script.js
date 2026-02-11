const CONFIG = {
  initialBoardSize: 5,
  minBoardSize: 3,
  maxBoardSize: 12,
  initialTurns: 30,
  perkInterval: 5,
  turnBonusPerLine: 2,
  turnBonusPerHit: 1,
  maxLogEntries: 18,
  initialNumberMax: 75,
  numberRangeExpand: 15,
  drawSpinMs: 760,
  drawRevealMs: 820,
  maxRollsPerDraw: 6,
};

const PERKS = [
  {
    id: "column_up",
    name: "列増加",
    description: "盤面を1段階拡張し、抽選範囲を拡大します（最大12x12）。",
  },
  {
    id: "column_down",
    name: "列減少",
    description: "盤面を1段階縮小し、抽選範囲を拡大します。",
  },
  {
    id: "no_prime",
    name: "素数禁止",
    description: "素数が出た場合は自動で再抽選します。",
  },
  {
    id: "no_perfect",
    name: "完全数禁止",
    description: "完全数が出た場合は自動で再抽選します。",
  },
  {
    id: "negative_unlock",
    name: "負数開放",
    description: "抽選に負数が含まれます。拡張マスに負数が出現します。",
  },
  {
    id: "absolute_lock",
    name: "絶対値判定",
    description: "数字一致ではなく絶対値一致でマスを開きます。",
  },
  {
    id: "multi_roll",
    name: "多重抽選",
    description: "1回の抽選で出る数字が +1 されます（重複可）。",
  },
  {
    id: "hit_turn_boost",
    name: "採掘効率",
    description: "穴が開くたびに得られる回数ボーナスが +1 されます。",
  },
  {
    id: "guided_aim",
    name: "狙い撃ち",
    description: "一定確率で未開放マスの数字を直接引き当てます。",
  },
  {
    id: "miss_refund",
    name: "ハズレ保険",
    description: "1回の抽選で全ハズレなら回数を払い戻します。",
  },
  {
    id: "hit_score_boost",
    name: "掘削倍率",
    description: "穴あき時のスコアが増加します。",
  },
  {
    id: "bingo_score_boost",
    name: "列共鳴",
    description: "ビンゴ成立時のスコアが増加します。",
  },
  {
    id: "seven_fever",
    name: "セブンフィーバー",
    description: "7の倍数で穴が開くと追加スコアを獲得します。",
  },
  {
    id: "combo_drive",
    name: "コンボドライブ",
    description: "連続ヒット抽選が続くほど追加スコアが増えます。",
  },
  {
    id: "burst_chain",
    name: "バースト連鎖",
    description: "同一抽選で2ヒット以上すると追加スコアを獲得します。",
  },
];

const RANK_TABLE = [
  { rank: "S", min: 26000 },
  { rank: "A", min: 18000 },
  { rank: "B", min: 12000 },
  { rank: "C", min: 7600 },
  { rank: "D", min: 4200 },
  { rank: "E", min: 0 },
];

const state = {
  boardSize: CONFIG.initialBoardSize,
  numberRange: {
    min: 1,
    max: CONFIG.initialNumberMax,
  },
  board: [],
  lines: [],
  completedLineIndexes: new Set(),
  perkCounts: {},
  logs: [],
  turnsLeft: CONFIG.initialTurns,
  drawCount: 0,
  bingoLines: 0,
  score: 0,
  lastRolls: [],
  comboStreak: 0,
  waitingPerkChoice: false,
  drawInProgress: false,
  gameOver: false,
};

const elements = {
  board: document.getElementById("board"),
  turns: document.getElementById("turns"),
  score: document.getElementById("score"),
  rank: document.getElementById("rank"),
  roll: document.getElementById("roll"),
  boardSize: document.getElementById("board-size"),
  drawRange: document.getElementById("draw-range"),
  rollsPerDraw: document.getElementById("rolls-per-draw"),
  drawBtn: document.getElementById("draw-btn"),
  restartBtn: document.getElementById("restart-btn"),
  logList: document.getElementById("log-list"),
  activePerks: document.getElementById("active-perks"),
  result: document.getElementById("result"),
  resultScore: document.getElementById("result-score"),
  resultRank: document.getElementById("result-rank"),
  resultLines: document.getElementById("result-lines"),
  resultEnd: document.getElementById("result-end"),
  shareLink: document.getElementById("share-link"),
  perkModal: document.getElementById("perk-modal"),
  perkOptions: document.getElementById("perk-options"),
  drawModal: document.getElementById("draw-modal"),
  drawWindowTitle: document.getElementById("draw-window-title"),
  drawWindowNumber: document.getElementById("draw-window-number"),
  drawWindowTrace: document.getElementById("draw-window-trace"),
};

function init() {
  elements.drawBtn.addEventListener("click", onDraw);
  elements.restartBtn.addEventListener("click", startGame);
  startGame();
}

function startGame() {
  state.boardSize = CONFIG.initialBoardSize;
  state.numberRange = {
    min: 1,
    max: CONFIG.initialNumberMax,
  };
  state.board = buildFreshBoard(state.boardSize);
  state.lines = createLines(state.boardSize);
  state.completedLineIndexes = new Set();
  state.perkCounts = {};
  state.logs = [];
  state.turnsLeft = CONFIG.initialTurns;
  state.drawCount = 0;
  state.bingoLines = 0;
  state.score = 0;
  state.lastRolls = [];
  state.comboStreak = 0;
  state.waitingPerkChoice = false;
  state.drawInProgress = false;
  state.gameOver = false;

  elements.result.classList.add("hidden");
  elements.perkModal.classList.add("hidden");
  elements.drawModal.classList.add("hidden");
  elements.drawBtn.disabled = false;
  elements.restartBtn.disabled = false;

  pushLog("ゲーム開始。ハイスコアを狙ってください。");
  renderBoard();
  renderStatus();
  renderPerkList();
  renderLogs();
}

async function onDraw() {
  if (state.gameOver || state.waitingPerkChoice || state.drawInProgress) {
    return;
  }

  state.drawInProgress = true;
  elements.drawBtn.disabled = true;
  elements.restartBtn.disabled = true;

  state.turnsLeft -= 1;
  state.drawCount += 1;

  const rollBatch = generateRollBatchWithTrace(getRollsPerDraw());
  await showDrawWindow(rollBatch);
  state.lastRolls = [...rollBatch.values];

  const drawOutcome = resolveRollBatch(rollBatch.values);
  applyDrawSummaryPerks(drawOutcome);

  const allOpened = state.board.every((cell) => cell.opened);
  if (allOpened || state.turnsLeft <= 0) {
    endGame(allOpened ? "all-open" : "no-turns");
    renderStatus();
    renderPerkList();
    renderLogs();
    renderBoard();
    finishDrawPhase();
    return;
  }

  if (state.drawCount % CONFIG.perkInterval === 0) {
    presentPerkChoices();
  }

  renderStatus();
  renderPerkList();
  renderLogs();
  renderBoard();
  finishDrawPhase();
}

function finishDrawPhase() {
  state.drawInProgress = false;
  elements.restartBtn.disabled = false;
  if (!state.gameOver && !state.waitingPerkChoice) {
    elements.drawBtn.disabled = false;
  }
}

function generateRollBatchWithTrace(rollCount) {
  const values = [];
  const trace = [];

  for (let i = 0; i < rollCount; i += 1) {
    const single = generateSingleRollWithTrace(i + 1);
    values.push(single.value);
    trace.push(single.summary);
  }

  return {
    values,
    trace,
  };
}

function generateSingleRollWithTrace(slot) {
  const maxAttempts = 60;
  let rejectedPrime = 0;
  let rejectedPerfect = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const guidedCandidate = maybePickGuidedCandidate();
    const source = guidedCandidate !== null ? "狙い撃ち" : "通常";
    const candidate = guidedCandidate !== null ? guidedCandidate : drawRandomCandidate();

    if (getPerkCount("no_prime") > 0 && isPrime(Math.abs(candidate))) {
      rejectedPrime += 1;
      continue;
    }

    if (getPerkCount("no_perfect") > 0 && isPerfectNumber(Math.abs(candidate))) {
      rejectedPerfect += 1;
      continue;
    }

    return {
      value: candidate,
      summary: `抽選${slot}: ${formatNumber(candidate)} (${source} / 試行${attempt} / 素数棄却${rejectedPrime} / 完全数棄却${rejectedPerfect})`,
    };
  }

  const fallback = drawRandomCandidate();
  return {
    value: fallback,
    summary: `抽選${slot}: ${formatNumber(fallback)} (候補上限到達)`,
  };
}

function maybePickGuidedCandidate() {
  const perkCount = getPerkCount("guided_aim");
  if (perkCount <= 0) {
    return null;
  }

  const chance = Math.min(0.18 * perkCount, 0.72);
  if (Math.random() >= chance) {
    return null;
  }

  const candidates = state.board
    .filter((cell) => !cell.opened)
    .map((cell) => cell.number)
    .filter((number) => passesRollRestrictions(number));

  if (candidates.length === 0) {
    return null;
  }

  return candidates[randomInt(0, candidates.length - 1)];
}

function passesRollRestrictions(value) {
  if (getPerkCount("no_prime") > 0 && isPrime(Math.abs(value))) {
    return false;
  }
  if (getPerkCount("no_perfect") > 0 && isPerfectNumber(Math.abs(value))) {
    return false;
  }
  return true;
}

async function showDrawWindow(rollBatch) {
  elements.drawModal.classList.remove("hidden");
  elements.drawWindowTitle.textContent = `抽選中 x${rollBatch.values.length}`;
  elements.drawWindowTrace.textContent = "数字を回しています...";

  const ticker = setInterval(() => {
    const preview = [];
    for (let i = 0; i < rollBatch.values.length; i += 1) {
      preview.push(formatNumber(drawRandomCandidate()));
    }
    elements.drawWindowNumber.textContent = preview.join(" / ");
  }, 80);

  await sleep(CONFIG.drawSpinMs);
  clearInterval(ticker);

  const finalText = rollBatch.values.map((value) => formatNumber(value)).join(" / ");
  elements.drawWindowNumber.textContent = finalText;
  elements.drawWindowTrace.textContent = `${rollBatch.trace.slice(-5).join("\n")}\n最終: ${finalText}`;

  await sleep(CONFIG.drawRevealMs);
  elements.drawModal.classList.add("hidden");
}

function resolveRollBatch(rollValues) {
  let hitCount = 0;
  const missValues = [];

  rollValues.forEach((roll) => {
    const outcome = openCellByRoll(roll);
    if (outcome.hit) {
      hitCount += 1;
      return;
    }

    missValues.push(roll);
  });

  if (missValues.length === 1) {
    pushLog(`出目 ${formatNumber(missValues[0])}：ハズレ`);
  } else if (missValues.length > 1) {
    pushLog(`ハズレ: ${missValues.map((value) => formatNumber(value)).join(", ")}`);
  }

  return {
    hitCount,
    missValues,
    rollCount: rollValues.length,
  };
}

function applyDrawSummaryPerks(drawOutcome) {
  if (drawOutcome.hitCount > 0) {
    state.comboStreak += 1;
  } else {
    state.comboStreak = 0;
  }

  const refundPerk = getPerkCount("miss_refund");
  if (drawOutcome.hitCount === 0 && refundPerk > 0) {
    state.turnsLeft += refundPerk;
    pushLog(`ハズレ保険で回数 +${refundPerk}`);
  }

  const burstPerk = getPerkCount("burst_chain");
  if (burstPerk > 0 && drawOutcome.hitCount >= 2) {
    const burstBonus = Math.floor((drawOutcome.hitCount - 1) * 140 * burstPerk);
    state.score += burstBonus;
    pushLog(`バースト連鎖ボーナス +${burstBonus}`);
  }

  const comboPerk = getPerkCount("combo_drive");
  if (comboPerk > 0 && state.comboStreak >= 2 && drawOutcome.hitCount > 0) {
    const comboBonus = Math.floor((40 + drawOutcome.hitCount * 25) * state.comboStreak * comboPerk);
    state.score += comboBonus;
    pushLog(`コンボドライブ ${state.comboStreak}連続: +${comboBonus}`);
  }
}

function openCellByRoll(roll) {
  const index = findMatchCellIndex(roll);

  if (index === -1) {
    return { hit: false };
  }

  const cell = state.board[index];
  cell.opened = true;

  const hitScore = calcHitScore(cell.number);
  state.score += hitScore;

  const hitTurnGain = calcHitTurnGain();
  state.turnsLeft += hitTurnGain;
  pushLog(`出目 ${formatNumber(roll)}：${formatNumber(cell.number)} が開いた (+${hitScore}, 回数+${hitTurnGain})`);

  const sevenPerk = getPerkCount("seven_fever");
  if (sevenPerk > 0 && Math.abs(roll) % 7 === 0) {
    const sevenBonus = Math.floor((100 + Math.abs(roll) * 2) * sevenPerk);
    state.score += sevenBonus;
    pushLog(`セブンフィーバー発動 (+${sevenBonus})`);
  }

  const newLineIndexes = findNewCompletedLineIndexes();
  if (newLineIndexes.length > 0) {
    newLineIndexes.forEach((lineIndex) => state.completedLineIndexes.add(lineIndex));
    updateCompletedLineMarks();

    const lineCount = newLineIndexes.length;
    state.bingoLines += lineCount;

    const bingoScore = calcBingoScore(lineCount, roll, state.boardSize);
    state.score += bingoScore;

    const turnGain = lineCount * calcTurnGainPerBingoLine();
    state.turnsLeft += turnGain;

    pushLog(`ビンゴ ${lineCount}列成立！ (+${bingoScore}, 回数+${turnGain})`);
  }

  return {
    hit: true,
    index,
  };
}

function findMatchCellIndex(roll) {
  if (getPerkCount("absolute_lock") > 0) {
    const targetAbs = Math.abs(roll);
    return state.board.findIndex((cell) => !cell.opened && Math.abs(cell.number) === targetAbs);
  }

  return state.board.findIndex((cell) => !cell.opened && cell.number === roll);
}

function findNewCompletedLineIndexes() {
  syncLinesWithBoardSize();
  const indexes = [];

  state.lines.forEach((line, lineIndex) => {
    if (state.completedLineIndexes.has(lineIndex)) {
      return;
    }

    const isComplete = line.every((cellIndex) => state.board[cellIndex].opened);
    if (isComplete) {
      indexes.push(lineIndex);
    }
  });

  return indexes;
}

function updateCompletedLineMarks() {
  syncLinesWithBoardSize();
  state.board.forEach((cell) => {
    cell.inCompletedLine = false;
  });

  state.completedLineIndexes.forEach((lineIndex) => {
    state.lines[lineIndex].forEach((cellIndex) => {
      if (state.board[cellIndex]) {
        state.board[cellIndex].inCompletedLine = true;
      }
    });
  });
}

function presentPerkChoices() {
  const choices = pickRandomPerks(3);
  state.waitingPerkChoice = true;
  elements.drawBtn.disabled = true;
  elements.perkOptions.innerHTML = "";

  choices.forEach((perk) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "perk-option";
    button.innerHTML = `<strong>${perk.name}</strong><span>${perk.description}</span>`;
    button.addEventListener("click", () => {
      applyPerk(perk.id);
      state.waitingPerkChoice = false;
      elements.perkModal.classList.add("hidden");

      if (!state.gameOver) {
        const allOpened = state.board.every((cell) => cell.opened);
        if (allOpened) {
          endGame("all-open");
        }
      }

      renderBoard();
      renderPerkList();
      renderStatus();
      renderLogs();

      if (!state.gameOver && !state.drawInProgress) {
        elements.drawBtn.disabled = false;
      }
    });
    elements.perkOptions.appendChild(button);
  });

  elements.perkModal.classList.remove("hidden");
  pushLog("パーク選択：3つから1つ選択");
}

function applyPerk(perkId) {
  state.perkCounts[perkId] = getPerkCount(perkId) + 1;
  const perk = PERKS.find((item) => item.id === perkId);
  pushLog(`パーク取得：${perk.name}`);

  switch (perkId) {
    case "column_up":
      applyResizePerk(1);
      break;
    case "column_down":
      applyResizePerk(-1);
      break;
    case "negative_unlock":
      if (state.perkCounts[perkId] === 1) {
        state.numberRange.min = -state.numberRange.max;
        const converted = seedNegativeNumbersInExpandedCells();
        pushLog(`負数が抽選対象に追加されました (${formatRange()})`);
        if (converted > 0) {
          pushLog(`拡張マス ${converted} 個が負数マスに変化`);
        }
      }
      break;
    case "multi_roll":
      pushLog(`抽選数/回が ${getRollsPerDraw()} になりました`);
      break;
    case "hit_turn_boost":
      pushLog(`穴あき時の回数ボーナスが +${calcHitTurnGain()} になりました`);
      break;
    case "guided_aim":
      pushLog(`狙い撃ち確率が上昇しました`);
      break;
    case "miss_refund":
      pushLog(`全ハズレ時の払い戻しが +${getPerkCount("miss_refund")} になりました`);
      break;
    default:
      break;
  }
}

function applyResizePerk(delta) {
  const before = state.boardSize;
  const next = clamp(before + delta, CONFIG.minBoardSize, CONFIG.maxBoardSize);

  expandNumberRange();

  if (next !== before) {
    resizeBoard(next);
    pushLog(`盤面サイズ ${before}x${before} -> ${next}x${next}`);
  } else {
    pushLog("盤面サイズは上限/下限に到達しているため変更なし");
  }

  pushLog(`抽選範囲拡大: ${formatRange()}`);
}

function expandNumberRange() {
  state.numberRange.max += CONFIG.numberRangeExpand;
  state.numberRange.min = isNegativeUnlocked() ? -state.numberRange.max : 1;
}

function resizeBoard(newSize) {
  const oldSize = state.boardSize;
  const oldBoard = state.board;
  const nextBoard = [];

  for (let row = 0; row < newSize; row += 1) {
    for (let col = 0; col < newSize; col += 1) {
      if (row < oldSize && col < oldSize) {
        const oldCell = oldBoard[row * oldSize + col];
        nextBoard.push({
          ...oldCell,
          inCompletedLine: false,
          isExpanded: isExpandedCell(row, col),
        });
      } else {
        nextBoard.push(null);
      }
    }
  }

  const usedNumbers = new Set(nextBoard.filter(Boolean).map((cell) => cell.number));
  for (let i = 0; i < nextBoard.length; i += 1) {
    if (nextBoard[i]) {
      continue;
    }

    const row = Math.floor(i / newSize);
    const col = i % newSize;
    const expanded = isExpandedCell(row, col);
    const number = createRandomUniqueNumber(usedNumbers, expanded);
    usedNumbers.add(number);

    nextBoard[i] = {
      number,
      opened: false,
      inCompletedLine: false,
      isExpanded: expanded,
    };
  }

  state.boardSize = newSize;
  state.board = nextBoard;
  state.lines = createLines(newSize);
  state.completedLineIndexes = findCompletedLineIndexesSnapshot();
  updateCompletedLineMarks();
}

function findCompletedLineIndexesSnapshot() {
  syncLinesWithBoardSize();
  const completed = new Set();
  state.lines.forEach((line, lineIndex) => {
    const isComplete = line.every((cellIndex) => state.board[cellIndex].opened);
    if (isComplete) {
      completed.add(lineIndex);
    }
  });
  return completed;
}

function buildFreshBoard(size) {
  const board = [];
  const usedNumbers = new Set();

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const expanded = isExpandedCell(row, col);
      const number = createRandomUniqueNumber(usedNumbers, expanded);
      usedNumbers.add(number);

      board.push({
        number,
        opened: false,
        inCompletedLine: false,
        isExpanded: expanded,
      });
    }
  }

  return board;
}

function seedNegativeNumbersInExpandedCells() {
  const candidateIndexes = [];
  const usedNumbers = new Set(state.board.map((cell) => cell.number));

  state.board.forEach((cell, index) => {
    if (cell.isExpanded && !cell.opened && cell.number > 0) {
      candidateIndexes.push(index);
    }
  });

  if (candidateIndexes.length === 0) {
    return 0;
  }

  shuffleInPlace(candidateIndexes);
  const limit = Math.max(1, Math.floor(candidateIndexes.length * 0.35));
  let converted = 0;

  for (let i = 0; i < limit; i += 1) {
    const index = candidateIndexes[i];
    const current = state.board[index];
    usedNumbers.delete(current.number);

    let replacement = current.number;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const candidate = -Math.abs(randomInt(1, state.numberRange.max));
      if (!usedNumbers.has(candidate)) {
        replacement = candidate;
        break;
      }
    }

    state.board[index].number = replacement;
    usedNumbers.add(replacement);
    converted += 1;
  }

  return converted;
}

function createRandomUniqueNumber(usedNumbers, expandedCell) {
  const min = expandedCell && isNegativeUnlocked() ? state.numberRange.min : 1;
  const max = state.numberRange.max;

  for (let attempt = 0; attempt < 900; attempt += 1) {
    const candidate = randomIntExcludingZero(min, max);
    if (!usedNumbers.has(candidate)) {
      return candidate;
    }
  }

  for (let n = min; n <= max; n += 1) {
    if (n === 0) {
      continue;
    }
    if (!usedNumbers.has(n)) {
      return n;
    }
  }

  return max + usedNumbers.size + 1;
}

function drawRandomCandidate() {
  const min = isNegativeUnlocked() ? state.numberRange.min : 1;
  const max = state.numberRange.max;
  return randomIntExcludingZero(min, max);
}

function renderBoard() {
  elements.board.innerHTML = "";
  elements.board.style.gridTemplateColumns = `repeat(${state.boardSize}, minmax(0, 1fr))`;
  elements.board.style.setProperty("--cell-font-size", getCellFontSize(state.boardSize));

  state.board.forEach((cell) => {
    const node = document.createElement("div");
    node.className = "cell";

    if (cell.opened) {
      node.classList.add("hit");
    }
    if (cell.inCompletedLine) {
      node.classList.add("bingo");
    }
    if (cell.isExpanded) {
      node.classList.add("expanded");
    }

    if (cell.opened) {
      node.textContent = "●";
      node.setAttribute("aria-label", `開放済み ${formatNumber(cell.number)}`);
      node.title = `開放済み: ${formatNumber(cell.number)}`;
    } else {
      node.textContent = formatNumber(cell.number);
      node.setAttribute("aria-label", `未開放 ${formatNumber(cell.number)}`);
      node.title = `未開放: ${formatNumber(cell.number)}`;
    }
    elements.board.appendChild(node);
  });
}

function renderStatus() {
  elements.turns.textContent = String(state.turnsLeft);
  elements.score.textContent = state.score.toLocaleString("ja-JP");
  elements.rank.textContent = getRank(state.score);
  elements.roll.textContent = state.lastRolls.length === 0 ? "-" : state.lastRolls.map((value) => formatNumber(value)).join(", ");
  elements.boardSize.textContent = `${state.boardSize}x${state.boardSize}`;
  elements.drawRange.textContent = formatRange();
  elements.rollsPerDraw.textContent = String(getRollsPerDraw());
}

function renderPerkList() {
  elements.activePerks.innerHTML = "";

  const activePerkIds = Object.keys(state.perkCounts).filter((key) => state.perkCounts[key] > 0);
  if (activePerkIds.length === 0) {
    const empty = document.createElement("span");
    empty.textContent = "まだなし";
    elements.activePerks.appendChild(empty);
    return;
  }

  activePerkIds.forEach((perkId) => {
    const perk = PERKS.find((item) => item.id === perkId);
    const tag = document.createElement("span");
    tag.className = "perk-tag";
    tag.textContent = `${perk.name} x${state.perkCounts[perkId]}`;
    elements.activePerks.appendChild(tag);
  });
}

function renderLogs() {
  elements.logList.innerHTML = "";
  state.logs.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    elements.logList.appendChild(item);
  });
}

function endGame(reason) {
  state.gameOver = true;
  state.waitingPerkChoice = false;
  state.drawInProgress = false;
  elements.perkModal.classList.add("hidden");
  elements.drawModal.classList.add("hidden");
  elements.drawBtn.disabled = true;
  elements.restartBtn.disabled = false;

  const rank = getRank(state.score);
  const endText = reason === "all-open" ? "全マス開放" : "残り回数が0";

  elements.resultScore.textContent = `最終スコア: ${state.score.toLocaleString("ja-JP")}`;
  elements.resultRank.textContent = `ランク: ${rank}`;
  elements.resultLines.textContent = `成立ビンゴ列: ${state.bingoLines}`;
  elements.resultEnd.textContent = `終了条件: ${endText}`;
  elements.result.classList.remove("hidden");

  const shareText = [
    "ローグライクビンゴの結果",
    `スコア: ${state.score}`,
    `ランク: ${rank}`,
    `ビンゴ列: ${state.bingoLines}`,
    `終了条件: ${endText}`,
    `盤面: ${state.boardSize}x${state.boardSize}`,
    `抽選数/回: ${getRollsPerDraw()}`,
    "#ローグライクビンゴ",
  ].join("\n");

  elements.shareLink.href = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
  pushLog(`ゲーム終了（${endText}）。結果をXに共有できます。`);
}

function calcHitScore(cellNumber) {
  let score = Math.max(22, Math.floor(Math.abs(cellNumber) * 1.8));
  const hitBoost = getPerkCount("hit_score_boost");
  if (hitBoost > 0) {
    score = Math.floor(score * (1 + 0.32 * hitBoost));
  }
  return score;
}

function calcBingoScore(newLineCount, roll, boardSize) {
  const sizeScale = 1 + (boardSize - CONFIG.initialBoardSize) * 0.12;
  const base = 250 + Math.floor(Math.abs(roll) * 10);
  const combo = newLineCount * newLineCount * 70;

  let score = Math.floor((newLineCount * base + combo) * sizeScale);
  const bingoBoost = getPerkCount("bingo_score_boost");
  if (bingoBoost > 0) {
    score = Math.floor(score * (1 + 0.3 * bingoBoost));
  }

  return score;
}

function calcHitTurnGain() {
  return CONFIG.turnBonusPerHit + getPerkCount("hit_turn_boost");
}

function calcTurnGainPerBingoLine() {
  return CONFIG.turnBonusPerLine;
}

function getRollsPerDraw() {
  const multi = getPerkCount("multi_roll");
  return clamp(1 + multi, 1, CONFIG.maxRollsPerDraw);
}

function getRank(score) {
  for (const item of RANK_TABLE) {
    if (score >= item.min) {
      return item.rank;
    }
  }
  return "E";
}

function getPerkCount(perkId) {
  return state.perkCounts[perkId] || 0;
}

function isNegativeUnlocked() {
  return getPerkCount("negative_unlock") > 0;
}

function pickRandomPerks(count) {
  const candidates = [...PERKS];
  shuffleInPlace(candidates);
  return candidates.slice(0, count);
}

function createLines(size) {
  const lines = [];

  for (let row = 0; row < size; row += 1) {
    const rowLine = [];
    for (let col = 0; col < size; col += 1) {
      rowLine.push(row * size + col);
    }
    lines.push(rowLine);
  }

  for (let col = 0; col < size; col += 1) {
    const colLine = [];
    for (let row = 0; row < size; row += 1) {
      colLine.push(row * size + col);
    }
    lines.push(colLine);
  }

  const diagA = [];
  const diagB = [];
  for (let i = 0; i < size; i += 1) {
    diagA.push(i * size + i);
    diagB.push(i * size + (size - 1 - i));
  }
  lines.push(diagA, diagB);

  return lines;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomIntExcludingZero(min, max) {
  if (min === 0 && max === 0) {
    return 1;
  }

  let value = randomInt(min, max);
  if (value === 0) {
    value = Math.random() < 0.5 ? -1 : 1;
    if (value < min || value > max) {
      value = min === 0 ? 1 : min;
    }
  }
  return value;
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function isPrime(n) {
  if (n < 2) {
    return false;
  }
  if (n === 2) {
    return true;
  }
  if (n % 2 === 0) {
    return false;
  }

  const root = Math.floor(Math.sqrt(n));
  for (let i = 3; i <= root; i += 2) {
    if (n % i === 0) {
      return false;
    }
  }
  return true;
}

function isPerfectNumber(n) {
  if (n < 2) {
    return false;
  }

  let sum = 1;
  const root = Math.floor(Math.sqrt(n));
  for (let i = 2; i <= root; i += 1) {
    if (n % i === 0) {
      sum += i;
      const pair = n / i;
      if (pair !== i) {
        sum += pair;
      }
    }
  }

  return sum === n;
}

function isExpandedCell(row, col) {
  return row >= CONFIG.initialBoardSize || col >= CONFIG.initialBoardSize;
}

function syncLinesWithBoardSize() {
  const expectedLineCount = state.boardSize * 2 + 2;
  if (state.lines.length !== expectedLineCount) {
    state.lines = createLines(state.boardSize);
  }

  const normalized = new Set();
  state.completedLineIndexes.forEach((index) => {
    if (index >= 0 && index < state.lines.length) {
      normalized.add(index);
    }
  });
  state.completedLineIndexes = normalized;
}

function getCellFontSize(boardSize) {
  if (boardSize >= 11) {
    return "0.57rem";
  }
  if (boardSize >= 9) {
    return "0.66rem";
  }
  if (boardSize >= 7) {
    return "0.78rem";
  }
  return "0.95rem";
}

function formatNumber(value) {
  if (value < 0) {
    return `-${Math.abs(value)}`;
  }
  return String(value);
}

function formatRange() {
  return `${formatNumber(state.numberRange.min)}..${formatNumber(state.numberRange.max)}`;
}

function pushLog(message) {
  state.logs.unshift(message);
  if (state.logs.length > CONFIG.maxLogEntries) {
    state.logs = state.logs.slice(0, CONFIG.maxLogEntries);
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

init();
