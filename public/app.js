
let state = {
  mode: null,
  questions: [],
  currentIndex: 0,
  answers: [],
  currentSelected: null,
  answered: false,
  startedAt: null
};

const EXAM_QUESTION_COUNT = 60;

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return document.querySelectorAll(sel); }

function showScreen(id) {
  $all('.screen').forEach(s => s.classList.remove('active'));
  $('#' + id).classList.add('active');
}

function getUsername() {
  return ($('#username').value || 'guest').trim() || 'guest';
}

let selectedStudyCount = 20;

$all('.count-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $all('.count-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedStudyCount = parseInt(btn.dataset.count, 10);
    $('#study-custom-count').value = '';
  });
});
document.addEventListener('DOMContentLoaded', () => {
  const defaultBtn = document.querySelector('.count-btn[data-count="20"]');
  if (defaultBtn) defaultBtn.classList.add('selected');
  loadHistory();
});

$('#study-custom-count').addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  if (val > 0) {
    $all('.count-btn').forEach(b => b.classList.remove('selected'));
    selectedStudyCount = Math.min(val, 150);
  }
});

$('#start-study').addEventListener('click', () => startSession('study', selectedStudyCount));
$('#start-exam').addEventListener('click', () => startSession('exam', EXAM_QUESTION_COUNT));
$('#quit-quiz').addEventListener('click', () => {
  if (confirm('Quit this session? Your progress will be lost.')) {
    resetState();
    showScreen('screen-home');
    loadHistory();
  }
});
$('#back-home').addEventListener('click', () => {
  resetState();
  showScreen('screen-home');
  loadHistory();
});

function resetState() {
  state = { mode: null, questions: [], currentIndex: 0, answers: [], currentSelected: null, answered: false, startedAt: null };
}

async function startSession(mode, count) {
  try {
    const res = await fetch(`/api/questions?count=${count}`);
    const questions = await res.json();
    state.mode = mode;
    state.questions = questions;
    state.currentIndex = 0;
    state.answers = [];
    state.currentSelected = null;
    state.answered = false;
    state.startedAt = new Date().toISOString();
    showScreen('screen-quiz');
    renderQuestion();
  } catch (err) {
    alert('Could not load questions. Is the server running?');
    console.error(err);
  }
}

function renderQuestion() {
  const q = state.questions[state.currentIndex];
  state.currentSelected = null;
  state.answered = false;

  $('#quiz-mode-label').textContent = state.mode === 'exam' ? 'Exam Mode' : 'Study Mode';
  $('#quiz-progress').textContent = `Question ${state.currentIndex + 1} / ${state.questions.length}`;
  $('#progress-fill').style.width = `${((state.currentIndex) / state.questions.length) * 100}%`;

  $('#question-domain').textContent = `${q.domain} — ${q.subtopic}`;
  $('#question-text').textContent = q.question;

  const list = $('#options-list');
  list.innerHTML = '';
  q.options.forEach((opt, idx) => {
    const div = document.createElement('div');
    div.className = 'option-item';
    div.textContent = opt;
    div.dataset.idx = idx;
    div.addEventListener('click', () => selectOption(idx));
    list.appendChild(div);
  });

  $('#feedback-box').classList.add('hidden');
  $('#submit-answer').classList.remove('hidden');
  $('#next-question').classList.add('hidden');
}

function selectOption(idx) {
  if (state.answered) return;
  state.currentSelected = idx;
  $all('.option-item').forEach(el => el.classList.remove('selected'));
  document.querySelector(`.option-item[data-idx="${idx}"]`).classList.add('selected');
}

$('#submit-answer').addEventListener('click', () => {
  if (state.currentSelected === null) {
    alert('Please select an answer first.');
    return;
  }
  answerCurrentQuestion();
});

$('#next-question').addEventListener('click', () => {
  state.currentIndex++;
  if (state.currentIndex >= state.questions.length) {
    finishSession();
  } else {
    renderQuestion();
  }
});

function answerCurrentQuestion() {
  const q = state.questions[state.currentIndex];
  state.answers.push({ id: q.id, selected: state.currentSelected });
  state.answered = true;

  $('#submit-answer').classList.add('hidden');
  $('#next-question').classList.remove('hidden');

  $all('.option-item').forEach(el => el.classList.add('disabled'));

  if (state.mode === 'study') {
    fetchSingleFeedback(q.id, state.currentSelected);
  }
}

