const CONFIG = {
  boardSize: 5,
  minNumber: 1,
  maxNumber: 75,
  initialTurns: 20,
  perkInterval: 5,
  turnBonusPerLine: 2,
  maxLogEntries: 14,
};

const PERKS = [
  {
    id: "column_up",
    name: "列増加",
    description: "出目が +1 されます（重複で強化）。",
  },
  {
    id: "column_down",
    name: "列減少",
    description: "出目が -1 されます（重複で強化）。",
  },
  {
    id: "no_prime",
    name: "素数禁止",
    description: "素数が出る場合は再抽選します。",
  },
  {
    id: "no_perfect",
    name: "完全数禁止",
    description: "完全数が出る場合は再抽選します。",
  },
  {
    id: "negative_shift",
    name: "負数化",
    description: "20%で出目が負数になります。",
  },
  {
    id: "absolute_lock",
    name: "絶対値照準",
    description: "負数の出目でも絶対値で判定します。",
  },
];

const RANK_TABLE = [
  { rank: "S", min: 12000 },
  { rank: "A", min: 9000 },
  { rank: "B", min: 6500 },
  { rank: "C", min: 4200 },
  { rank: "D", min: 2500 },
  { rank: "E", min: 0 },
];

const state = {
  board: [],
  lines: [],
  completedLineIndexes: new Set(),
  perkCounts: {},
  logs: [],
  turnsLeft: CONFIG.initialTurns,
  drawCount: 0,
  bingoLines: 0,
  score: 0,
  lastRoll: null,
  waitingPerkChoice: false,
  gameOver: false,
};

const elements = {
  board: document.getElementById("board"),
  turns: document.getElementById("turns"),
  score: document.getElementById("score"),
  rank: document.getElementById("rank"),
  roll: document.getElementById("roll"),
  drawBtn: document.getElementById("draw-btn"),
  restartBtn: document.getElementById("restart-btn"),
  logList: document.getElementById("log-list"),
  activePerks: document.getElementById("active-perks"),
  result: document.getElementById("result"),
  resultScore: document.getElementById("result-score"),
  resultRank: document.getElementById("result-rank"),
  resultLines: document.getElementById("result-lines"),
  shareLink: document.getElementById("share-link"),
  perkModal: document.getElementById("perk-modal"),
  perkOptions: document.getElementById("perk-options"),
};

function init() {
  elements.drawBtn.addEventListener("click", onDraw);
  elements.restartBtn.addEventListener("click", startGame);
  startGame();
}

function startGame() {
  const totalCells = CONFIG.boardSize * CONFIG.boardSize;
  const numbers = sampleUniqueNumbers(CONFIG.minNumber, CONFIG.maxNumber, totalCells);

  state.board = numbers.map((number) => ({
    number,
    opened: false,
    inCompletedLine: false,
  }));
  state.lines = createLines(CONFIG.boardSize);
  state.completedLineIndexes = new Set();
  state.perkCounts = {};
  state.logs = [];
  state.turnsLeft = CONFIG.initialTurns;
  state.drawCount = 0;
  state.bingoLines = 0;
  state.score = 0;
  state.lastRoll = null;
  state.waitingPerkChoice = false;
  state.gameOver = false;

  elements.result.classList.add("hidden");
  elements.perkModal.classList.add("hidden");
  elements.drawBtn.disabled = false;

  pushLog("ゲーム開始。ハイスコアを狙ってください。");
  renderBoard();
  renderStatus();
  renderPerkList();
  renderLogs();
}

function onDraw() {
  if (state.gameOver || state.waitingPerkChoice) {
    return;
  }

  state.turnsLeft -= 1;
  state.drawCount += 1;

  const rollResult = generateRoll();
  state.lastRoll = rollResult.value;

  const openedIndex = openCellByRoll(rollResult.value);

  if (openedIndex === -1) {
    pushLog(`出目 ${formatNumber(rollResult.value)}：ハズレ`);
  }

  if (state.turnsLeft <= 0) {
    endGame();
    renderStatus();
    renderPerkList();
    renderLogs();
    renderBoard();
    return;
  }

  if (state.drawCount % CONFIG.perkInterval === 0) {
    presentPerkChoices();
  }

  renderStatus();
  renderPerkList();
  renderLogs();
  renderBoard();
}

