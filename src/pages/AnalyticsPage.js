import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { S, fmt, Spinner } from '../components/ui'

const COLORS = ['#63ffb0', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#34d399']

export default function AnalyticsPage() {
  const [orders, setOrders] = useState([])
  const [pairs, setPairs] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month') // week | month | all
  const [activeTab, setActiveTab] = useState('profit') // profit | activity

  const load = useCallback(async () => {
    const { data: o } = await supabase.from('orders').select('*').order('created_at', { ascending: true })
    const { data: p } = await supabase.from('pairs').select('*').order('created_at', { ascending: true })
    setOrders(o || [])
    setPairs(p || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Spinner size={32} /></div>

  // ── Filter by period ──────────────────────────────────────────
  const now = new Date()
  const cutoff = period === 'week'
    ? new Date(now - 7 * 86400000)
    : period === 'month'
    ? new Date(now - 30 * 86400000)
    : new Date('2020-01-01')

  const filteredOrders = orders.filter(o => new Date(o.created_at) >= cutoff)
  const filteredPairs = pairs.filter(p => new Date(p.created_at) >= cutoff)

  // ── Weekly profit chart data ──────────────────────────────────
  const getWeekKey = (iso) => {
    const d = new Date(iso)
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return monday.toISOString().slice(0, 10)
  }

  const weekMap = {}
  filteredPairs.forEach(p => {
    const k = getWeekKey(p.created_at)
    if (!weekMap[k]) weekMap[k] = { profit: 0, count: 0 }
    weekMap[k].profit += +(p.profit_uah || 0)
    weekMap[k].count += 1
  })

  const weeks = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, val]) => ({
      label: new Date(date).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }),
      profit: val.profit,
      count: val.count,
    }))

  const maxProfit = Math.max(...weeks.map(w => w.profit), 1)

  // ── Top workers by volume ─────────────────────────────────────
  const workerMap = {}
  filteredOrders.forEach(o => {
    if (!workerMap[o.worker_name]) workerMap[o.worker_name] = { uah: 0, usdt: 0, count: 0, buy: 0, sell: 0 }
    // Объём только по покупкам
    if (o.type === 'buy') {
      workerMap[o.worker_name].uah += +o.volume_uah
      workerMap[o.worker_name].usdt += +o.volume_usdt
      workerMap[o.worker_name].buy += 1
    } else {
      workerMap[o.worker_name].sell += 1
    }
    workerMap[o.worker_name].count += 1
  })

  const topByVolume = Object.entries(workerMap)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.usdt - a.usdt)

  const maxUSDT = Math.max(...topByVolume.map(w => w.usdt), 1)

  // ── Top workers by profit (from pairs) ───────────────────────
  const profitMap = {}
  filteredPairs.forEach(p => {
    const workers = (p.workers || '').split(/[,/]/).map(s => s.trim()).filter(Boolean)
    const share = +(p.profit_uah || 0) / workers.length
    workers.forEach(w => {
      if (!profitMap[w]) profitMap[w] = 0
      profitMap[w] += share
    })
  })

  const topByProfit = Object.entries(profitMap)
    .map(([name, profitUah]) => ({ name, profitUah }))
    .sort((a, b) => b.profitUah - a.profitUah)

  const maxProfitW = Math.max(...topByProfit.map(w => w.profitUah), 1)

  // ── Summary stats ─────────────────────────────────────────────
  const totalProfit = filteredPairs.reduce((s, p) => s + +(p.profit_uah || 0), 0)
  const buyOrders = filteredOrders.filter(o => o.type === 'buy')
  const totalVolume = buyOrders.reduce((s, o) => s + +o.volume_uah, 0)
  const totalVolumeUSDT = buyOrders.reduce((s, o) => s + +o.volume_usdt, 0)
  const avgProfitPerPair = filteredPairs.length ? totalProfit / filteredPairs.length : 0

  // Средний курс покупки за период — для конвертации в USD
  const avgBuyRate = totalVolumeUSDT > 0 ? totalVolume / totalVolumeUSDT : 0
  const toUSD = (uah) => avgBuyRate > 0 ? (uah / avgBuyRate).toFixed(2) : null

  // ── Activity by day of week ──────────────────────────────────
  const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
  const dayStats = Array(7).fill(null).map((_, i) => ({
    day: DAY_NAMES[i],
    orders: 0,
    usdt: 0,
    profitUah: 0,
    workerActivity: {}
  }))

  filteredOrders.forEach(o => {
    const d = new Date(o.created_at)
    const dow = (d.getDay() + 6) % 7 // 0=Mon, 6=Sun
    dayStats[dow].orders += 1
    if (o.type === 'buy') {
      dayStats[dow].usdt += +o.volume_usdt
    }
    if (!dayStats[dow].workerActivity[o.worker_name]) dayStats[dow].workerActivity[o.worker_name] = 0
    dayStats[dow].workerActivity[o.worker_name] += 1
  })

  filteredPairs.forEach(p => {
    const d = new Date(p.created_at)
    const dow = (d.getDay() + 6) % 7
    dayStats[dow].profitUah += +(p.profit_uah || 0)
  })

  const maxOrders = Math.max(...dayStats.map(d => d.orders), 1)
  const maxUsdt = Math.max(...dayStats.map(d => d.usdt), 1)
  const maxProfit2 = Math.max(...dayStats.map(d => d.profitUah), 1)
  const allWorkerNames = [...new Set(filteredOrders.map(o => o.worker_name))]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', letterSpacing: '1px' }}>📈 Аналітика</h1>
          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>Графіки та статистика по співробітниках</div>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[['week', 'Тиждень'], ['month', 'Місяць'], ['all', 'Весь час']].map(([val, label]) => (
              <button key={val} onClick={() => setPeriod(val)} style={{
                ...S.btnSecondary,
                padding: '7px 14px', fontSize: '11px',
                color: period === val ? 'var(--green)' : 'var(--text3)',
                borderColor: period === val ? 'rgba(99,255,176,0.4)' : 'rgba(255,255,255,0.08)',
                background: period === val ? 'rgba(99,255,176,0.08)' : 'transparent',
              }}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[['profit', '📈 Профіт'], ['activity', '📅 Активність']].map(([val, label]) => (
              <button key={val} onClick={() => setActiveTab(val)} style={{
                ...S.btnSecondary,
                padding: '7px 14px', fontSize: '11px',
                color: activeTab === val ? 'var(--yellow)' : 'var(--text3)',
                borderColor: activeTab === val ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)',
                background: activeTab === val ? 'rgba(251,191,36,0.06)' : 'transparent',
              }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'activity' && (
        <>
          {/* Activity by day of week */}
          <div style={S.card}>
            <div style={S.cardTitle}>Активність по днях тижня</div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: '500px' }}>
                {/* Bars */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '180px', padding: '0 10px', marginBottom: '8px' }}>
                  {dayStats.map((d, i) => {
                    const hOrders = Math.max((d.orders / maxOrders) * 160, d.orders > 0 ? 4 : 0)
                    const hUsdt = Math.max((d.usdt / maxUsdt) * 160, d.usdt > 0 ? 4 : 0)
                    const isWeekend = i >= 5
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--green)', fontWeight: '700' }}>{d.orders > 0 ? d.orders : ''}</div>
                        <div style={{ width: '100%', display: 'flex', gap: '3px', alignItems: 'flex-end', height: '160px' }}>
                          {/* Orders bar */}
                          <div style={{ flex: 1, height: `${hOrders}px`, background: isWeekend ? 'rgba(251,191,36,0.5)' : 'rgba(99,255,176,0.5)', borderRadius: '3px 3px 0 0', minHeight: d.orders > 0 ? '4px' : '0', transition: 'height 0.4s' }} />
                          {/* USDT bar */}
                          <div style={{ flex: 1, height: `${hUsdt}px`, background: isWeekend ? 'rgba(251,191,36,0.3)' : 'rgba(96,165,250,0.4)', borderRadius: '3px 3px 0 0', minHeight: d.usdt > 0 ? '4px' : '0', transition: 'height 0.4s' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* X labels */}
                <div style={{ display: 'flex', gap: '10px', padding: '0 10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                  {dayStats.map((d, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: i >= 5 ? 'var(--yellow)' : 'var(--text2)' }}>{d.day}</div>
                      <div style={{ fontSize: '9px', color: 'var(--text3)', marginTop: '2px' }}>{fmt(d.usdt, 0)} USDT</div>
                    </div>
                  ))}
                </div>
                {/* Legend */}
                <div style={{ display: 'flex', gap: '16px', padding: '12px 10px 0', fontSize: '10px', color: 'var(--text3)' }}>
                  <span>🟩 Кількість ордерів</span>
                  <span>🟦 Об'єм USDT</span>
                  <span style={{ color: 'var(--yellow)' }}>🟨 Вихідні</span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity per worker per day */}
          <div style={S.card}>
            <div style={S.cardTitle}>Активність воркерів по днях</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
                <thead>
                  <tr>
                    <th style={S.th}>Воркер</th>
                    {DAY_NAMES.map((d, i) => <th key={d} style={{ ...S.th, color: i >= 5 ? 'var(--yellow)' : 'var(--text3)' }}>{d}</th>)}
                    <th style={S.th}>Всього</th>
                  </tr>
                </thead>
                <tbody>
                  {allWorkerNames.map(worker => {
                    const total = dayStats.reduce((s, d) => s + (d.workerActivity[worker] || 0), 0)
                    const maxDay = Math.max(...dayStats.map(d => d.workerActivity[worker] || 0), 1)
                    return (
                      <tr key={worker}>
                        <td style={{ ...S.td, fontWeight: '600', color: 'var(--text)' }}>{worker}</td>
                        {dayStats.map((d, i) => {
                          const cnt = d.workerActivity[worker] || 0
                          const intensity = cnt / maxDay
                          return (
                            <td key={i} style={{ ...S.td, textAlign: 'center' }}>
                              <div style={{
                                display: 'inline-block', minWidth: '28px', padding: '3px 6px',
                                borderRadius: '4px', fontSize: '11px', fontWeight: '700',
                                background: cnt > 0 ? `rgba(99,255,176,${0.08 + intensity * 0.25})` : 'transparent',
                                color: cnt > 0 ? 'var(--green)' : 'var(--text3)',
                                border: cnt > 0 ? `1px solid rgba(99,255,176,${0.1 + intensity * 0.3})` : '1px solid transparent',
                              }}>{cnt > 0 ? cnt : '—'}</div>
                            </td>
                          )
                        })}
                        <td style={{ ...S.td, color: 'var(--yellow)', fontWeight: '700', textAlign: 'center' }}>{total}</td>
                      </tr>
                    )
                  })}
                  {/* Total row */}
                  <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <td style={{ ...S.td, fontWeight: '700', color: 'var(--text3)', fontSize: '10px', letterSpacing: '1px' }}>ВСЬОГО</td>
                    {dayStats.map((d, i) => (
                      <td key={i} style={{ ...S.td, textAlign: 'center', fontWeight: '700', color: i >= 5 ? 'var(--yellow)' : 'var(--text2)' }}>{d.orders || '—'}</td>
                    ))}
                    <td style={{ ...S.td, color: 'var(--green)', fontWeight: '800', textAlign: 'center' }}>{filteredOrders.length}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'profit' && <>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        {[
          { label: 'Загальний профіт', value: avgBuyRate > 0 ? `${fmt(totalProfit / avgBuyRate)} USDT` : `₴${fmt(totalProfit)}`, sub: `₴${fmt(totalProfit)}`, color: 'var(--green)' },
          { label: 'Об\'єм UAH', value: `₴${fmt(totalVolume, 0)}`, color: 'var(--yellow)' },
          { label: 'Кількість пар', value: filteredPairs.length, color: 'var(--blue)' },
          { label: 'Сер. профіт/пара', value: avgBuyRate > 0 ? `${fmt(avgProfitPerPair / avgBuyRate)} USDT` : `₴${fmt(avgProfitPerPair)}`, sub: `₴${fmt(avgProfitPerPair)}`, color: 'var(--green)' },
          { label: 'Ордерів', value: filteredOrders.length, color: 'var(--text)' },
        ].map(c => (
          <div key={c.label} style={S.card}>
            <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>{c.label}</div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: c.color }}>{c.value}</div>
            {c.sub && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Weekly profit chart */}
      <div style={S.card}>
        <div style={S.cardTitle}>Профіт по тижнях</div>
        {weeks.length === 0
          ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>Немає даних за вибраний період</div>
          : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: Math.max(weeks.length * 80, 400), padding: '10px 0' }}>
              {/* Chart bars */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '200px', padding: '0 10px' }}>
                {weeks.map((w, i) => {
                  const h = Math.max((w.profit / maxProfit) * 180, 4)
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      {/* Value label */}
                      <div style={{ fontSize: '10px', color: 'var(--green)', fontWeight: '700', whiteSpace: 'nowrap' }}>
                        ₴{fmt(w.profit, 0)}
                      </div>
                      {/* Bar */}
                      <div style={{
                        width: '100%', height: `${h}px`,
                        background: `linear-gradient(180deg, #63ffb0, rgba(99,255,176,0.3))`,
                        borderRadius: '4px 4px 0 0',
                        position: 'relative',
                        minHeight: '4px',
                        transition: 'height 0.3s ease',
                        boxShadow: '0 0 12px rgba(99,255,176,0.2)',
                      }} />
                    </div>
                  )
                })}
              </div>
              {/* X labels */}
              <div style={{ display: 'flex', gap: '8px', padding: '8px 10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {weeks.map((w, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '10px', color: 'var(--text3)' }}>
                    {w.label}
                    <div style={{ color: 'var(--text3)', fontSize: '9px', marginTop: '2px' }}>{w.count} пар</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Top by volume */}
        <div style={S.card}>
          <div style={S.cardTitle}>Топ по об'єму USDT</div>
          {topByVolume.length === 0
            ? <div style={{ color: 'var(--text3)', fontSize: '12px' }}>Немає даних</div>
            : topByVolume.map((w, i) => (
            <div key={w.name} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: COLORS[i % COLORS.length],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: '800', color: '#0a0e1a', flexShrink: 0,
                  }}>{i + 1}</span>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)' }}>{w.name}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--blue)' }}>{fmt(w.usdt)} USDT</div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)' }}>₴{fmt(w.uah, 0)} · buy:{w.buy} sell:{w.sell}</div>
                </div>
              </div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                <div style={{
                  height: '100%', borderRadius: '2px',
                  width: `${(w.usdt / maxUSDT) * 100}%`,
                  background: COLORS[i % COLORS.length],
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Top by profit */}
        <div style={S.card}>
          <div style={S.cardTitle}>Топ по профіту USDT</div>
          {topByProfit.length === 0
            ? <div style={{ color: 'var(--text3)', fontSize: '12px' }}>Немає даних. Створіть пари для підрахунку профіту.</div>
            : topByProfit.map((w, i) => (
            <div key={w.name} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: COLORS[i % COLORS.length],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: '800', color: '#0a0e1a', flexShrink: 0,
                  }}>{i + 1}</span>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)' }}>{w.name}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--green)' }}>{toUSD(w.profitUah) ? `${fmt(toUSD(w.profitUah))} USDT` : `₴${fmt(w.profitUah)}`}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)' }}>₴{fmt(w.profitUah)}</div>
                </div>
              </div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                <div style={{
                  height: '100%', borderRadius: '2px',
                  width: `${(w.profitUah / maxProfitW) * 100}%`,
                  background: COLORS[i % COLORS.length],
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      </>
    }
    </div>
  )
}
