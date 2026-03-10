class TrueVineGameSystem {
  constructor() {
    this.state = {
      mode: 'memory',
      global: 'setup',
      teams: 2,
      scores: [0, 0],
      timeLimit: 60,
      timeLeft: 60,
      timerId: null,
      memory: { state: 'idle', cards: [], first: null, lock: false, matched: 0 },
      quiz: { state: 'idle', index: 0 },
      random: { state: 'idle', history: [] },
      verse: { state: 'idle', target: [], picked: [] },
      banks: {
        memory: [
          { question: '仁愛', answer: '主動幫助別人' },
          { question: '喜樂', answer: '在主裡有真正的快樂' },
          { question: '和平', answer: '讓衝突回到和好' },
          { question: '忍耐', answer: '遇到困難仍然等待神' },
          { question: '恩慈', answer: '溫柔對待每個人' }
        ],
        quiz: [
          { question: '聖靈的果子不包含下列哪一項？', optionA: '忍耐', optionB: '嫉妒', optionC: '和平', optionD: '恩慈', answer: 'B' },
          { question: '「愛是恆久忍耐」出自哪卷書？', optionA: '哥林多前書', optionB: '馬太福音', optionC: '詩篇', optionD: '羅馬書', answer: 'A' }
        ],
        random: [
          { question: '分享一次你幫助同學的經驗。', answer: '開放式' },
          { question: '今天你最感恩的事是什麼？', answer: '開放式' }
        ],
        verse: [
          { verse: '聖靈所結的果子 就是仁愛 喜樂 和平 忍耐' }
        ]
      }
    };

    this.$ = {
      timer: document.getElementById('timer'),
      teamCount: document.getElementById('team-count'),
      timeLimit: document.getElementById('time-limit'),
      scoreList: document.getElementById('score-list'),
      gameScreen: document.getElementById('game-screen'),
      excelFile: document.getElementById('excel-file'),
      promptBtn: document.getElementById('generate-prompt'),
      promptOutput: document.getElementById('prompt-output')
    };

    this.bindEvents();
    this.renderAll();
  }

  bindEvents() {
    document.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => this.onAction(btn.dataset.action));
    });

    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.switchMode(btn.dataset.mode));
    });

    this.$.excelFile.addEventListener('change', (e) => this.importExcel(e.target.files?.[0]));
    this.$.promptBtn.addEventListener('click', () => this.generatePrompt());
  }

  onAction(action) {
    const s = this.state;
    switch (action) {
      case 'teams-up': s.teams = Math.min(8, s.teams + 1); this.syncScores(); break;
      case 'teams-down': s.teams = Math.max(1, s.teams - 1); this.syncScores(); break;
      case 'time-up': s.timeLimit = Math.min(600, s.timeLimit + 10); s.timeLeft = s.timeLimit; break;
      case 'time-down': s.timeLimit = Math.max(10, s.timeLimit - 10); s.timeLeft = s.timeLimit; break;
      case 'start': this.startGame(); break;
      case 'pause': this.pauseGame(); break;
      case 'reset': this.resetGame(); break;
    }
    this.renderAll();
  }

  startGame() {
    if (this.state.global === 'running') return;
    this.state.global = 'running';
    this.prepareMode();
    this.startTimer();
    this.renderMode();
  }

  pauseGame() {
    if (this.state.global !== 'running') return;
    this.state.global = 'paused';
    this.stopTimer();
  }

  resetGame() {
    this.stopTimer();
    this.state.global = 'setup';
    this.state.timeLeft = this.state.timeLimit;
    this.state.quiz = { state: 'idle', index: 0 };
    this.state.random = { state: 'idle', history: [] };
    this.state.verse = { state: 'idle', target: [], picked: [] };
    this.state.memory = { state: 'idle', cards: [], first: null, lock: false, matched: 0 };
    this.renderAll();
  }

  switchMode(mode) {
    this.state.mode = mode;
    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    this.renderMode();
  }

  prepareMode() {
    if (this.state.mode === 'memory') this.setupMemory();
    if (this.state.mode === 'verse') this.setupVerse();
  }

  setupMemory() {
    const pairs = this.state.banks.memory.slice(0, 10);
    const cards = pairs.flatMap((p, i) => ([
      { id: `${i}-q`, pairId: i, text: p.question, flipped: false, matched: false },
      { id: `${i}-a`, pairId: i, text: p.answer, flipped: false, matched: false }
    ]));
    this.state.memory = { state: 'shuffling', cards: this.shuffle(cards), first: null, lock: false, matched: 0 };
  }

  setupVerse() {
    const source = this.state.banks.verse[0]?.verse || '';
    const target = source.split(' ').filter(Boolean);
    this.state.verse = { state: 'shuffled', target, picked: this.shuffle([...target]) };
  }

  startTimer() {
    this.stopTimer();
    this.state.timerId = setInterval(() => {
      this.state.timeLeft -= 1;
      if (this.state.timeLeft <= 0) {
        this.state.timeLeft = 0;
        this.state.global = 'ended';
        this.stopTimer();
        this.playSound('bell');
      }
      this.renderTimer();
    }, 1000);
  }

  stopTimer() {
    if (this.state.timerId) clearInterval(this.state.timerId);
    this.state.timerId = null;
  }

  syncScores() {
    const old = [...this.state.scores];
    this.state.scores = Array.from({ length: this.state.teams }, (_, i) => old[i] || 0);
  }

  addScore(teamIndex, delta = 1) {
    this.state.scores[teamIndex] = Math.max(0, this.state.scores[teamIndex] + delta);
    this.renderScores();
  }

  renderAll() {
    this.$.teamCount.textContent = this.state.teams;
    this.$.timeLimit.textContent = this.state.timeLimit;
    this.renderTimer();
    this.renderScores();
    this.renderMode();
  }

  renderTimer() {
    this.$.timer.textContent = `剩餘時間：${this.state.timeLeft} 秒`;
  }

  renderScores() {
    this.$.scoreList.innerHTML = '';
    this.state.scores.forEach((score, i) => {
      const row = document.createElement('div');
      row.className = 'score-row';
      row.innerHTML = `
        <span>第${i + 1}組 ${score}分</span>
        <button data-t="${i}" data-d="1">+</button>
        <button data-t="${i}" data-d="-1">-</button>
      `;
      row.querySelectorAll('button').forEach((btn) => btn.addEventListener('click', () => this.addScore(Number(btn.dataset.t), Number(btn.dataset.d))));
      this.$.scoreList.appendChild(row);
    });
  }

  renderMode() {
    if (this.state.mode === 'memory') return this.renderMemory();
    if (this.state.mode === 'quiz') return this.renderQuiz();
    if (this.state.mode === 'random') return this.renderRandom();
    return this.renderVerse();
  }

  renderMemory() {
    const m = this.state.memory;
    this.$.gameScreen.innerHTML = '<div class="game-title">Memory Card（文字 ↔ 解釋）</div>';
    const grid = document.createElement('div');
    grid.className = 'memory-grid';
    if (!m.cards.length) {
      const hint = document.createElement('p');
      hint.textContent = '按「開始遊戲」進入記憶卡模式';
      this.$.gameScreen.appendChild(hint);
      return;
    }
    m.cards.forEach((card) => {
      const cell = document.createElement('button');
      cell.className = `card ${card.flipped || card.matched ? 'flipped' : ''}`;
      cell.innerHTML = `<div class="card-inner"><div class="card-face card-front">True Vine</div><div class="card-face card-back">${card.text}</div></div>`;
      cell.addEventListener('click', () => this.pickMemory(card.id));
      grid.appendChild(cell);
    });
    this.$.gameScreen.appendChild(grid);
  }

  pickMemory(cardId) {
    const m = this.state.memory;
    if (m.lock || this.state.global !== 'running') return;
    const card = m.cards.find((c) => c.id === cardId);
    if (!card || card.flipped || card.matched) return;
    card.flipped = true;
    if (!m.first) {
      m.first = card;
      m.state = 'firstPick';
      this.renderMemory();
      return;
    }
    m.lock = true;
    m.state = 'secondPick';
    this.renderMemory();
    setTimeout(() => {
      if (m.first.pairId === card.pairId) {
        card.matched = true;
        m.first.matched = true;
        m.matched += 1;
        this.playSound('ding');
      } else {
        card.flipped = false;
        m.first.flipped = false;
      }
      m.first = null;
      m.lock = false;
      m.state = m.matched >= m.cards.length / 2 ? 'completed' : 'resolve';
      this.renderMemory();
    }, 500);
  }

  renderQuiz() {
    const q = this.state.banks.quiz[this.state.quiz.index % this.state.banks.quiz.length];
    this.$.gameScreen.innerHTML = `
      <div class="game-title">Bible Quiz</div>
      <div class="question-text">${q.question}</div>
      <div class="quiz-options">
        <button data-opt="A">A. ${q.optionA || ''}</button>
        <button data-opt="B">B. ${q.optionB || ''}</button>
        <button data-opt="C">C. ${q.optionC || ''}</button>
        <button data-opt="D">D. ${q.optionD || ''}</button>
      </div>
    `;
    this.$.gameScreen.querySelectorAll('[data-opt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.state.global !== 'running') return;
        const correct = btn.dataset.opt === q.answer;
        btn.style.background = correct ? '#8ee09a' : '#ffc4be';
        if (correct) this.playSound('ding');
        setTimeout(() => {
          this.state.quiz.index += 1;
          this.renderQuiz();
        }, 700);
      });
    });
  }

  renderRandom() {
    this.$.gameScreen.innerHTML = `
      <div class="game-title">Random Question</div>
      <div class="random-text" id="random-display">按下抽題開始</div>
      <button id="draw-random">抽題</button>
    `;
    this.$.gameScreen.querySelector('#draw-random').addEventListener('click', () => {
      if (this.state.global !== 'running') return;
      const candidates = this.state.banks.random.filter((_, i) => !this.state.random.history.includes(i));
      if (!candidates.length) {
        this.$.gameScreen.querySelector('#random-display').textContent = '題目已全部抽完';
        return;
      }
      const idx = Math.floor(Math.random() * candidates.length);
      const question = candidates[idx];
      const realIdx = this.state.banks.random.indexOf(question);
      this.state.random.history.push(realIdx);
      this.$.gameScreen.querySelector('#random-display').textContent = question.question;
    });
  }

  renderVerse() {
    const v = this.state.verse;
    const answer = v.target.filter((seg) => !v.picked.includes(seg));
    this.$.gameScreen.innerHTML = '<div class="game-title">Verse Order 經文排序</div>';
    if (!v.picked.length && !v.target.length) {
      this.$.gameScreen.innerHTML += '<p class="verse-text">按「開始遊戲」載入經文片段</p>';
      return;
    }

    const source = document.createElement('div');
    source.className = 'verse-pool';
    v.picked.forEach((seg, i) => {
      const chip = document.createElement('button');
      chip.className = 'verse-chip';
      chip.textContent = seg;
      chip.addEventListener('click', () => {
        v.picked.splice(i, 1);
        this.renderVerse();
      });
      source.appendChild(chip);
    });

    const answerBox = document.createElement('div');
    answerBox.className = 'verse-answer';
    answer.forEach((seg) => {
      const chip = document.createElement('button');
      chip.className = 'verse-chip';
      chip.textContent = seg;
      chip.addEventListener('click', () => {
        v.picked.push(seg);
        this.renderVerse();
      });
      answerBox.appendChild(chip);
    });

    const checkBtn = document.createElement('button');
    checkBtn.textContent = '驗證順序';
    checkBtn.addEventListener('click', () => {
      const ok = JSON.stringify(answer) === JSON.stringify(v.target);
      alert(ok ? '排序正確！' : '順序還不對，再試一次！');
      if (ok) this.playSound('ding');
    });

    this.$.gameScreen.append(source, answerBox, checkBtn);
  }

  importExcel(file) {
    if (!file) return;
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    if (isCsv) return this.importCsv(file);
    if (!window.XLSX) return alert('XLSX 函式庫尚未載入，請確認網路或改匯入 CSV');

    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      this.mergeRows(rows);
    };
    reader.readAsArrayBuffer(file);
  }

  importCsv(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const [header, ...lines] = String(e.target.result).trim().split('\n');
      const keys = header.split(',').map((k) => k.trim());
      const rows = lines.map((line) => {
        const cols = line.split(',');
        return Object.fromEntries(keys.map((k, i) => [k, cols[i]?.trim() || '']));
      });
      this.mergeRows(rows);
    };
    reader.readAsText(file, 'utf-8');
  }

  mergeRows(rows) {
    rows.forEach((r) => {
      if (r.optionA && r.optionB) this.state.banks.quiz.push(r);
      else if (r.verse) this.state.banks.verse.push(r);
      else if (r.question && r.answer) this.state.banks.memory.push(r);
      else if (r.question) this.state.banks.random.push(r);
    });
    alert(`已匯入 ${rows.length} 筆資料`);
  }

  generatePrompt() {
    this.$.promptOutput.value = `Generate 50 Sunday School questions\nTopic: Fruit of the Spirit\nAge: 10-12\nLanguage: Chinese\nOutput format: Excel\nColumns: mode,question,answer,optionA,optionB,optionC,optionD,reference,verse,difficulty,tags`;
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  playSound(type) {
    const map = { ding: 880, bell: 440 };
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = map[type] || 600;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.value = 0.02;
    o.start();
    o.stop(ctx.currentTime + 0.2);
  }
}

document.addEventListener('DOMContentLoaded', () => new TrueVineGameSystem());
