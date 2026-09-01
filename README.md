# Salesforce Platform App Builder — Quiz Simulator

A local/Render-deployable exam simulator for the **Salesforce Certified Platform App Builder** credential.

- Pure HTML/CSS/JS front-end
- Node.js + Express backend (keeps correct answers server-side so they can't be inspected in devtools)
- SQLite for score/session history persistence
- 150-question bank, weighted to match the official exam blueprint:
  - Salesforce Fundamentals: 18% (27 questions)
  - Data Modeling and Management: 20% (30 questions)
  - Business Logic and Process Automation: 32% (47 questions)
  - User Interface: 17% (26 questions)
  - App Deployment: 13% (20 questions)
- **Study Mode**: pick 10/20/40/60/150 or a custom number of questions, with instant feedback + explanation after each question.
- **Exam Mode**: 60 questions randomly drawn (feedback shown only at the end, like the real exam).
- Every question includes an explanation of why the correct answer is correct.

## Run locally

Requirements: Node.js 18+ installed.

```bash
cd appbuilder-quiz-sim
npm install
npm start
```

Then open http://localhost:3000 in your browser.

Scores are saved in `data/scores.db` (SQLite file), created automatically on first run.

## Deploy to Render

This repo includes a ready-to-use `render.yaml` (Render "Blueprint") so Render can auto-configure everything.

### Option A — One-click Blueprint deploy
1. Push this project to a GitHub/GitLab repo.
2. In the Render dashboard, click **New > Blueprint**, and point it at your repo.
3. Render reads `render.yaml` automatically and provisions:
   - A **Web Service** (Node, free plan) running `npm install` then `npm start`.
   - A **1GB Persistent Disk** mounted at `/var/data`, so your SQLite score history survives deploys and restarts (Render's default filesystem is ephemeral, just like Heroku's).
4. Click **Apply** — Render builds and deploys automatically. Future `git push` updates redeploy automatically too.

### Option B — Manual Web Service setup
1. In the Render dashboard: **New > Web Service**, connect your repo.
2. Settings:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. Add a **Persistent Disk** (Settings > Disks): mount path `/var/data`, size 1GB.
4. Add an environment variable: `DB_PATH` = `/var/data/scores.db`
   (Without this, the SQLite file falls back to the app's own `data/` folder, which is wiped on every deploy/restart on Render's free tier — fine for quick testing, but you'll lose history.)

Render automatically sets `PORT` for you — the app already reads `process.env.PORT`, so no changes are needed there.

## Expanding the question bank

All questions live in `data/questions.json`. Each question has:
```json
{
  "id": 1,
  "domain": "Salesforce Fundamentals",
  "subtopic": "Sharing Solutions",
  "question": "...",
  "options": ["A", "B", "C", "D"],
  "correct": 1,
  "explanation": "..."
}
```
Add more items following this structure — the app automatically picks them up.

## About the source material

Questions were written to comprehensively cover the exam objectives from Salesforce's official
Platform App Builder exam guide, matched at the same percentage weighting as the real exam, and updated
with Summer '26 release changes relevant to the credential (e.g. Flow Orchestration now included at no
extra cost, creating Agentforce agents from Flow Builder, the Flow version-comparison tool, post-run
Execution Path on Screen Flows, and "Ask Agentforce" error troubleshooting in Setup).

I could not log into your Trailhead account to pull the trailmix content directly (never share Trailhead
credentials with an AI assistant or any third party) — this bank is built from the same official
certification blueprint that trailmix is designed to teach.
