import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { S, fmt, Spinner } from '../components/ui'

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
const COLORS = ['#FFD700', '#C0C0C0', '#CD7F32', '#63ffb0', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#34d399', '#fb923c']

export default function TopPage() {
  const [orders, setOrders] = useState([])
  const [pairs, setPairs] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [tab, setTab] = useState('profit') // profit | volume | orders

  const load = useCallback(async () => {
    const { data: o } = await supabase.from('orders').select('*').order('created_at', { ascending: true })
    const { data: p } = await supabase.from('pairs').select('*').order('created_at', { ascending: true })
    setOrders(o || [])
    setPairs(p || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Spinner size={32} /></div>

  // Filter by period
  const now = new Date()
  const cutoff = period === 'today'
    ? new Date(now.toISOString().slice(0, 10))
    : period === 'week'
    ? new Date(now - 7 * 86400000)
    : period === 'month'
    ? new Date(now - 30 * 86400000)
    : new Date('2020-01-01')

  const filteredOrders = orders.filter(o => new Date(o.created_at) >= cutoff)
  const filteredPairs = pairs.filter(p => new Date(p.created_at) >= cutoff)

  // Build worker stats
  const workerMap = {}

  filteredOrders.forEach(o => {
    if (!workerMap[o.worker_name]) workerMap[o.worker_name] = { volume: 0, usdt: 0, count: 0, buy: 0, sell: 0, profit: 0 }
    workerMap[o.worker_name].volume += +o.volume_uah
    workerMap[o.worker_name].usdt += +o.volume_usdt
    workerMap[o.worker_name].count += 1
    if (o.type === 'buy') workerMap[o.worker_name].buy += 1
    else workerMap[o.worker_name].sell += 1
  })

  filteredPairs.forEach(p => {
    const workers = (p.workers || '').split(/[,/]/).map(s => s.trim()).filter(Boolean)
    const share = +(p.profit_uah || 0) / Math.max(workers.length, 1)
    workers.forEach(w => {
      if (!workerMap[w]) workerMap[w] = { volume: 0, usdt: 0, count: 0, buy: 0, sell: 0, profit: 0 }
      workerMap[w].profit += share
    })
  })

  const allWorkers = Object.entries(workerMap).map(([name, d]) => ({ name, ...d }))

  const sorted = {
    profit: [...allWorkers].sort((a, b) => b.profit - a.profit),
    volume: [...allWorkers].sort((a, b) => b.volume - a.volume),
    orders: [...allWorkers].sort((a, b) => b.count - a.count),
  }

  const current = sorted[tab]
  const maxVal = current.length > 0 ? (tab === 'profit' ? current[0].profit : tab === 'volume' ? current[0].volume : current[0].count) : 1

  const getValue = (w) => tab === 'profit' ? w.profit : tab === 'volume' ? w.volume : w.count
  const formatVal = (w) => tab === 'profit' ? `₴${fmt(w.profit)}` : tab === 'volume' ? `₴${fmt(w.volume, 0)}` : `${w.count} ордерів`

  const periodLabel = { today: 'сьогодні', week: 'тиждень', month: 'місяць', all: 'весь час' }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', letterSpacing: '1px' }}>🏆 Топ співробітників</h1>
        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
          Рейтинг за: <span style={{ color: 'var(--green)' }}>{periodLabel[period]}</span>
        </div>
      </div>

      {/* Period & Tab filters */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[['today', 'Сьогодні'], ['week', 'Тиждень'], ['month', 'Місяць'], ['all', 'Весь час']].map(([val, label]) => (
            <button key={val} onClick={() => setPeriod(val)} style={{
              ...S.btnSecondary, padding: '7px 14px', fontSize: '11px',
              color: period === val ? 'var(--green)' : 'var(--text3)',
              borderColor: period === val ? 'rgba(99,255,176,0.4)' : 'rgba(255,255,255,0.08)',
              background: period === val ? 'rgba(99,255,176,0.08)' : 'transparent',
            }}>{label}</button>
          ))}
        </div>
        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ display: 'flex', gap: '6px' }}>
          {[['profit', '💰 Профіт'], ['volume', '📦 Об\'єм'], ['orders', '📋 Ордери']].map(([val, label]) => (
            <button key={val} onClick={() => setTab(val)} style={{
              ...S.btnSecondary, padding: '7px 14px', fontSize: '11px',
              color: tab === val ? 'var(--yellow)' : 'var(--text3)',
              borderColor: tab === val ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)',
              background: tab === val ? 'rgba(251,191,36,0.06)' : 'transparent',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {current.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '60px', color: 'var(--text3)' }}>
          Немає даних за вибраний період
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          {current.length >= 3 && (
            <div style={{ ...S.card, marginBottom: '16px', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '12px', padding: '20px 0 10px' }}>
                {/* 2nd place */}
                <div style={{ textAlign: 'center', flex: 1, maxWidth: '160px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🥈</div>
                  <div style={{
                    background: 'rgba(192,192,192,0.1)', border: '1px solid rgba(192,192,192,0.3)',
                    borderRadius: '10px 10px 0 0', padding: '16px 8px', height: '100px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#C0C0C0', marginBottom: '4px' }}>{current[1].name}</div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#C0C0C0' }}>{formatVal(current[1])}</div>
                  </div>
                </div>

                {/* 1st place */}
                <div style={{ textAlign: 'center', flex: 1, maxWidth: '180px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '8px' }}>🥇</div>
                  <div style={{
                    background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.4)',
                    borderRadius: '10px 10px 0 0', padding: '20px 8px', height: '130px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center',
                    boxShadow: '0 0 20px rgba(255,215,0,0.1)',
                  }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#FFD700', marginBottom: '6px' }}>{current[0].name}</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#FFD700' }}>{formatVal(current[0])}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,215,0,0.6)', marginTop: '4px' }}>👑 ЛІДЕР</div>
                  </div>
                </div>

                {/* 3rd place */}
                <div style={{ textAlign: 'center', flex: 1, maxWidth: '160px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🥉</div>
                  <div style={{
                    background: 'rgba(205,127,50,0.1)', border: '1px solid rgba(205,127,50,0.3)',
                    borderRadius: '10px 10px 0 0', padding: '16px 8px', height: '80px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#CD7F32', marginBottom: '4px' }}>{current[2].name}</div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#CD7F32' }}>{formatVal(current[2])}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Full ranking list */}
          <div style={S.card}>
            <div style={S.cardTitle}>Повний рейтинг</div>
            {current.map((w, i) => {
              const pct = maxVal > 0 ? (getValue(w) / maxVal) * 100 : 0
              const isTop3 = i < 3
              return (
                <div key={w.name} style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  marginBottom: '8px',
                  background: isTop3 ? `rgba(${i === 0 ? '255,215,0' : i === 1 ? '192,192,192' : '205,127,50'}, 0.05)` : 'rgba(255,255,255,0.02)',
                  border: `1px solid rgba(${i === 0 ? '255,215,0' : i === 1 ? '192,192,192' : i === 2 ? '205,127,50' : '255,255,255'}, ${isTop3 ? '0.2' : '0.05'})`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    {/* Medal / number */}
                    <div style={{ fontSize: i < 10 ? '20px' : '14px', width: '28px', textAlign: 'center', flexShrink: 0 }}>
                      {MEDALS[i] || `${i + 1}`}
                    </div>

                    {/* Name */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: COLORS[i] || 'var(--text2)' }}>{w.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>
                        {w.count} ордерів · buy: {w.buy} · sell: {w.sell}
                      </div>
                    </div>

                    {/* Stats */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: COLORS[i] || 'var(--text2)' }}>
                        {formatVal(w)}
                      </div>
                      {tab !== 'profit' && w.profit > 0 && (
                        <div style={{ fontSize: '10px', color: 'var(--green)', marginTop: '2px' }}>
                          профіт ₴{fmt(w.profit, 0)}
                        </div>
                      )}
                      {tab !== 'volume' && w.volume > 0 && (
                        <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>
                          об'єм ₴{fmt(w.volume, 0)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                    <div style={{
                      height: '100%', borderRadius: '2px',
                      width: `${pct}%`,
                      background: COLORS[i] || 'var(--text3)',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