function generateRoll() {
  const maxAttempts = 40;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let value = randomInt(CONFIG.minNumber, CONFIG.maxNumber);

    const up = getPerkCount("column_up");
    const down = getPerkCount("column_down");
    value += up - down;

    if (value > CONFIG.maxNumber) {
      value = CONFIG.maxNumber;
    }
    if (value < -CONFIG.maxNumber) {
      value = -CONFIG.maxNumber;
    }

    const negativeChance = Math.min(0.2 * getPerkCount("negative_shift"), 0.85);
    if (negativeChance > 0 && Math.random() < negativeChance) {
      value *= -1;
    }

    if (getPerkCount("no_prime") > 0 && isPrime(Math.abs(value))) {
      continue;
    }

    if (getPerkCount("no_perfect") > 0 && isPerfectNumber(Math.abs(value))) {
      continue;
    }

    return { value };
  }

  return { value: randomInt(CONFIG.minNumber, CONFIG.maxNumber) };
}

function openCellByRoll(roll) {
  let target = roll;
  if (getPerkCount("absolute_lock") > 0) {
    target = Math.abs(target);
  }

  if (!Number.isInteger(target)) {
    return -1;
  }

  const index = state.board.findIndex((cell) => cell.number === target && !cell.opened);

  if (index === -1) {
    return -1;
  }

  state.board[index].opened = true;
  const hitScore = calcHitScore(target);
  state.score += hitScore;
  pushLog(`出目 ${formatNumber(roll)}：${target} が開いた (+${hitScore})`);

  const newLineIndexes = findNewCompletedLineIndexes();
  if (newLineIndexes.length > 0) {
    newLineIndexes.forEach((lineIndex) => state.completedLineIndexes.add(lineIndex));
    updateCompletedLineMarks();

    const lineCount = newLineIndexes.length;
    state.bingoLines += lineCount;

    const bingoScore = calcBingoScore(lineCount, roll);
    state.score += bingoScore;

    const turnGain = lineCount * CONFIG.turnBonusPerLine;
    state.turnsLeft += turnGain;

    pushLog(`ビンゴ ${lineCount}列成立！ (+${bingoScore}, 回数+${turnGain})`);
  }

  return index;
}

function findNewCompletedLineIndexes() {
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
  state.board.forEach((cell) => {
    cell.inCompletedLine = false;
  });

  state.completedLineIndexes.forEach((lineIndex) => {
    state.lines[lineIndex].forEach((cellIndex) => {
      state.board[cellIndex].inCompletedLine = true;
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
      elements.drawBtn.disabled = false;
      elements.perkModal.classList.add("hidden");
      renderPerkList();
      renderStatus();
      renderLogs();
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
}

function renderBoard() {
  elements.board.innerHTML = "";

  state.board.forEach((cell) => {
    const node = document.createElement("div");
    node.className = "cell";
    if (cell.opened) {
      node.classList.add("hit");
    }
    if (cell.inCompletedLine) {
      node.classList.add("bingo");
    }
    node.textContent = cell.opened ? "●" : String(cell.number);
    elements.board.appendChild(node);
  });
}

function renderStatus() {
  elements.turns.textContent = String(state.turnsLeft);
  elements.score.textContent = state.score.toLocaleString("ja-JP");
  elements.rank.textContent = getRank(state.score);
  elements.roll.textContent = state.lastRoll === null ? "-" : formatNumber(state.lastRoll);
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

function endGame() {
  state.gameOver = true;
  state.waitingPerkChoice = false;
  elements.perkModal.classList.add("hidden");
  elements.drawBtn.disabled = true;

  const rank = getRank(state.score);

  elements.resultScore.textContent = `最終スコア: ${state.score.toLocaleString("ja-JP")}`;
  elements.resultRank.textContent = `ランク: ${rank}`;
  elements.resultLines.textContent = `成立ビンゴ列: ${state.bingoLines}`;
  elements.result.classList.remove("hidden");

  const shareText = [
    "ローグライクビンゴの結果",
    `スコア: ${state.score}`,
    `ランク: ${rank}`,
    `ビンゴ列: ${state.bingoLines}`,
    "#ローグライクビンゴ",
  ].join("\n");

  elements.shareLink.href = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
  pushLog("ゲーム終了。結果をXに共有できます。");
}

function calcHitScore(targetNumber) {
  return Math.max(20, Math.floor(Math.abs(targetNumber) * 1.8));
}

function calcBingoScore(newLineCount, roll) {
  const base = 240 + Math.floor(Math.abs(roll) * 12);
  const comboBonus = newLineCount * newLineCount * 60;
  return newLineCount * base + comboBonus;
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

function sampleUniqueNumbers(min, max, count) {
  const pool = [];
  for (let i = min; i <= max; i += 1) {
    pool.push(i);
  }
  shuffleInPlace(pool);
  return pool.slice(0, count);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

function formatNumber(value) {
  if (value < 0) {
    return `-${Math.abs(value)}`;
  }
  return String(value);
}

function pushLog(message) {
  state.logs.unshift(message);
  if (state.logs.length > CONFIG.maxLogEntries) {
    state.logs = state.logs.slice(0, CONFIG.maxLogEntries);
  }
}

init();
