import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { S, fmt, Spinner } from '../components/ui'

const today = () => new Date().toISOString().slice(0, 10)

export default function MyReportPage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('today')
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo] = useState(today())
  const [selectedIds, setSelectedIds] = useState([])
  const [showTodayAll, setShowTodayAll] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('worker_id', profile?.id)
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => { if (profile) load() }, [profile, load])

  // Period quick buttons
  const applyPeriod = (p) => {
    setPeriod(p)
    setSelectedIds([])
    const t = today()
    if (p === 'today') { setDateFrom(t); setDateTo(t) }
    if (p === 'week') { const d = new Date(); d.setDate(d.getDate() - 7); setDateFrom(d.toISOString().slice(0, 10)); setDateTo(t) }
    if (p === 'month') { const d = new Date(); d.setMonth(d.getMonth() - 1); setDateFrom(d.toISOString().slice(0, 10)); setDateTo(t) }
    if (p === 'custom') { /* keep current */ }
  }

  const filtered = orders.filter(o => {
    const d = o.created_at.slice(0, 10)
    return d >= dateFrom && d <= dateTo
  })

  // Today all analytics
  const todayOrders = orders.filter(o => o.created_at.slice(0, 10) === today())
  const todayBuy = todayOrders.filter(o => o.type === 'buy')
  const todaySell = todayOrders.filter(o => o.type === 'sell')
  const todayBuyUAH = todayBuy.reduce((s, o) => s + +o.volume_uah, 0)
  const todayBuyUSDT = todayBuy.reduce((s, o) => s + +o.volume_usdt, 0)
  const todaySellUAH = todaySell.reduce((s, o) => s + +o.volume_uah, 0)
  const todaySellUSDT = todaySell.reduce((s, o) => s + +o.volume_usdt, 0)
  const todayAvgBuy = todayBuyUSDT > 0 ? todayBuyUAH / todayBuyUSDT : 0
  const todayAvgSell = todaySellUSDT > 0 ? todaySellUAH / todaySellUSDT : 0
  const todaySpread = todayAvgBuy && todayAvgSell ? (((todayAvgSell - todayAvgBuy) / todayAvgBuy) * 100).toFixed(3) : null
  const todayMinUSDT = Math.min(todayBuyUSDT, todaySellUSDT)
  const todayProfit = todayAvgBuy && todayAvgSell && todayMinUSDT > 0
    ? ((todayAvgSell - todayAvgBuy) * todayMinUSDT).toFixed(2)
    : null

  // Selected orders calc
  const selectedOrders = filtered.filter(o => selectedIds.includes(o.id))
  const selBuy = selectedOrders.filter(o => o.type === 'buy')
  const selSell = selectedOrders.filter(o => o.type === 'sell')
  const selBuyUAH = selBuy.reduce((s, o) => s + +o.volume_uah, 0)
  const selBuyUSDT = selBuy.reduce((s, o) => s + +o.volume_usdt, 0)
  const selSellUAH = selSell.reduce((s, o) => s + +o.volume_uah, 0)
  const selSellUSDT = selSell.reduce((s, o) => s + +o.volume_usdt, 0)
  const selAvgBuy = selBuyUSDT > 0 ? selBuyUAH / selBuyUSDT : 0
  const selAvgSell = selSellUSDT > 0 ? selSellUAH / selSellUSDT : 0
  const selSpread = selAvgBuy && selAvgSell ? (((selAvgSell - selAvgBuy) / selAvgBuy) * 100).toFixed(3) : null
  const selMinUSDT = Math.min(selBuyUSDT, selSellUSDT)
  const selProfit = selAvgBuy && selAvgSell && selMinUSDT > 0
    ? ((selAvgSell - selAvgBuy) * selMinUSDT).toFixed(2)
    : null

  const toggleOrder = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const selectAll = () => setSelectedIds(filtered.map(o => o.id))
  const clearAll = () => setSelectedIds([])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Spinner size={32} /></div>

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', letterSpacing: '1px' }}>📋 Мій звіт</h1>
        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
          {profile?.full_name || profile?.email} · всього ордерів: {orders.length}
        </div>
      </div>

      {/* TODAY ALL button */}
      <div style={{ marginBottom: '16px' }}>
        <button
          onClick={() => setShowTodayAll(!showTodayAll)}
          style={{
            ...S.btnSecondary,
            padding: '10px 20px',
            fontSize: '12px',
            color: showTodayAll ? 'var(--green)' : 'var(--text2)',
            borderColor: showTodayAll ? 'rgba(99,255,176,0.4)' : 'rgba(255,255,255,0.08)',
            background: showTodayAll ? 'rgba(99,255,176,0.08)' : 'transparent',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}
        >
          <span style={{
            width: '16px', height: '16px', borderRadius: '3px',
            border: `2px solid ${showTodayAll ? 'var(--green)' : 'var(--text3)'}`,
            background: showTodayAll ? 'var(--green)' : 'transparent',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', color: '#0a0e1a', fontWeight: '900', flexShrink: 0,
          }}>{showTodayAll ? '✓' : ''}</span>
          ✨ Аналітика: всі ордери за сьогодні
        </button>
      </div>

      {/* Today all analytics block */}
      {showTodayAll && (
        <div style={{ ...S.card, background: 'rgba(99,255,176,0.04)', border: '1px solid rgba(99,255,176,0.2)', marginBottom: '16px', animation: 'fadeIn 0.3s ease' }}>
          <div style={S.cardTitle}>✨ Зведення за сьогодні — {new Date().toLocaleDateString('uk-UA')}</div>
          {todayOrders.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: '12px' }}>Сьогодні ще немає ордерів</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                {[
                  { label: 'Ордерів', value: todayOrders.length, sub: `buy: ${todayBuy.length} · sell: ${todaySell.length}`, color: 'var(--text)' },
                  { label: 'Об\'єм UAH', value: `₴${fmt(todayBuyUAH + todaySellUAH, 0)}`, color: 'var(--yellow)' },
                  { label: 'Сер. курс BUY', value: todayAvgBuy ? fmt(todayAvgBuy, 2) : '—', color: '#22c55e' },
                  { label: 'Сер. курс SELL', value: todayAvgSell ? fmt(todayAvgSell, 2) : '—', color: 'var(--red)' },
                  { label: 'Спред %', value: todaySpread ? `${todaySpread}%` : '—', color: 'var(--green)' },
                  { label: 'Профіт UAH', value: todayProfit ? `₴${fmt(todayProfit)}` : '—', color: 'var(--green)' },
                ].map(c => (
                  <div key={c.label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', marginBottom: '4px' }}>{c.label}</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: c.color }}>{c.value}</div>
                    {c.sub && <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>{c.sub}</div>}
                  </div>
                ))}
              </div>

              {/* Today orders list */}
              <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', marginBottom: '8px' }}>ОРДЕРИ СЬОГОДНІ</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Час', 'Тип', 'Курс', 'UAH', 'USDT', 'Платформа'].map(h => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {todayOrders.map(o => (
                      <tr key={o.id}>
                        <td style={S.td}>{new Date(o.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={S.td}>
                          <span style={{
                            background: o.type === 'buy' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                            border: `1px solid ${o.type === 'buy' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                            color: o.type === 'buy' ? '#22c55e' : '#ef4444',
                            padding: '2px 8px', borderRadius: '4px', fontSize: '10px',
                          }}>{o.type === 'buy' ? 'BUY' : 'SELL'}</span>
                        </td>
                        <td style={{ ...S.td, color: 'var(--yellow)', fontWeight: '700' }}>{fmt(o.rate, 2)}</td>
                        <td style={S.td}>{fmt(o.volume_uah, 0)} ₴</td>
                        <td style={S.td}>{fmt(o.volume_usdt)} USDT</td>
                        <td style={{ ...S.td, color: 'var(--text3)' }}>{o.platform}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Period filters */}
      <div style={{ ...S.card, padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[['today', 'Сьогодні'], ['week', 'Тиждень'], ['month', 'Місяць'], ['custom', 'Свій період']].map(([val, label]) => (
              <button key={val} onClick={() => applyPeriod(val)} style={{
                ...S.btnSecondary, padding: '7px 12px', fontSize: '11px',
                color: period === val ? 'var(--green)' : 'var(--text3)',
                borderColor: period === val ? 'rgba(99,255,176,0.4)' : 'rgba(255,255,255,0.08)',
                background: period === val ? 'rgba(99,255,176,0.08)' : 'transparent',
              }}>{label}</button>
            ))}
          </div>
          {period === 'custom' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div>
                <label style={S.label}>Від</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  style={{ ...S.input, width: 'auto', colorScheme: 'dark' }} />
              </div>
              <div>
                <label style={S.label}>До</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  style={{ ...S.input, width: 'auto', colorScheme: 'dark' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Orders with checkboxes */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={S.cardTitle}>Мої ордери ({filtered.length})</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={selectAll} style={{ ...S.btnSecondary, padding: '6px 12px', fontSize: '11px' }}>Вибрати всі</button>
            {selectedIds.length > 0 && <button onClick={clearAll} style={{ ...S.btnSecondary, padding: '6px 12px', fontSize: '11px', color: 'var(--yellow)' }}>Скинути ({selectedIds.length})</button>}
          </div>
        </div>

        {filtered.length === 0
          ? <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text3)' }}>Немає ордерів за вибраний період</div>
          : filtered.map(o => {
            const selected = selectedIds.includes(o.id)
            return (
              <div key={o.id} onClick={() => toggleOrder(o.id)} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '6px',
                border: `1px solid ${selected ? 'rgba(99,255,176,0.3)' : 'rgba(255,255,255,0.06)'}`,
                background: selected ? 'rgba(99,255,176,0.06)' : 'rgba(255,255,255,0.02)',
                transition: 'all 0.15s',
              }}>
                {/* Checkbox */}
                <div style={{
                  width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                  border: `2px solid ${selected ? 'var(--green)' : 'var(--text3)'}`,
                  background: selected ? 'var(--green)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected && <span style={{ color: '#0a0e1a', fontSize: '11px', fontWeight: '900' }}>✓</span>}
                </div>

                {/* Type badge */}
                <span style={{
                  background: o.type === 'buy' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  border: `1px solid ${o.type === 'buy' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  color: o.type === 'buy' ? '#22c55e' : '#ef4444',
                  padding: '2px 8px', borderRadius: '4px', fontSize: '10px', flexShrink: 0,
                }}>{o.type === 'buy' ? 'BUY' : 'SELL'}</span>

                {/* Info */}
                <div style={{ flex: 1, fontSize: '12px' }}>
                  <span style={{ color: 'var(--yellow)', fontWeight: '700' }}>{fmt(o.rate, 2)} ₴</span>
                  <span style={{ color: 'var(--text3)', margin: '0 8px' }}>·</span>
                  <span style={{ color: 'var(--text2)' }}>₴{fmt(o.volume_uah, 0)}</span>
                  <span style={{ color: 'var(--text3)', margin: '0 8px' }}>·</span>
                  <span style={{ color: 'var(--text2)' }}>{fmt(o.volume_usdt)} USDT</span>
                  <span style={{ color: 'var(--text3)', margin: '0 8px' }}>·</span>
                  <span style={{ color: 'var(--text3)', fontSize: '11px' }}>{o.platform}</span>
                </div>

                {/* Date */}
                <div style={{ fontSize: '10px', color: 'var(--text3)', flexShrink: 0 }}>
                  {new Date(o.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })}
                  {' '}
                  {new Date(o.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )
          })
        }
      </div>

      {/* Selected orders result */}
      {selectedIds.length > 0 && (
        <div style={{ ...S.card, background: 'rgba(99,255,176,0.04)', border: '1px solid rgba(99,255,176,0.25)', animation: 'fadeIn 0.3s ease' }}>
          <div style={S.cardTitle}>📊 Розрахунок по вибраних ({selectedIds.length} ордерів)</div>

          {selBuy.length === 0 || selSell.length === 0 ? (
            <div style={{ color: 'var(--yellow)', fontSize: '12px' }}>
              ⚠ Для розрахунку профіту потрібно вибрати мінімум 1 ордер BUY і 1 ордер SELL
              <div style={{ marginTop: '6px', color: 'var(--text3)' }}>
                Вибрано: buy — {selBuy.length}, sell — {selSell.length}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              {[
                { label: 'Об\'єм BUY', value: `₴${fmt(selBuyUAH, 0)}`, sub: `${fmt(selBuyUSDT)} USDT`, color: '#22c55e' },
                { label: 'Об\'єм SELL', value: `₴${fmt(selSellUAH, 0)}`, sub: `${fmt(selSellUSDT)} USDT`, color: 'var(--red)' },
                { label: 'Сер. курс BUY', value: fmt(selAvgBuy, 2), color: '#22c55e' },
                { label: 'Сер. курс SELL', value: fmt(selAvgSell, 2), color: 'var(--red)' },
                { label: 'Спред %', value: selSpread ? `${selSpread}%` : '—', color: 'var(--green)' },
                { label: '💰 Профіт UAH', value: selProfit ? `₴${fmt(selProfit)}` : '—', color: 'var(--green)' },
              ].map(c => (
                <div key={c.label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', marginBottom: '4px' }}>{c.label}</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: c.color }}>{c.value}</div>
                  {c.sub && <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>{c.sub}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
