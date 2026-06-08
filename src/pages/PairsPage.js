import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { S, fmt, fmtDate, Spinner } from '../components/ui'

export default function PairsPage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState([])
  const [pairs, setPairs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBuyIds, setSelectedBuyIds] = useState([])
  const [selectedSellIds, setSelectedSellIds] = useState([])
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

  const toggleId = (id, list, setList) => {
    setList(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // Aggregate selected orders
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
  const profit = avgBuyRate && avgSellRate && minUSDT > 0
    ? ((avgSellRate - avgBuyRate) * minUSDT).toFixed(2)
    : null

  const hasPreview = selectedBuyIds.length > 0 && selectedSellIds.length > 0

  const savePair = async () => {
    if (!hasPreview) return alert('Оберіть хоча б по одному ордеру з кожної сторони')
    setSaving(true)
    const workers = [...new Set([
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
      workers,
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
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
        border: `1px solid ${selected ? 'rgba(99,255,176,0.4)' : 'rgba(255,255,255,0.07)'}`,
        background: selected ? 'rgba(99,255,176,0.07)' : 'rgba(255,255,255,0.02)',
        marginBottom: '6px', transition: 'all 0.15s',
      }}
    >
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
        <span style={{ color: 'var(--text3)', fontSize: '11px' }}>{new Date(order.created_at).toLocaleDateString('uk-UA')}</span>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', letterSpacing: '1px' }}>Пари / Спред</h1>
        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>Оберіть кілька ордерів buy і sell — система порахує середній курс і загальний профіт</div>
      </div>

      {profile?.role === 'admin' && (
        <div style={S.card}>
          <div style={S.cardTitle}>Створити пару</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
            {/* BUY side */}
            <div>
              <div style={{ ...S.label, color: '#22c55e', marginBottom: '10px' }}>
                ✓ ОРДЕРИ BUY ({selectedBuyIds.length} обрано · ₴{fmt(totalBuyUAH, 0)})
              </div>
              {buyOrders.length === 0
                ? <div style={{ color: 'var(--text3)', fontSize: '12px' }}>Немає ордерів buy</div>
                : buyOrders.map(o => (
                  <OrderCheckbox
                    key={o.id}
                    order={o}
                    selected={selectedBuyIds.includes(o.id)}
                    onToggle={() => toggleId(o.id, selectedBuyIds, setSelectedBuyIds)}
                  />
                ))
              }
            </div>

            {/* SELL side */}
            <div>
              <div style={{ ...S.label, color: 'var(--red)', marginBottom: '10px' }}>
                ✓ ОРДЕРИ SELL ({selectedSellIds.length} обрано · ₴{fmt(totalSellUAH, 0)})
              </div>
              {sellOrders.length === 0
                ? <div style={{ color: 'var(--text3)', fontSize: '12px' }}>Немає ордерів sell</div>
                : sellOrders.map(o => (
                  <OrderCheckbox
                    key={o.id}
                    order={o}
                    selected={selectedSellIds.includes(o.id)}
                    onToggle={() => toggleId(o.id, selectedSellIds, setSelectedSellIds)}
                  />
                ))
              }
            </div>
          </div>

          {/* Preview */}
          {hasPreview && (
            <div style={{ padding: '16px', background: 'rgba(99,255,176,0.05)', border: '1px solid rgba(99,255,176,0.2)', borderRadius: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', marginBottom: '4px' }}>СЕР. КУРС BUY</div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: '#22c55e' }}>{fmt(avgBuyRate, 2)}₴</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', marginBottom: '4px' }}>СЕР. КУРС SELL</div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--red)' }}>{fmt(avgSellRate, 2)}₴</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', marginBottom: '4px' }}>СПРЕД %</div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--green)' }}>{spread}%</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', marginBottom: '4px' }}>РІЗНИЦЯ КУРСІВ</div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--yellow)' }}>₴{fmt(avgSellRate - avgBuyRate, 4)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', marginBottom: '4px' }}>ПРОФІТ UAH</div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: '#22c55e' }}>₴{fmt(profit)}</div>
                </div>
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
