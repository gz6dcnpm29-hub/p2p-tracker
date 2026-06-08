import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { S, fmt, fmtDate, calcSpread, calcProfit, Spinner } from '../components/ui'

export default function PairsPage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState([])
  const [pairs, setPairs] = useState([])
  const [loading, setLoading] = useState(true)
  const [buyId, setBuyId] = useState('')
  const [sellId, setSellId] = useState('')
  const [saving, setSaving] = useState(false)

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

  const buyOrders = orders.filter(o => o.type === 'buy')
  const sellOrders = orders.filter(o => o.type === 'sell')
  const selectedBuy = orders.find(o => o.id === buyId)
  const selectedSell = orders.find(o => o.id === sellId)

  const preview = selectedBuy && selectedSell ? {
    spread: calcSpread(+selectedBuy.rate, +selectedSell.rate),
    profit: calcProfit(+selectedBuy.rate, +selectedSell.rate, Math.min(+selectedBuy.volume_uah, +selectedSell.volume_uah)),
    diff: (+selectedSell.rate - +selectedBuy.rate).toFixed(4),
  } : null

  const savePair = async () => {
    if (!selectedBuy || !selectedSell) return alert('Оберіть обидва ордери')
    setSaving(true)
    const { error } = await supabase.from('pairs').insert({
      buy_order_id: selectedBuy.id,
      sell_order_id: selectedSell.id,
      buy_rate: +selectedBuy.rate,
      sell_rate: +selectedSell.rate,
      spread_pct: parseFloat(calcSpread(+selectedBuy.rate, +selectedSell.rate)),
      profit_uah: parseFloat(calcProfit(+selectedBuy.rate, +selectedSell.rate, Math.min(+selectedBuy.volume_uah, +selectedSell.volume_uah))),
      workers: `${selectedBuy.worker_name} / ${selectedSell.worker_name}`,
      created_by: profile?.id,
    })
    setSaving(false)
    if (error) return alert(error.message)
    setBuyId(''); setSellId('')
    load()
  }

  const deletePair = async (id) => {
    if (!window.confirm('Видалити пару?')) return
    await supabase.from('pairs').delete().eq('id', id)
    setPairs(prev => prev.filter(p => p.id !== id))
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Spinner size={32} /></div>

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', letterSpacing: '1px' }}>Пари / Спред</h1>
        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>Зв'яжіть ордери buy+sell для підрахунку профіту</div>
      </div>

      {profile?.role === 'admin' && (
        <div style={S.card}>
          <div style={S.cardTitle}>Створити пару</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={S.label}>Ордер BUY</label>
              <select value={buyId} onChange={e => setBuyId(e.target.value)} style={S.select}>
                <option value="">— оберіть —</option>
                {buyOrders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.worker_name} · {fmt(o.rate, 2)}₴ · ₴{fmt(o.volume_uah, 0)} · {new Date(o.created_at).toLocaleDateString('uk-UA')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={S.label}>Ордер SELL</label>
              <select value={sellId} onChange={e => setSellId(e.target.value)} style={S.select}>
                <option value="">— оберіть —</option>
                {sellOrders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.worker_name} · {fmt(o.rate, 2)}₴ · ₴{fmt(o.volume_uah, 0)} · {new Date(o.created_at).toLocaleDateString('uk-UA')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {preview && (
            <div style={{ padding: '16px', background: 'rgba(99,255,176,0.05)', border: '1px solid rgba(99,255,176,0.2)', borderRadius: '10px', marginBottom: '14px', display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', marginBottom: '4px' }}>СПРЕД %</div>
                <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--green)' }}>{preview.spread}%</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', marginBottom: '4px' }}>РІЗНИЦЯ КУРСІВ</div>
                <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--yellow)' }}>₴{preview.diff}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', marginBottom: '4px' }}>ПРОФІТ UAH</div>
                <div style={{ fontSize: '32px', fontWeight: '800', color: '#22c55e' }}>₴{preview.profit}</div>
              </div>
            </div>
          )}

          <button style={S.btnPrimary} onClick={savePair} disabled={saving || !buyId || !sellId}>
            {saving ? 'ЗБЕРЕЖЕННЯ...' : '✓ ЗБЕРЕГТИ ПАРУ'}
          </button>
        </div>
      )}

      <div style={S.card}>
        <div style={S.cardTitle}>Збережені пари ({pairs.length})</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Дата', 'Працівники', 'Курс BUY', 'Курс SELL', 'Спред %', 'Профіт UAH', ''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pairs.map(p => (
                <tr key={p.id}>
                  <td style={S.td}>{fmtDate(p.created_at)}</td>
                  <td style={S.td}>{p.workers}</td>
                  <td style={{ ...S.td, color: '#22c55e', fontWeight: '700' }}>{fmt(p.buy_rate, 2)}</td>
                  <td style={{ ...S.td, color: 'var(--red)', fontWeight: '700' }}>{fmt(p.sell_rate, 2)}</td>
                  <td style={{ ...S.td, color: 'var(--green)', fontWeight: '800', fontSize: '14px' }}>{p.spread_pct}%</td>
                  <td style={{ ...S.td, color: 'var(--yellow)', fontWeight: '700' }}>₴{fmt(p.profit_uah)}</td>
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
