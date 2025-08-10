import React, { useEffect, useMemo, useState } from 'react'

function useSSE(url, onMessage) {
  useEffect(() => {
    const es = new EventSource(url)
    es.onmessage = (ev) => {
      try { onMessage && onMessage(JSON.parse(ev.data)) } catch {}
    }
    return () => es.close()
  }, [url, onMessage])
}

function App() {
  const [metrics, setMetrics] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/metrics')
      const data = await res.json()
      setMetrics(data)
      setLastUpdate(new Date())
    } catch (e) {
      console.error('Failed to fetch metrics', e)
    }
  }

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 5000)
    return () => clearInterval(interval)
  }, [])

  useSSE('/metrics/stream', (evt) => {
    if (evt && evt.type === 'metrics_update') {
      fetchMetrics()
    }
  })

  const totalEvents = metrics?.totalEvents?.[0]?.count || 0
  const totalSessions = metrics?.totalSessions?.[0]?.count || 0
  const avgScroll = Math.round(metrics?.averageScrollDepth?.[0]?.avg_depth || 0)
  const topClicks = metrics?.topClickedElements || []

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 24, lineHeight: 1.5 }}>
      <h1>UX Analytics Dashboard</h1>
      <p style={{ color: '#555' }}>Real-time metrics from your instrumented sites</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}>
        <StatCard label="Total Events" value={totalEvents} />
        <StatCard label="Total Sessions" value={totalSessions} />
        <StatCard label="Avg. Scroll Depth" value={`${avgScroll}%`} />
      </div>

      <div style={{ marginTop: 24 }}>
        <h2>Top Clicked Elements</h2>
        <ul>
          {topClicks.map((row, i) => (
            <li key={i}>
              <code>{row.element_selector || '(unknown)'}</code> - {row.clicks}
            </li>
          ))}
          {topClicks.length === 0 && <li>No clicks yet</li>}
        </ul>
      </div>

      <footer style={{ marginTop: 32, color: '#777' }}>
        Last update: {lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}
      </footer>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div style={{ background: '#f7f7f8', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
      <div style={{ color: '#6b7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  )
}

export default App