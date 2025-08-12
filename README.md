# UX Analytics MVP

A small, practical setup for capturing user interactions on any site and viewing them in a clean dashboard. It includes a tracking snippet, an Express API with SQLite storage, a React/Vite dashboard, and a simple rules engine that flags UX issues with suggestions.

## What’s inside
- backend: Node.js + Express API, SQLite, SSE for live updates, rules engine
- frontend: React + Vite dashboard
- js-snippet: tiny vanilla JS tracker served by the backend or used standalone

## Features
- Capture clicks (selector + coordinates) and scroll depth
- Real‑time metrics (events, sessions, top clicks, avg scroll)
- Rules engine: detects low click rate, low scroll depth, rage clicks, dead clicks, high exit rate
- Actionable suggestions per issue + quick feedback (accept/reject)

## Quick start
1) Backend
- cd backend
- npm install
- npm run dev
- API runs on http://localhost:4000

2) Frontend
- cd frontend
- npm install
- npm run dev
- Dashboard on http://localhost:5173

3) Add the tracking snippet to any page you want to measure
<script src="http://localhost:4000/snippet.js"></script>
Or use the standalone file in js-snippet/analytics.js if you need to host it yourself.

4) (Optional) Seed demo data to see issues right away
From the project root:
node backend/test-data-generator.js

## API overview
- GET /health – health check
- POST /events – accept batched events
- GET /metrics – aggregated metrics
- GET /metrics/stream – live updates (SSE)
- GET /snippet.js – dynamic tracking snippet
- GET /rules/config – rules + thresholds
- GET /rules/issues – detected UX issues + suggestions
- POST /rules/feedback – accept/reject a suggestion (MVP logs only)

## Event shape
{
  sessionId: string,
  pageUrl: string,
  eventType: 'click' | 'scroll',
  elementSelector: string | null,
  clickX: number | null,
  clickY: number | null,
  scrollDepth: number | null,
  timestamp: number
}

## Notes
- If you see a net::ERR_ABORTED for /metrics/stream in DevTools, it’s typically harmless and does not affect the dashboard.
- CORS is configured for local dev (frontend on 5173, API on 4000). If you serve pages from file://, Origin is "null" and is allowed.
- No PII is collected; session IDs are anonymous. Data is stored locally in SQLite.

## License
MIT. Use it, tweak it, ship it.