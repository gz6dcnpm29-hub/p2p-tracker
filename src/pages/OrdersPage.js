import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { S, fmt, fmtDate, BuyBadge, SellBadge, Spinner } from '../components/ui'

export default function OrdersPage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [filterWorker, setFilterWorker] = useState('all')
  const [search, setSearch] = useState('')

  const load = async () => {
    const query = supabase.from('orders').select('*').order('created_at', { ascending: false })
    const { data } = profile?.role === 'admin' ? await query : await query.eq('worker_id', profile?.id)
    setOrders(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (profile) load()
    const channel = supabase.channel('orders-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile])

  const deleteOrder = async (id) => {
    if (!window.confirm('Видалити ордер?')) return
    await supabase.from('orders').delete().eq('id', id)
    setOrders(prev => prev.filter(o => o.id !== id))
  }

  const workers = [...new Set(orders.map(o => o.worker_name))]

  const filtered = orders.filter(o =>
    (filterType === 'all' || o.type === filterType) &&
    (filterWorker === 'all' || o.worker_name === filterWorker) &&
    (search === '' || o.worker_name.toLowerCase().includes(search.toLowerCase()) || String(o.rate).includes(search))
  )

  const totalUAH = filtered.reduce((s, o) => s + +o.volume_uah, 0)
  const totalUSDT = filtered.reduce((s, o) => s + +o.volume_usdt, 0)

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Spinner size={32} /></div>

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', letterSpacing: '1px' }}>Ордери</h1>
        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
          Показано: {filtered.length} · UAH: ₴{fmt(totalUAH, 0)} · USDT: {fmt(totalUSDT)}
        </div>
      </div>

      {/* Filters */}
      <div style={{ ...S.card, display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} style={{ ...S.input, width: '200px' }} placeholder="🔍 Пошук..." />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...S.select, width: 'auto' }}>
          <option value="all">Всі типи</option>
          <option value="buy">Купівля</option>
          <option value="sell">Продаж</option>
        </select>
        {profile?.role === 'admin' && (
          <select value={filterWorker} onChange={e => setFilterWorker(e.target.value)} style={{ ...S.select, width: 'auto' }}>
            <option value="all">Всі працівники</option>
            {workers.map(w => <option key={w}>{w}</option>)}
          </select>
        )}
      </div>

      <div style={S.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  'Дата/Час', 
                  ...(profile?.role === 'admin' ? ['Працівник'] : []),
                  'Тип', 'Курс', 'UAH', 'USDT', 'Платформа', 'Примітка', ''
                ].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id}>
                  <td style={S.td}>{fmtDate(o.created_at)}</td>
                  {profile?.role === 'admin' && <td style={{ ...S.td, fontWeight: '600', color: 'var(--text)' }}>{o.worker_name}</td>}
                  <td style={S.td}>{o.type === 'buy' ? <BuyBadge /> : <SellBadge />}</td>
                  <td style={{ ...S.td, color: 'var(--yellow)', fontWeight: '700' }}>{fmt(o.rate, 2)}</td>
                  <td style={S.td}>{fmt(o.volume_uah, 0)} ₴</td>
                  <td style={S.td}>{fmt(o.volume_usdt)} USDT</td>
                  <td style={{ ...S.td, color: 'var(--text3)' }}>{o.platform}</td>
                  <td style={{ ...S.td, color: 'var(--text3)', fontSize: '11px' }}>{o.note || '—'}</td>
                  <td style={S.td}>
                    {profile?.role === 'admin' && (
                      <button style={S.btnDanger} onClick={() => deleteOrder(o.id)}>✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>Немає ордерів</div>}
        </div>
      </div>
    </div>
  )
}
