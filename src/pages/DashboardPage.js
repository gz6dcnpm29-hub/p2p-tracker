import { useState, useEffect } from 'react'
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

export default function DashboardPage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState([])
  const [pairs, setPairs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const query = supabase.from('orders').select('*').order('created_at', { ascending: false })
      const { data: o } = profile?.role === 'admin' ? await query : await query.eq('worker_id', profile?.id)
      const { data: p } = await supabase.from('pairs').select('*').order('created_at', { ascending: false }).limit(20)
      setOrders(o || [])
      setPairs(p || [])
      setLoading(false)
    }
    if (profile) load()

    // Realtime subscription
    const channel = supabase.channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pairs' }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Spinner size={32} /></div>

  const buy = orders.filter(o => o.type === 'buy')
  const sell = orders.filter(o => o.type === 'sell')
  const avgBuy = buy.length ? buy.reduce((s, o) => s + +o.rate, 0) / buy.length : 0
  const avgSell = sell.length ? sell.reduce((s, o) => s + +o.rate, 0) / sell.length : 0
  const totalUAH = orders.reduce((s, o) => s + +o.volume_uah, 0)
  const totalUSDT = orders.reduce((s, o) => s + +o.volume_usdt, 0)
  const totalProfit = pairs.reduce((s, p) => s + +(p.profit_uah || 0), 0)

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', letterSpacing: '1px' }}>Дашборд</h1>
        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
          {profile?.role === 'admin' ? `Всі дані · ${orders.length} ордерів` : `Ваші ордери · ${orders.length} шт`}
          <span style={{ marginLeft: '12px', color: 'var(--green)', animation: 'pulse 2s infinite' }}>● LIVE</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '4px' }}>
        <StatCard label="Всього ордерів" value={orders.length} sub={`buy: ${buy.length} · sell: ${sell.length}`} />
        <StatCard label="Об'єм UAH" value={`₴${fmt(totalUAH, 0)}`} color="var(--yellow)" />
        <StatCard label="Об'єм USDT" value={fmt(totalUSDT)} sub="USDT" color="var(--blue)" />
        <StatCard label="Сер. курс BUY" value={avgBuy ? fmt(avgBuy, 2) : '—'} sub="UAH/USDT" color="var(--success)" />
        <StatCard label="Сер. курс SELL" value={avgSell ? fmt(avgSell, 2) : '—'} sub="UAH/USDT" color="var(--red)" />
        {profile?.role === 'admin' && <StatCard label="Загальний профіт" value={`₴${fmt(totalProfit)}`} sub="по парам" color="var(--green)" />}
      </div>

      {avgBuy > 0 && avgSell > 0 && profile?.role === 'admin' && (
        <div style={{ ...S.card, background: 'rgba(99,255,176,0.04)', border: '1px solid rgba(99,255,176,0.2)', marginTop: '14px' }}>
          <div style={S.cardTitle}>Середній спред</div>
          <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ ...S.label }}>Спред %</div>
              <div style={{ fontSize: '36px', fontWeight: '800', color: 'var(--green)' }}>{calcSpread(avgBuy, avgSell)}%</div>
            </div>
            <div>
              <div style={S.label}>Різниця курсів</div>
              <div style={{ fontSize: '36px', fontWeight: '800', color: 'var(--yellow)' }}>{fmt(avgSell - avgBuy, 3)} ₴</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent orders */}
      <div style={{ ...S.card, marginTop: '14px' }}>
        <div style={S.cardTitle}>Останні ордери</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {(profile?.role === 'admin' ? ['Час', 'Працівник', 'Тип', 'Курс', 'UAH', 'USDT', 'Платформа'] : ['Час', 'Тип', 'Курс', 'UAH', 'USDT', 'Платформа']).map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 12).map(o => (
                <tr key={o.id} style={{ transition: 'background 0.15s' }}>
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
          {orders.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>Ордерів ще немає</div>}
        </div>
      </div>
    </div>
  )
}
