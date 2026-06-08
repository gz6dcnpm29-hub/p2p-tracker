import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { S, fmt, fmtDate, Spinner } from '../components/ui'

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function PairsPage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState([])
  const [pairs, setPairs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBuyIds, setSelectedBuyIds] = useState([])
  const [selectedSellIds, setSelectedSellIds] = useState([])
  const [saving, setSaving] = useState(false)
  const [filterDate, setFilterDate] = useState(todayStr())
  const [useDateFilter, setUseDateFilter] = useState(false)
  const [filterWorker, setFilterWorker] = useState('all')

  const load = async () => {
    const { data: o } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    const { data: p } = await supabase.from('pairs').select('*').order('created_at', { ascending: false })
    setOrders(o || [])
    setPairs(p || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase.channel('pairs-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pairs' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const workers = [...new Set(orders.map(o => o.worker_name))]
  const buyOrders = orders.filter(o => o.type === 'buy')
  const sellOrders = orders.filter(o => o.type === 'sell')

  // Filter by date + worker
  const filteredBuyOrders = buyOrders
    .filter(o => !useDateFilter || o.created_at.slice(0, 10) === filterDate)
    .filter(o => filterWorker === 'all' || o.worker_name === filterWorker)

  const filteredSellOrders = sellOrders
    .filter(o => !useDateFilter || o.created_at.slice(0, 10) === filterDate)
    .filter(o => filterWorker === 'all' || o.worker_name === filterWorker)

  const toggleId = (id, list, setList) => {
    setList(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const selectAllBuy = () => setSelectedBuyIds(filteredBuyOrders.map(o => o.id))
  const selectAllSell = () => setSelectedSellIds(filteredSellOrders.map(o => o.id))
  const clearBuy = () => setSelectedBuyIds([])
  const clearSell = () => setSelectedSellIds([])

  const selectedBuyOrders = buyOrders.filter(o => selectedBuyIds.includes(o.id))
  const selectedSellOrders = sellOrders.filter(o => selectedSellIds.includes(o.id))

  const totalBuyUAH = selectedBuyOrders.reduce((s, o) => s + +o.volume_uah, 0)
  const totalSellUAH = selectedSellOrders.reduce((s, o) => s + +o.volume_uah, 0)
  const totalBuyUSDT = selectedBuyOrders.reduce((s, o) => s + +o.volume_usdt, 0)
  const totalSellUSDT = selectedSellOrders.reduce((s, o) => s + +o.volume_usdt, 0)
  const avgBuyRate = totalBuyUSDT > 0 ? totalBuyUAH / totalBuyUSDT : 0
  const avgSellRate = totalSellUSDT > 0 ? totalSellUAH / totalSellUSDT : 0
  const spread = avgBuyRate && avgSellRate ? (((avgSellRate - avgBuyRate) / avgBuyRate) * 100).toFixed(3) : null
  const minUSDT = Math.min(totalBuyUSDT, totalSellUSDT)
  const profit = avgBuyRate && avgSellRate && minUSDT > 0 ? ((avgSellRate - avgBuyRate) * minUSDT).toFixed(2) : null

  // Avg buy rate today for USD equivalent
  const todayBuyOrders = buyOrders.filter(o => o.created_at.slice(0, 10) === todayStr())
  const todayBuyUAH = todayBuyOrders.reduce((s, o) => s + +o.volume_uah, 0)
  const todayBuyUSDT2 = todayBuyOrders.reduce((s, o) => s + +o.volume_usdt, 0)
  const avgRateToday = todayBuyUSDT2 > 0 ? todayBuyUAH / todayBuyUSDT2 : avgBuyRate
  const profitUSD = profit && avgRateToday > 0 ? (parseFloat(profit) / avgRateToday).toFixed(2) : null

  // For saved pairs table
  const getProfitUSD = (profitUah, date) => {
    const dayBuy = buyOrders.filter(o => o.created_at.slice(0, 10) === date?.slice(0, 10))
    const dUAH = dayBuy.reduce((s, o) => s + +o.volume_uah, 0)
    const dUSDT = dayBuy.reduce((s, o) => s + +o.volume_usdt, 0)
    const rate = dUSDT > 0 ? dUAH / dUSDT : avgRateToday
    return rate > 0 ? (profitUah / rate).toFixed(2) : null
  }

  const hasPreview = selectedBuyIds.length > 0 && selectedSellIds.length > 0

  const savePair = async () => {
    if (!hasPreview) return alert('Оберіть хоча б по одному ордеру з кожної сторони')
    setSaving(true)
    const workers2 = [...new Set([
      ...selectedBuyOrders.map(o => o.worker_name),
      ...selectedSellOrders.map(o => o.worker_name)
    ])].join(', ')
    const { error } = await supabase.from('pairs').insert({
      buy_order_id: selectedBuyIds[0],
      sell_order_id: selectedSellIds[0],
      buy_rate: +avgBuyRate.toFixed(4),
      sell_rate: +avgSellRate.toFixed(4),
      spread_pct: parseFloat(spread),
      profit_uah: parseFloat(profit),
      volume_usdt: +totalBuyUSDT.toFixed(4),
      workers: workers2,
      created_by: profile?.id,
    })
    setSaving(false)
    if (error) return alert(error.message)
    setSelectedBuyIds([])
    setSelectedSellIds([])
    load()
  }

  const deletePair = async (id) => {
    if (!window.confirm('Видалити пару?')) return
    await supabase.from('pairs').delete().eq('id', id)
    setPairs(prev => prev.filter(p => p.id !== id))
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Spinner size={32} /></div>

  const OrderCheckbox = ({ order, selected, onToggle }) => (
    <div onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
      border: `1px solid ${selected ? 'rgba(99,255,176,0.4)' : 'rgba(255,255,255,0.07)'}`,
      background: selected ? 'rgba(99,255,176,0.07)' : 'rgba(255,255,255,0.02)',
      marginBottom: '6px', transition: 'all 0.15s',
    }}>
      <div style={{
        width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
        border: `2px solid ${selected ? 'var(--green)' : 'var(--text3)'}`,
        background: selected ? 'var(--green)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {selected && <span style={{ color: '#0a0e1a', fontSize: '10px', fontWeight: '900' }}>✓</span>}
      </div>
      <div style={{ flex: 1, fontSize: '12px' }}>
        <span style={{ color: 'var(--text)', fontWeight: '600' }}>{order.worker_name}</span>
        <span style={{ color: 'var(--text3)', margin: '0 6px' }}>·</span>
        <span style={{ color: 'var(--yellow)', fontWeight: '700' }}>{fmt(order.rate, 2)}₴</span>
        <span style={{ color: 'var(--text3)', margin: '0 6px' }}>·</span>
        <span style={{ color: 'var(--text2)' }}>₴{fmt(order.volume_uah, 0)}</span>
        <span style={{ color: 'var(--text3)', margin: '0 6px' }}>·</span>
        <span style={{ color: 'var(--text3)', fontSize: '11px' }}>
          {new Date(order.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })}
          {' '}
          {new Date(order.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', letterSpacing: '1px' }}>🔗 Пари / Спред</h1>
        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>Оберіть ордери buy і sell — система порахує середній курс і загальний профіт</div>
      </div>

      {profile?.role === 'admin' && (
        <div style={S.card}>

          {/* ── Filters row ── */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>

            {/* Worker filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '1px' }}>ВОРКЕР:</span>
              <select
                value={filterWorker}
                onChange={e => { setFilterWorker(e.target.value); setSelectedBuyIds([]); setSelectedSellIds([]) }}
                style={{ ...S.select, width: 'auto', padding: '6px 12px', fontSize: '12px' }}
              >
                <option value="all">Всі</option>
                {workers.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>

            {/* Divider */}
            <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />

            {/* Date filter toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                onClick={() => setUseDateFilter(!useDateFilter)}
                style={{
                  width: '18px', height: '18px', borderRadius: '4px', cursor: 'pointer',
                  border: `2px solid ${useDateFilter ? 'var(--green)' : 'var(--text3)'}`,
                  background: useDateFilter ? 'var(--green)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                {useDateFilter && <span style={{ color: '#0a0e1a', fontSize: '11px', fontWeight: '900' }}>✓</span>}
              </div>
              <span
                style={{ fontSize: '11px', color: useDateFilter ? 'var(--green)' : 'var(--text3)', cursor: 'pointer', letterSpacing: '1px' }}
                onClick={() => setUseDateFilter(!useDateFilter)}
              >ФІЛЬТР ДАТИ</span>
            </div>

            {useDateFilter && (
              <>
                <input
                  type="date"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  style={{ ...S.input, width: 'auto', colorScheme: 'dark' }}
                />
                <button onClick={() => setFilterDate(todayStr())} style={{ ...S.btnSecondary, padding: '7px 12px', fontSize: '11px' }}>
                  Сьогодні
                </button>
              </>
            )}

            {/* Stats */}
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: 'auto' }}>
              BUY: <span style={{ color: '#22c55e' }}>{filteredBuyOrders.length}</span>
              {' · '}
              SELL: <span style={{ color: 'var(--red)' }}>{filteredSellOrders.length}</span>
            </div>
          </div>

          {/* ── Order columns ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
            {/* BUY */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', color: '#22c55e', letterSpacing: '1px', fontWeight: '700' }}>
                  BUY ({selectedBuyIds.length} · ₴{fmt(totalBuyUAH, 0)})
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={selectAllBuy} style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', padding: '4px 10px', color: '#22c55e', fontSize: '10px', cursor: 'pointer' }}>✓ Всі</button>
                  {selectedBuyIds.length > 0 && <button onClick={clearBuy} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 10px', color: 'var(--text3)', fontSize: '10px', cursor: 'pointer' }}>✕</button>}
                </div>
              </div>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {filteredBuyOrders.length === 0
                  ? <div style={{ color: 'var(--text3)', fontSize: '12px', padding: '10px' }}>Немає ордерів</div>
                  : filteredBuyOrders.map(o => (
                    <OrderCheckbox key={o.id} order={o}
                      selected={selectedBuyIds.includes(o.id)}
                      onToggle={() => toggleId(o.id, selectedBuyIds, setSelectedBuyIds)}
                    />
                  ))
                }
              </div>
            </div>

            {/* SELL */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', color: 'var(--red)', letterSpacing: '1px', fontWeight: '700' }}>
                  SELL ({selectedSellIds.length} · ₴{fmt(totalSellUAH, 0)})
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={selectAllSell} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '4px 10px', color: '#ef4444', fontSize: '10px', cursor: 'pointer' }}>✓ Всі</button>
                  {selectedSellIds.length > 0 && <button onClick={clearSell} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 10px', color: 'var(--text3)', fontSize: '10px', cursor: 'pointer' }}>✕</button>}
                </div>
              </div>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {filteredSellOrders.length === 0
                  ? <div style={{ color: 'var(--text3)', fontSize: '12px', padding: '10px' }}>Немає ордерів</div>
                  : filteredSellOrders.map(o => (
                    <OrderCheckbox key={o.id} order={o}
                      selected={selectedSellIds.includes(o.id)}
                      onToggle={() => toggleId(o.id, selectedSellIds, setSelectedSellIds)}
                    />
                  ))
                }
              </div>
            </div>
          </div>

          {/* Preview */}
          {hasPreview && (
            <div style={{ padding: '16px', background: 'rgba(99,255,176,0.05)', border: '1px solid rgba(99,255,176,0.2)', borderRadius: '10px', marginBottom: '16px' }}>
              {/* Volumes row */}
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px', padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
                  Загальний об'єм:
                  <span style={{ color: 'var(--yellow)', fontWeight: '700', marginLeft: '6px' }}>₴{fmt(totalBuyUAH + totalSellUAH, 0)}</span>
                  <span style={{ color: 'var(--text3)', margin: '0 6px' }}>·</span>
                  <span style={{ color: 'var(--blue)', fontWeight: '700' }}>{fmt(totalBuyUSDT + totalSellUSDT)} USDT</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
                  BUY: <span style={{ color: '#22c55e', fontWeight: '600' }}>₴{fmt(totalBuyUAH, 0)}</span> · <span style={{ color: '#22c55e' }}>{fmt(totalBuyUSDT)} USDT</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
                  SELL: <span style={{ color: 'var(--red)', fontWeight: '600' }}>₴{fmt(totalSellUAH, 0)}</span> · <span style={{ color: 'var(--red)' }}>{fmt(totalSellUSDT)} USDT</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <div><div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', marginBottom: '4px' }}>СЕР. КУРС BUY</div><div style={{ fontSize: '22px', fontWeight: '800', color: '#22c55e' }}>{fmt(avgBuyRate, 2)}₴</div></div>
                <div><div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', marginBottom: '4px' }}>СЕР. КУРС SELL</div><div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--red)' }}>{fmt(avgSellRate, 2)}₴</div></div>
                <div><div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', marginBottom: '4px' }}>СПРЕД %</div><div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--green)' }}>{spread}%</div></div>
                <div><div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', marginBottom: '4px' }}>РІЗНИЦЯ</div><div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--yellow)' }}>₴{fmt(avgSellRate - avgBuyRate, 4)}</div></div>
                <div><div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', marginBottom: '4px' }}>ПРОФІТ UAH</div><div style={{ fontSize: '22px', fontWeight: '800', color: '#22c55e' }}>₴{fmt(profit)}</div></div>
                <div><div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', marginBottom: '4px' }}>ПРОФІТ USD</div><div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--blue)' }}>{profitUSD ? `$${fmt(profitUSD)}` : '—'}</div><div style={{ fontSize: '9px', color: 'var(--text3)', marginTop: '2px' }}>курс {fmt(avgRateToday, 2)}₴</div></div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={S.btnPrimary} onClick={savePair} disabled={saving || !hasPreview}>
              {saving ? 'ЗБЕРЕЖЕННЯ...' : '✓ ЗБЕРЕГТИ ПАРУ'}
            </button>
            {(selectedBuyIds.length > 0 || selectedSellIds.length > 0) && (
              <button style={S.btnSecondary} onClick={() => { setSelectedBuyIds([]); setSelectedSellIds([]) }}>
                Скинути вибір
              </button>
            )}
          </div>
        </div>
      )}

      {/* Saved pairs */}
      <div style={S.card}>
        <div style={S.cardTitle}>Збережені пари ({pairs.length})</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Дата', 'Працівники', 'Об\'єм USDT', 'Курс BUY', 'Курс SELL', 'Спред %', 'Профіт UAH', 'Профіт USD', ''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pairs.map(p => (
                <tr key={p.id}>
                  <td style={S.td}>{fmtDate(p.created_at)}</td>
                  <td style={S.td}>{p.workers}</td>
                  <td style={{ ...S.td, color: 'var(--blue)', fontWeight: '700' }}>{p.volume_usdt ? `${fmt(p.volume_usdt)} USDT` : '—'}</td>
                  <td style={{ ...S.td, color: '#22c55e', fontWeight: '700' }}>{fmt(p.buy_rate, 2)}</td>
                  <td style={{ ...S.td, color: 'var(--red)', fontWeight: '700' }}>{fmt(p.sell_rate, 2)}</td>
                  <td style={{ ...S.td, color: 'var(--green)', fontWeight: '800', fontSize: '14px' }}>{p.spread_pct}%</td>
                  <td style={{ ...S.td, color: 'var(--yellow)', fontWeight: '700' }}>₴{fmt(p.profit_uah)}</td>
                  <td style={{ ...S.td, color: 'var(--blue)', fontWeight: '700' }}>{(() => { const u = getProfitUSD(+p.profit_uah, p.created_at); return u ? `$${fmt(u)}` : '—' })()}</td>
                  <td style={S.td}>
                    {profile?.role === 'admin' && (
                      <button style={S.btnDanger} onClick={() => deletePair(p.id)}>✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pairs.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>Пар ще немає</div>}
        </div>
      </div>
    </div>
  )
}
