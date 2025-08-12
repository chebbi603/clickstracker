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
  const [issues, setIssues] = useState([])
  const [loadingIssues, setLoadingIssues] = useState(false)
  const [feedbackStatus, setFeedbackStatus] = useState({})

  const fetchMetrics = async () => {
    try {
      const res = await fetch('http://localhost:4000/metrics')
      const data = await res.json()
      setMetrics(data)
      setLastUpdate(new Date())
    } catch (e) {
      console.error('Failed to fetch metrics', e)
    }
  }

  const fetchIssues = async () => {
    try {
      setLoadingIssues(true)
      const res = await fetch('http://localhost:4000/rules/issues', { credentials: 'include' })
      const data = await res.json()
      setIssues(data.issues || [])
    } catch (e) {
      console.error('Failed to fetch issues', e)
    } finally {
      setLoadingIssues(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    fetchIssues()
    const interval = setInterval(fetchMetrics, 5000)
    return () => clearInterval(interval)
  }, [])

  useSSE('http://localhost:4000/metrics/stream', (evt) => {
    if (evt && evt.type === 'metrics_update') {
      fetchMetrics()
      fetchIssues()
    }
  })

  const totalEvents = metrics?.totalEvents?.[0]?.count || 0
  const totalSessions = metrics?.totalSessions?.[0]?.count || 0
  const avgScroll = Math.round(metrics?.averageScrollDepth?.[0]?.avg_depth || 0)
  const topClicks = metrics?.topClickedElements || []

  const handleFeedback = async (issueId, suggestion, action) => {
    try {
      setFeedbackStatus((s) => ({ ...s, [issueId + ':' + suggestion]: 'saving' }))
      await fetch('http://localhost:4000/rules/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ issueId, suggestionId: suggestion, action })
      })
      setFeedbackStatus((s) => ({ ...s, [issueId + ':' + suggestion]: 'saved' }))
    } catch (e) {
      console.error('Failed to send feedback', e)
      setFeedbackStatus((s) => ({ ...s, [issueId + ':' + suggestion]: 'error' }))
    }
  }

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

      <div style={{ marginTop: 24 }}>
        <h2>Detected UX Issues</h2>
        {loadingIssues && <div>Analyzing issues…</div>}
        {!loadingIssues && issues.length === 0 && <div>No issues detected yet</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          {issues.map((issue) => (
            <div key={issue.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600 }}>
                  {issue.ruleName} <span style={{ color: '#6b7280' }}>({issue.severity})</span>
                </div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{new Date(issue.detectedAt || Date.now()).toLocaleTimeString()}</div>
              </div>
              <div style={{ marginTop: 6, color: '#374151' }}>{issue.description}</div>
              <div style={{ marginTop: 6, color: '#6b7280', fontSize: 12 }}>
                <code>{issue.pageUrl}</code>{issue.elementSelector ? <> · <code>{issue.elementSelector}</code></> : null}
              </div>
              {issue.metrics && (
                <div style={{ marginTop: 8, color: '#111827', fontSize: 13 }}>
                  {Object.entries(issue.metrics).map(([k, v]) => (
                    <span key={k} style={{ marginRight: 12 }}>
                      <span style={{ color: '#6b7280' }}>{k}:</span> {typeof v === 'number' ? Math.round(v * 1000) / 1000 : String(v)}
                    </span>
                  ))}
                </div>
              )}
              {Array.isArray(issue.suggestions) && issue.suggestions.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Suggestions</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {issue.suggestions.map((sugg) => (
                      <li key={sugg.id} style={{ marginBottom: 6 }}>
                        <span>{sugg.text || String(sugg)}</span>
                        <div style={{ display: 'inline-flex', gap: 8, marginLeft: 8 }}>
                          <button onClick={() => handleFeedback(issue.id, sugg.id || String(sugg), 'accept')} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #10b981', background: '#d1fae5', color: '#065f46' }}>
                             Accept
                           </button>
                          <button onClick={() => handleFeedback(issue.id, sugg.id || String(sugg), 'reject')} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #ef4444', background: '#fee2e2', color: '#991b1b' }}>
                             Reject
                           </button>
                          {feedbackStatus[issue.id + ':' + (sugg.id || String(sugg))] === 'saving' && <span style={{ color: '#6b7280' }}>Saving…</span>}
                          {feedbackStatus[issue.id + ':' + (sugg.id || String(sugg))] === 'saved' && <span style={{ color: '#10b981' }}>Saved</span>}
                          {feedbackStatus[issue.id + ':' + (sugg.id || String(sugg))] === 'error' && <span style={{ color: '#ef4444' }}>Error</span>}
                         </div>
                       </li>
                     ))}
                   </ul>
                </div>
              )}
            </div>
          ))}
        </div>
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