async function fetchSingleFeedback(id, selected) {
  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '__preview__', mode: 'preview', answers: [{ id, selected }], startedAt: new Date().toISOString() })
    });
    const data = await res.json();
    const r = data.results[0];
    highlightAnswer(r.correct, r.selected, r.isCorrect);
    showFeedback(r.isCorrect, r.explanation);
  } catch (err) {
    console.error(err);
  }
}

function highlightAnswer(correctIdx, selectedIdx, isCorrect) {
  $all('.option-item').forEach(el => {
    const idx = parseInt(el.dataset.idx, 10);
    if (idx === correctIdx) el.classList.add('correct-answer');
    if (idx === selectedIdx && !isCorrect) el.classList.add('wrong-answer');
  });
}

function showFeedback(isCorrect, explanation) {
  const box = $('#feedback-box');
  box.classList.remove('hidden', 'correct', 'incorrect');
  box.classList.add(isCorrect ? 'correct' : 'incorrect');
  $('#feedback-title').textContent = isCorrect ? 'Correct!' : 'Incorrect.';
  $('#feedback-explanation').textContent = explanation;
}

async function finishSession() {
  const username = getUsername();
  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        mode: state.mode,
        answers: state.answers,
        startedAt: state.startedAt
      })
    });
    const data = await res.json();
    renderResults(data);
    showScreen('screen-results');
  } catch (err) {
    alert('Could not submit results.');
    console.error(err);
  }
}

function renderResults(data) {
  $('#score-pct').textContent = `${data.scorePct}%`;
  const deg = (data.scorePct / 100) * 360;
  $('#score-circle').style.background = `conic-gradient(var(--sf-blue) ${deg}deg, #eee ${deg}deg)`;
  $('#results-text').textContent = `You answered ${data.correctCount} out of ${data.total} questions correctly.`;
  const passThreshold = 63;
  $('#results-pass').textContent = data.scorePct >= passThreshold
    ? `Great job — that's above the typical ~${passThreshold}% passing bar for the real exam.`
    : `The real exam's passing bar is roughly ~${passThreshold}%. Keep practicing the weaker domains below.`;

  const breakdownDiv = $('#domain-breakdown');
  breakdownDiv.innerHTML = '';
  Object.entries(data.domainStats).forEach(([domain, stats]) => {
    const pct = Math.round((stats.correct / stats.total) * 100);
    const row = document.createElement('div');
    row.className = 'domain-row';
    row.innerHTML = `
      <span>${domain}</span>
      <div class="domain-bar-track"><div class="domain-bar-fill" style="width:${pct}%"></div></div>
      <span>${stats.correct}/${stats.total} (${pct}%)</span>
    `;
    breakdownDiv.appendChild(row);
  });

  const reviewDiv = $('#question-review');
  reviewDiv.innerHTML = '';
  data.results.forEach((r, i) => {
    const item = document.createElement('div');
    item.className = 'review-item';
    item.innerHTML = `
      <div class="review-q">${i + 1}. ${r.question}</div>
      <div>Your answer: ${r.options[r.selected] ?? '(no answer)'} —
        <span class="${r.isCorrect ? 'review-tag-correct' : 'review-tag-incorrect'}">${r.isCorrect ? 'Correct' : 'Incorrect'}</span>
      </div>
      ${!r.isCorrect ? `<div>Correct answer: ${r.options[r.correct]}</div>` : ''}
      <div class="review-explanation">${r.explanation}</div>
    `;
    reviewDiv.appendChild(item);
  });
}

async function loadHistory() {
  const username = getUsername();
  try {
    const res = await fetch(`/api/history?username=${encodeURIComponent(username)}`);
    const rows = await res.json();
    const filtered = rows.filter(r => r.mode !== 'preview');
    if (filtered.length === 0) {
      $('#history-list').innerHTML = '<p>No sessions yet. Complete a study or exam session to see your history here.</p>';
      return;
    }
    let html = '<table><tr><th>Date</th><th>Mode</th><th>Score</th><th>Correct/Total</th></tr>';
    filtered.slice(0, 15).forEach(r => {
      const date = new Date(r.finished_at).toLocaleString();
      html += `<tr><td>${date}</td><td>${r.mode}</td><td>${r.score_pct}%</td><td>${r.correct_answers}/${r.total_questions}</td></tr>`;
    });
    html += '</table>';
    $('#history-list').innerHTML = html;
  } catch (err) {
    $('#history-list').innerHTML = '<p>Could not load history.</p>';
  }
}

$('#username').addEventListener('change', loadHistory);
