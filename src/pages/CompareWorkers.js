import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { S, fmt, Spinner } from '../components/ui'

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function CompareWorkers() {
  const [orders, setOrders] = useState([])
  const [pairs, setPairs] = useState([])
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [worker1, setWorker1] = useState('')
  const [worker2, setWorker2] = useState('')
  const [period, setPeriod] = useState('month')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = useCallback(async () => {
    const { data: o } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    const { data: p } = await supabase.from('pairs').select('*').order('created_at', { ascending: false })
    const allOrders = o || []
    setOrders(allOrders)
    setPairs(p || [])
    const w = [...new Set(allOrders.map(o => o.worker_name))]
    setWorkers(w)
    if (w.length >= 1) setWorker1(w[0])
    if (w.length >= 2) setWorker2(w[1])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const applyPeriod = (p) => {
    setPeriod(p)
    const t = todayStr()
    if (p === 'today') { setDateFrom(t); setDateTo(t) }
    if (p === 'week') { const d = new Date(); d.setDate(d.getDate() - 7); setDateFrom(d.toISOString().slice(0, 10)); setDateTo(t) }
    if (p === 'month') { const d = new Date(); d.setMonth(d.getMonth() - 1); setDateFrom(d.toISOString().slice(0, 10)); setDateTo(t) }
    if (p === 'all') { setDateFrom(''); setDateTo('') }
  }

  useEffect(() => { applyPeriod('month') }, [])

  const getStats = (workerName) => {
    const workerOrders = orders.filter(o => {
      const d = o.created_at.slice(0, 10)
      const dateOk = (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo)
      return o.worker_name === workerName && dateOk
    })

    const buyOrders = workerOrders.filter(o => o.type === 'buy')
    const sellOrders = workerOrders.filter(o => o.type === 'sell')
    const buyUAH = buyOrders.reduce((s, o) => s + +o.volume_uah, 0)
    const buyUSDT = buyOrders.reduce((s, o) => s + +o.volume_usdt, 0)
    const avgBuyRate = buyUSDT > 0 ? buyUAH / buyUSDT : 0
    const sellUAH = sellOrders.reduce((s, o) => s + +o.volume_uah, 0)
    const sellUSDT = sellOrders.reduce((s, o) => s + +o.volume_usdt, 0)
    const avgSellRate = sellUSDT > 0 ? sellUAH / sellUSDT : 0

    // Profit from pairs
    const workerPairs = pairs.filter(p => {
      const d = p.created_at.slice(0, 10)
      const dateOk = (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo)
      return (p.workers || '').split(/[,/]/).map(w => w.trim()).includes(workerName) && dateOk
    })
    const totalProfitUAH = workerPairs.reduce((s, p) => {
      const wList = (p.workers || '').split(/[,/]/).map(w => w.trim()).filter(Boolean)
      return s + +(p.profit_uah || 0) / wList.length
    }, 0)
    const profitUSDT = avgBuyRate > 0 ? totalProfitUAH / avgBuyRate : 0
    const spread = avgBuyRate && avgSellRate ? (((avgSellRate - avgBuyRate) / avgBuyRate) * 100) : 0

    // Active days
    const activeDays = new Set(workerOrders.map(o => o.created_at.slice(0, 10))).size

    return {
      totalOrders: workerOrders.length,
      buyCount: buyOrders.length,
      sellCount: sellOrders.length,
      buyUSDT,
      buyUAH,
      avgBuyRate,
      avgSellRate,
      spread,
      totalProfitUAH,
      profitUSDT,
      activeDays,
      pairsCount: workerPairs.length,
    }
  }

  const stats1 = worker1 ? getStats(worker1) : null
  const stats2 = worker2 ? getStats(worker2) : null

  const Winner = ({ v1, v2, higher = true }) => {
    if (!v1 || !v2) return null
    const w1wins = higher ? v1 > v2 : v1 < v2
    const w2wins = higher ? v2 > v1 : v2 < v1
    if (v1 === v2) return null
    return (
      <span style={{
        fontSize: '10px',
        padding: '1px 6px',
        borderRadius: '4px',
        background: 'rgba(34,197,94,0.15)',
        border: '1px solid rgba(34,197,94,0.3)',
        color: '#22c55e',
        marginLeft: '6px',
      }}>
        {w1wins ? '👑 краще' : w2wins ? '👑 краще' : ''}
      </span>
    )
  }

  const Row = ({ label, v1, v2, format = (v) => v, higher = true, color1 = 'var(--text)', color2 = 'var(--text)' }) => {
    if (!stats1 || !stats2) return null
    const val1 = v1(stats1)
    const val2 = v2(stats2)
    const w1wins = higher ? val1 > val2 : val1 < val2
    const w2wins = higher ? val2 > val1 : val2 < val1
    return (
      <tr>
        <td style={{ ...S.td, color: w1wins ? '#22c55e' : color1, fontWeight: w1wins ? '700' : '400', textAlign: 'right' }}>
          {format(val1)}
          {w1wins && <span style={{ marginLeft: '4px' }}>👑</span>}
        </td>
        <td style={{ ...S.td, color: 'var(--text3)', textAlign: 'center', fontSize: '11px', letterSpacing: '1px', whiteSpace: 'nowrap' }}>
          {label}
        </td>
        <td style={{ ...S.td, color: w2wins ? '#22c55e' : color2, fontWeight: w2wins ? '700' : '400', textAlign: 'left' }}>
          {w2wins && <span style={{ marginRight: '4px' }}>👑</span>}
          {format(val2)}
        </td>
      </tr>
    )
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Spinner size={32} /></div>

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', letterSpacing: '1px' }}>⚔️ Порівняння воркерів</h1>
        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>Тільки для адміна</div>
      </div>

      {/* Filters */}
      <div style={{ ...S.card, padding: '14px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[['today', 'Сьогодні'], ['week', 'Тиждень'], ['month', 'Місяць'], ['all', 'Весь час']].map(([val, label]) => (
              <button key={val} onClick={() => applyPeriod(val)} style={{
                ...S.btnSecondary, padding: '7px 12px', fontSize: '11px',
                color: period === val ? 'var(--green)' : 'var(--text3)',
                borderColor: period === val ? 'rgba(99,255,176,0.4)' : 'rgba(255,255,255,0.08)',
                background: period === val ? 'rgba(99,255,176,0.08)' : 'transparent',
              }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Worker selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ ...S.card, marginBottom: 0, textAlign: 'center', border: '1px solid rgba(99,255,176,0.2)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '2px', marginBottom: '10px' }}>ВОРКЕР 1</div>
          <select
            value={worker1}
            onChange={e => setWorker1(e.target.value)}
            style={{ ...S.select, textAlign: 'center', fontSize: '14px', fontWeight: '700' }}
          >
            <option value="">— оберіть —</option>
            {workers.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>

        <div style={{ fontSize: '24px', textAlign: 'center' }}>⚔️</div>

        <div style={{ ...S.card, marginBottom: 0, textAlign: 'center', border: '1px solid rgba(96,165,250,0.2)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '2px', marginBottom: '10px' }}>ВОРКЕР 2</div>
          <select
            value={worker2}
            onChange={e => setWorker2(e.target.value)}
            style={{ ...S.select, textAlign: 'center', fontSize: '14px', fontWeight: '700' }}
          >
            <option value="">— оберіть —</option>
            {workers.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
      </div>

      {/* Comparison table */}
      {stats1 && stats2 && (
        <div style={S.card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0', marginBottom: '16px' }}>
            <div style={{ textAlign: 'right', fontSize: '16px', fontWeight: '800', color: 'var(--green)', padding: '0 16px' }}>{worker1}</div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ textAlign: 'left', fontSize: '16px', fontWeight: '800', color: 'var(--blue)', padding: '0 16px' }}>{worker2}</div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <Row label="Ордерів" v1={s => s.totalOrders} v2={s => s.totalOrders} format={v => v} />
                <Row label="Buy / Sell" v1={s => s.buyCount} v2={s => s.buyCount}
                  format={(v) => `${v}`}
                  higher={true}
                />
                <Row label="Куплено USDT" v1={s => s.buyUSDT} v2={s => s.buyUSDT} format={v => `${fmt(v)} USDT`} color1="var(--blue)" color2="var(--blue)" />
                <Row label="Об'єм UAH" v1={s => s.buyUAH} v2={s => s.buyUAH} format={v => `₴${fmt(v, 0)}`} color1="var(--yellow)" color2="var(--yellow)" />
                <Row label="Сер. курс BUY" v1={s => s.avgBuyRate} v2={s => s.avgBuyRate} format={v => `${fmt(v, 2)}₴`} higher={false} />
                <Row label="Сер. курс SELL" v1={s => s.avgSellRate} v2={s => s.avgSellRate} format={v => `${fmt(v, 2)}₴`} />
                <Row label="Спред %" v1={s => s.spread} v2={s => s.spread} format={v => `${fmt(v, 3)}%`} color1="var(--green)" color2="var(--green)" />
                <Row label="Профіт UAH" v1={s => s.totalProfitUAH} v2={s => s.totalProfitUAH} format={v => `₴${fmt(v)}`} color1="var(--green)" color2="var(--green)" />
                <Row label="Профіт USDT" v1={s => s.profitUSDT} v2={s => s.profitUSDT} format={v => `${fmt(v)} USDT`} color1="var(--green)" color2="var(--green)" />
                <Row label="Активних днів" v1={s => s.activeDays} v2={s => s.activeDays} format={v => `${v} дн`} />
                <Row label="Пар" v1={s => s.pairsCount} v2={s => s.pairsCount} format={v => v} />
              </tbody>
            </table>
          </div>

          {/* Winner summary */}
          {(() => {
            if (!stats1 || !stats2) return null
            const scores = [
              stats1.totalOrders > stats2.totalOrders,
              stats1.buyUSDT > stats2.buyUSDT,
              stats1.spread > stats2.spread,
              stats1.totalProfitUAH > stats2.totalProfitUAH,
              stats1.activeDays > stats2.activeDays,
            ]
            const w1score = scores.filter(Boolean).length
            const w2score = scores.length - w1score
            const winner = w1score > w2score ? worker1 : w2score > w1score ? worker2 : null
            return (
              <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(99,255,176,0.04)', border: '1px solid rgba(99,255,176,0.15)', borderRadius: '10px', textAlign: 'center' }}>
                {winner ? (
                  <>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏆</div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--green)' }}>{winner} перемагає!</div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
                      {w1score} vs {w2score} по ключових показниках
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>🤝</div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--yellow)' }}>Нічия!</div>
                  </>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {workers.length < 2 && (
        <div style={{ ...S.card, textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
          Потрібно мінімум 2 воркери для порівняння
        </div>
      )}
    </div>
  )
}
