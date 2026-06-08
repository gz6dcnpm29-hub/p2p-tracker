import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { S, fmt, fmtDate, calcSpread, BuyBadge, SellBadge, Spinner } from '../components/ui'

const StatCard = ({ label, value, sub, color = 'var(--text)' }) => (
  <div style={S.card}>
    <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>{label}</div>
    <div style={{ fontSize: '26px', fontWeight: '800', color }}>{value}</div>
    {sub && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>{sub}</div>}
  </div>
)

const today = () => new Date().toISOString().slice(0, 10)
const monthAgo = () => {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState([])
  const [pairs, setPairs] = useState([])
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterWorker, setFilterWorker] = useState('all')
  const [dateFrom, setDateFrom] = useState(monthAgo())
  const [dateTo, setDateTo] = useState(today())

  const load = useCallback(async () => {
    const query = supabase.from('orders').select('*').order('created_at', { ascending: false })
    const { data: o } = profile?.role === 'admin' ? await query : await query.eq('worker_id', profile?.id)
    const { data: p } = await supabase.from('pairs').select('*').order('created_at', { ascending: false })
    const allOrders = o || []
    setOrders(allOrders)
    setPairs(p || [])
    setWorkers([...new Set(allOrders.map(x => x.worker_name))])
    setLoading(false)
  }, [profile])

  useEffect(() => {
    if (profile) load()
    const channel = supabase.channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pairs' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile, load])

  const resetFilters = () => {
    setFilterWorker('all')
    setDateFrom(monthAgo())
    setDateTo(today())
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Spinner size={32} /></div>

  // Apply filters
  const filtered = orders.filter(o => {
    const d = o.created_at.slice(0, 10)
    const workerOk = filterWorker === 'all' || o.worker_name === filterWorker
    const fromOk = !dateFrom || d >= dateFrom
    const toOk = !dateTo || d <= dateTo
    return workerOk && fromOk && toOk
  })

  const filteredPairs = pairs.filter(p => {
    const d = p.created_at.slice(0, 10)
    const fromOk = !dateFrom || d >= dateFrom
    const toOk = !dateTo || d <= dateTo
    return fromOk && toOk
  })

  const buy = filtered.filter(o => o.type === 'buy')
  const sell = filtered.filter(o => o.type === 'sell')

  // Взвешенный средний курс = сумма UAH / сумма USDT
  // Правильно учитывает разные объёмы
  const buyTotalUAH = buy.reduce((s, o) => s + +o.volume_uah, 0)
  const buyTotalUSDT = buy.reduce((s, o) => s + +o.volume_usdt, 0)
  const sellTotalUAH = sell.reduce((s, o) => s + +o.volume_uah, 0)
  const sellTotalUSDT = sell.reduce((s, o) => s + +o.volume_usdt, 0)
  const avgBuy = buyTotalUSDT > 0 ? buyTotalUAH / buyTotalUSDT : 0
  const avgSell = sellTotalUSDT > 0 ? sellTotalUAH / sellTotalUSDT : 0

  const totalUAH = filtered.reduce((s, o) => s + +o.volume_uah, 0)
  const totalUSDT = filtered.reduce((s, o) => s + +o.volume_usdt, 0)
  const totalProfit = filteredPairs.reduce((s, p) => s + +(p.profit_uah || 0), 0)

  // Профит в USD — делим на средний курс покупки за период
  const totalProfitUSD = avgBuy > 0 ? totalProfit / avgBuy : null

  const isFiltered = filterWorker !== 'all' || dateFrom !== monthAgo() || dateTo !== today()

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', letterSpacing: '1px' }}>Дашборд</h1>
          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
            {filtered.length} ордерів
            {isFiltered && <span style={{ color: 'var(--yellow)', marginLeft: '8px' }}>· фільтр активний</span>}
            <span style={{ marginLeft: '12px', color: 'var(--green)', animation: 'pulse 2s infinite' }}>● LIVE</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ ...S.card, padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {profile?.role === 'admin' && (
            <div>
              <label style={S.label}>Співробітник</label>
              <select value={filterWorker} onChange={e => setFilterWorker(e.target.value)} style={{ ...S.select, width: 'auto', minWidth: '160px' }}>
                <option value="all">Всі співробітники</option>
                {workers.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={S.label}>Дата від</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{ ...S.input, width: 'auto', colorScheme: 'dark' }}
            />
          </div>
          <div>
            <label style={S.label}>Дата до</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{ ...S.input, width: 'auto', colorScheme: 'dark' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['Сьогодні', 'Тиждень', 'Місяць', 'Все'].map(label => {
              const getRange = () => {
                const t = today()
                if (label === 'Сьогодні') return [t, t]
                if (label === 'Тиждень') { const d = new Date(); d.setDate(d.getDate() - 7); return [d.toISOString().slice(0,10), t] }
                if (label === 'Місяць') return [monthAgo(), t]
                return ['2020-01-01', t]
              }
              return (
                <button key={label} onClick={() => { const [f, to] = getRange(); setDateFrom(f); setDateTo(to) }}
                  style={{ ...S.btnSecondary, padding: '8px 12px', fontSize: '11px' }}>
                  {label}
                </button>
              )
            })}
            {isFiltered && (
              <button onClick={resetFilters} style={{ ...S.btnSecondary, padding: '8px 12px', fontSize: '11px', color: 'var(--yellow)', borderColor: 'rgba(251,191,36,0.3)' }}>
                ✕ Скинути
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginBottom: '4px' }}>
        <StatCard label="Всього ордерів" value={filtered.length} sub={`buy: ${buy.length} · sell: ${sell.length}`} />
        <StatCard label="Куплено USDT" value={fmt(buyTotalUSDT)} sub={`₴${fmt(buyTotalUAH, 0)}`} color="#22c55e" />
        <StatCard label="Продано USDT" value={fmt(sellTotalUSDT)} sub={`₴${fmt(sellTotalUAH, 0)}`} color="var(--red)" />
        <StatCard label="Сер. курс BUY" value={avgBuy ? fmt(avgBuy, 2) : '—'} sub="UAH/USDT" color="#22c55e" />
        <StatCard label="Сер. курс SELL" value={avgSell ? fmt(avgSell, 2) : '—'} sub="UAH/USDT" color="var(--red)" />
        {profile?.role === 'admin' && <StatCard label="Профіт за період" value={`₴${fmt(totalProfit)}`} sub="по парам" color="var(--green)" />}
        {profile?.role === 'admin' && totalProfitUSD !== null && <StatCard label="Профіт USD" value={`$${fmt(totalProfitUSD)}`} sub={`курс ${fmt(avgBuy, 2)}₴`} color="var(--blue)" />}
      </div>

      {avgBuy > 0 && avgSell > 0 && profile?.role === 'admin' && (
        <div style={{ ...S.card, background: 'rgba(99,255,176,0.04)', border: '1px solid rgba(99,255,176,0.2)', marginTop: '14px' }}>
          <div style={S.cardTitle}>Середній спред за період</div>
          <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
            <div>
              <div style={S.label}>Спред %</div>
              <div style={{ fontSize: '36px', fontWeight: '800', color: 'var(--green)' }}>{calcSpread(avgBuy, avgSell)}%</div>
            </div>
            <div>
              <div style={S.label}>Різниця курсів</div>
              <div style={{ fontSize: '36px', fontWeight: '800', color: 'var(--yellow)' }}>{fmt(avgSell - avgBuy, 3)} ₴</div>
            </div>
          </div>
        </div>
      )}

      {/* Orders table */}
      <div style={{ ...S.card, marginTop: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={S.cardTitle}>Ордери за період</div>
          <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{filtered.length} шт</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {(profile?.role === 'admin'
                  ? ['Час', 'Працівник', 'Тип', 'Курс', 'UAH', 'USDT', 'Платформа']
                  : ['Час', 'Тип', 'Курс', 'UAH', 'USDT', 'Платформа']
                ).map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map(o => (
                <tr key={o.id}>
                  <td style={S.td}>{fmtDate(o.created_at)}</td>
                  {profile?.role === 'admin' && <td style={{ ...S.td, fontWeight: '600', color: 'var(--text)' }}>{o.worker_name}</td>}
                  <td style={S.td}>{o.type === 'buy' ? <BuyBadge /> : <SellBadge />}</td>
                  <td style={{ ...S.td, color: 'var(--yellow)', fontWeight: '700' }}>{fmt(o.rate, 2)}</td>
                  <td style={S.td}>{fmt(o.volume_uah, 0)} ₴</td>
                  <td style={S.td}>{fmt(o.volume_usdt)} USDT</td>
                  <td style={{ ...S.td, color: 'var(--text3)' }}>{o.platform}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>Немає ордерів за вибраний період</div>}
        </div>
      </div>
    </div>
  )
}
