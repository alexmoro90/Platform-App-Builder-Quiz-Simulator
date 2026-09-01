
const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- DB setup (SQLite) ----
// On Render, set DB_PATH to a file inside your attached Persistent Disk mount
// (e.g. /var/data/scores.db) via an environment variable, so scores survive deploys/restarts.
// Locally / without a disk, it falls back to the bundled data/ folder.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'scores.db');
const DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    mode TEXT,
    total_questions INTEGER,
    correct_answers INTEGER,
    score_pct REAL,
    domain_breakdown TEXT,
    started_at TEXT,
    finished_at TEXT
  )`);
});

// ---- Questions ----
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'questions.json'), 'utf-8'));

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Get a random batch of questions (without revealing correct answer / explanation)
app.get('/api/questions', (req, res) => {
  const count = Math.min(parseInt(req.query.count, 10) || 60, questions.length);
  const picked = shuffle(questions).slice(0, count);
  const sanitized = picked.map(q => ({
    id: q.id,
    domain: q.domain,
    subtopic: q.subtopic,
    question: q.question,
    options: q.options
  }));
  res.json(sanitized);
});

// Validate answers at submission time (client sends {id, selected} pairs)
app.post('/api/submit', (req, res) => {
  const { username, mode, answers, startedAt } = req.body;
  if (!Array.isArray(answers)) return res.status(400).json({ error: 'answers must be an array' });

  const byId = {};
  questions.forEach(q => { byId[q.id] = q; });

  let correctCount = 0;
  const domainStats = {};
  const results = answers.map(a => {
    const q = byId[a.id];
    if (!q) return null;
    const isCorrect = a.selected === q.correct;
    if (isCorrect) correctCount++;
    if (!domainStats[q.domain]) domainStats[q.domain] = { correct: 0, total: 0 };
    domainStats[q.domain].total++;
    if (isCorrect) domainStats[q.domain].correct++;
    return {
      id: q.id,
      domain: q.domain,
      subtopic: q.subtopic,
      question: q.question,
      options: q.options,
      correct: q.correct,
      selected: a.selected,
      isCorrect,
      explanation: q.explanation
    };
  }).filter(Boolean);

  const total = results.length;
  const scorePct = total > 0 ? Math.round((correctCount / total) * 1000) / 10 : 0;
  const finishedAt = new Date().toISOString();

  db.run(
    `INSERT INTO sessions (username, mode, total_questions, correct_answers, score_pct, domain_breakdown, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [username || 'guest', mode || 'exam', total, correctCount, scorePct, JSON.stringify(domainStats), startedAt || finishedAt, finishedAt],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to save session' });
      }
      res.json({
        sessionId: this.lastID,
        total,
        correctCount,
        scorePct,
        domainStats,
        results
      });
    }
  );
});

// Fetch history for a user (or all if no username given)
app.get('/api/history', (req, res) => {
  const { username } = req.query;
  const query = username
    ? `SELECT * FROM sessions WHERE username = ? ORDER BY id DESC LIMIT 100`
    : `SELECT * FROM sessions ORDER BY id DESC LIMIT 100`;
  const params = username ? [username] : [];
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch history' });
    res.json(rows.map(r => ({
      ...r,
      domain_breakdown: JSON.parse(r.domain_breakdown || '{}')
    })));
  });
});

app.get('/api/meta', (req, res) => {
  const domains = {};
  questions.forEach(q => { domains[q.domain] = (domains[q.domain] || 0) + 1; });
  res.json({ totalQuestions: questions.length, domains });
});

app.listen(PORT, () => {
  console.log(`App Builder Quiz Simulator running on port ${PORT}`);
});
