# AI-Powered UX Analytics MVP - Phase 1

A foundational system capable of data capture from user interactions on any website, with real-time analytics dashboard.

## Project Structure

```
ux-analytics-mvp/
├── backend/          # Node.js + Express API server
├── frontend/         # React dashboard using Vite
├── js-snippet/       # Vanilla JS tracking snippet
└── README.md
```

## Features

- **Event Capture**: Tracks clicks (coordinates & element selectors) and scroll depth
- **JSON Schema Validation**: Validates incoming event batches with Ajv
- **SQLite Storage**: Local database for event persistence
- **Real-time Dashboard**: React UI with Server-Sent Events for live updates
- **Minimal Runtime Overhead**: Batched events with throttling to avoid performance impact

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm install
npm run dev
```

The backend API will be available at `http://localhost:4000`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The dashboard will be available at `http://localhost:5173`

### 3. Integrate Tracking Snippet

Add this to any website you want to track:

```html
<script src="http://localhost:4000/snippet.js"></script>
```

Or use the standalone file:
```html
<script src="path/to/js-snippet/analytics.js"></script>
```

## API Endpoints

- `GET /health` - Health check
- `POST /events` - Accept batched events
- `GET /metrics` - Get aggregated metrics
- `GET /metrics/stream` - Server-Sent Events for real-time updates
- `GET /snippet.js` - Dynamically served tracking snippet

## Event Schema

```javascript
{
  sessionId: string,     // Anonymous session identifier
  pageUrl: string,       // Current page URL
  eventType: 'click' | 'scroll',
  elementSelector: string | null,  // CSS selector for clicked element
  clickX: number | null,           // Click X coordinate relative to element
  clickY: number | null,           // Click Y coordinate relative to element
  scrollDepth: number | null,      // Scroll percentage (0-100)
  timestamp: number                // Unix timestamp
}
```

## Dashboard Metrics

- **Total Events**: Count of all captured events
- **Total Sessions**: Count of unique sessions
- **Average Scroll Depth**: Mean scroll percentage across all scroll events
- **Top Clicked Elements**: Most frequently clicked elements by CSS selector

## Development

### Backend Scripts
- `npm run dev` - Start with nodemon for auto-reload
- `npm start` - Production start

### Frontend Scripts
- `npm run dev` - Vite dev server with hot reload
- `npm run build` - Production build
- `npm run preview` - Preview production build

## Technical Considerations

### Performance Optimizations
- Event batching (default: 10 events per batch)
- Scroll throttling (default: 1 second)
- Automatic flush every 3 seconds
- Uses `sendBeacon` when available for reliable event delivery

### Privacy & Security
- No PII collection - uses anonymous session IDs
- Events stored locally in SQLite
- CORS enabled for cross-origin requests

## Next Steps

Phase 1 provides the foundation for:
- Heatmap generation from click coordinates
- User journey analysis from page sequences
- A/B testing framework integration
- Advanced analytics and ML-powered insights

## License

Open source - feel free to use and modify for your projects.