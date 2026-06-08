import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { S, Spinner } from '../components/ui'

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function StatusLogsPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterWorker, setFilterWorker] = useState('all')
  const [dateFrom, setDateFrom] = useState(todayStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [period, setPeriod] = useState('today')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('status_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    setLogs(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const applyPeriod = (p) => {
    setPeriod(p)
    const t = todayStr()
    if (p === 'today') { setDateFrom(t); setDateTo(t) }
    if (p === 'week') { const d = new Date(); d.setDate(d.getDate() - 7); setDateFrom(d.toISOString().slice(0, 10)); setDateTo(t) }
    if (p === 'month') { const d = new Date(); d.setMonth(d.getMonth() - 1); setDateFrom(d.toISOString().slice(0, 10)); setDateTo(t) }
    if (p === 'all') { setDateFrom('2020-01-01'); setDateTo(t) }
  }

  const workers = [...new Set(logs.map(l => l.worker_name))]

  const filtered = logs.filter(l => {
    const d = l.created_at.slice(0, 10)
    const workerOk = filterWorker === 'all' || l.worker_name === filterWorker
    const fromOk = d >= dateFrom
    const toOk = d <= dateTo
    return workerOk && fromOk && toOk
  })

  // Calculate work sessions (online → offline pairs)
  const sessions = []
  const workerSessions = {}

  filtered.slice().reverse().forEach(log => {
    const w = log.worker_name
    if (!workerSessions[w]) workerSessions[w] = null

    if (log.status === 'online') {
      workerSessions[w] = log.created_at
    } else if (log.status === 'offline' && workerSessions[w]) {
      const start = new Date(workerSessions[w])
      const end = new Date(log.created_at)
      const diffMs = end - start
      const hours = Math.floor(diffMs / 3600000)
      const mins = Math.floor((diffMs % 3600000) / 60000)
      sessions.push({
        worker: w,
        start: workerSessions[w],
        end: log.created_at,
        duration: diffMs > 0 ? `${hours}г ${mins}хв` : '—',
      })
      workerSessions[w] = null
    }
  })

  sessions.sort((a, b) => new Date(b.start) - new Date(a.start))

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Spinner size={32} /></div>

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', letterSpacing: '1px' }}>🕐 Журнал онлайну</h1>
        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>Коли воркери заходили та виходили</div>
      </div>

      {/* Filters */}
      <div style={{ ...S.card, padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[['today', 'Сьогодні'], ['week', 'Тиждень'], ['month', 'Місяць'], ['all', 'Всі']].map(([val, label]) => (
              <button key={val} onClick={() => applyPeriod(val)} style={{
                ...S.btnSecondary, padding: '7px 12px', fontSize: '11px',
                color: period === val ? 'var(--green)' : 'var(--text3)',
                borderColor: period === val ? 'rgba(99,255,176,0.4)' : 'rgba(255,255,255,0.08)',
                background: period === val ? 'rgba(99,255,176,0.08)' : 'transparent',
              }}>{label}</button>
            ))}
          </div>
          <select value={filterWorker} onChange={e => setFilterWorker(e.target.value)} style={{ ...S.select, width: 'auto' }}>
            <option value="all">Всі воркери</option>
            {workers.map(w => <option key={w}>{w}</option>)}
          </select>
        </div>
      </div>

      {/* Sessions summary */}
      {sessions.length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>⏱ Сесії роботи ({sessions.length})</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Воркер', 'Початок', 'Кінець', 'Тривалість'].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={i}>
                    <td style={{ ...S.td, fontWeight: '600', color: 'var(--text)' }}>{s.worker}</td>
                    <td style={{ ...S.td, color: '#22c55e' }}>
                      {new Date(s.start).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })}
                      {' '}
                      {new Date(s.start).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ ...S.td, color: 'var(--red)' }}>
                      {new Date(s.end).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })}
                      {' '}
                      {new Date(s.end).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ ...S.td, color: 'var(--yellow)', fontWeight: '700' }}>{s.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full log */}
      <div style={S.card}>
        <div style={S.cardTitle}>Повний журнал ({filtered.length} записів)</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Дата', 'Час', 'Воркер', 'Статус'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id}>
                  <td style={S.td}>{new Date(l.created_at).toLocaleDateString('uk-UA')}</td>
                  <td style={{ ...S.td, fontWeight: '600', color: 'var(--text2)' }}>
                    {new Date(l.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td style={{ ...S.td, color: 'var(--text)' }}>{l.worker_name}</td>
                  <td style={S.td}>
                    <span style={{
                      background: l.status === 'online' ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)',
                      border: `1px solid ${l.status === 'online' ? 'rgba(34,197,94,0.3)' : 'rgba(100,116,139,0.3)'}`,
                      color: l.status === 'online' ? '#22c55e' : 'var(--text3)',
                      padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
                    }}>
                      {l.status === 'online' ? '🔋 онлайн' : '🪫 офлайн'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>Немає записів</div>}
        </div>
      </div>
    </div>
  )
}
