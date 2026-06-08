import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { S, fmt, Spinner } from '../components/ui'

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function BalancesPage() {
  const { profile } = useAuth()
  const [balances, setBalances] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterWorker, setFilterWorker] = useState('all')
  const [dateFrom, setDateFrom] = useState(todayStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [period, setPeriod] = useState('today')
  const [form, setForm] = useState({ amount: '', date: todayStr(), note: '' })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editAmount, setEditAmount] = useState('')

  const load = useCallback(async () => {
    let query = supabase.from('balances').select('*').order('date', { ascending: false }).order('created_at', { ascending: false })
    if (profile?.role !== 'admin') {
      query = query.eq('worker_id', profile?.id)
    }
    const { data } = await query
    setBalances(data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => { if (profile) load() }, [profile, load])

  const applyPeriod = (p) => {
    setPeriod(p)
    const t = todayStr()
    if (p === 'today') { setDateFrom(t); setDateTo(t) }
    if (p === 'week') { const d = new Date(); d.setDate(d.getDate() - 7); setDateFrom(d.toISOString().slice(0, 10)); setDateTo(t) }
    if (p === 'month') { const d = new Date(); d.setMonth(d.getMonth() - 1); setDateFrom(d.toISOString().slice(0, 10)); setDateTo(t) }
    if (p === 'all') { setDateFrom('2020-01-01'); setDateTo(t) }
  }

  useEffect(() => { applyPeriod('today') }, [])

  const filtered = balances.filter(b => {
    const d = b.date
    const workerOk = filterWorker === 'all' || b.worker_name === filterWorker
    const fromOk = d >= dateFrom
    const toOk = d <= dateTo
    return workerOk && fromOk && toOk
  })

  const workers = [...new Set(balances.map(b => b.worker_name))]

  // Latest balance per worker
  const latestByWorker = {}
  balances.forEach(b => {
    if (!latestByWorker[b.worker_name] || b.date > latestByWorker[b.worker_name].date) {
      latestByWorker[b.worker_name] = b
    }
  })

  // Can edit only last 3 days
  const canEdit = (date) => {
    const d = new Date(date)
    const diff = (new Date() - d) / 86400000
    return diff <= 3
  }

  const submit = async () => {
    if (!form.amount || !form.date) return alert('Заповніть суму та дату')
    setSaving(true)
    const { error } = await supabase.from('balances').insert({
      worker_id: profile.id,
      worker_name: profile.full_name || profile.email,
      amount_usdt: parseFloat(form.amount),
      date: form.date,
      note: form.note || null,
    })
    setSaving(false)
    if (error) return alert('Помилка: ' + error.message)
    setForm({ amount: '', date: todayStr(), note: '' })
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
    load()
  }

  const saveEdit = async (id) => {
    if (!editAmount) return
    await supabase.from('balances').update({ 
      amount_usdt: parseFloat(editAmount),
      edited: true,
      edited_at: new Date().toISOString()
    }).eq('id', id)
    setEditingId(null)
    setEditAmount('')
    load()
  }

  const deleteBalance = async (id) => {
    if (!window.confirm('Видалити запис?')) return
    await supabase.from('balances').delete().eq('id', id)
    setBalances(prev => prev.filter(b => b.id !== id))
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Spinner size={32} /></div>

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', letterSpacing: '1px' }}>💰 Баланси</h1>
        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
          {profile?.role === 'admin' ? 'Торгові баланси всіх співробітників' : 'Мій торговий баланс'}
        </div>
      </div>

      {/* Add balance form */}
      <div style={S.card}>
        <div style={S.cardTitle}>➕ Внести баланс</div>
        {success && (
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#22c55e', fontSize: '12px', marginBottom: '14px' }}>
            ✓ Баланс збережено!
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <div>
            <label style={S.label}>Баланс USDT *</label>
            <input
              type="number"
              value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              style={S.input}
              placeholder="1000.00"
              min="0"
              step="0.01"
            />
          </div>
          <div>
            <label style={S.label}>Дата *</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              style={{ ...S.input, colorScheme: 'dark' }}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={S.label}>Примітка</label>
            <input
              value={form.note}
              onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              style={S.input}
              placeholder="Необов'язково..."
            />
          </div>
        </div>
        <div style={{ marginTop: '16px' }}>
          <button style={S.btnPrimary} onClick={submit} disabled={saving}>
            {saving ? 'ЗБЕРЕЖЕННЯ...' : '✓ ЗБЕРЕГТИ'}
          </button>
        </div>
      </div>

      {/* Latest balances summary (admin only) */}
      {profile?.role === 'admin' && Object.keys(latestByWorker).length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>📊 Поточні баланси</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            {Object.values(latestByWorker).sort((a, b) => b.amount_usdt - a.amount_usdt).map(b => (
              <div key={b.worker_name} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.worker_name}</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--blue)' }}>{fmt(b.amount_usdt)} USDT</div>
                <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '4px' }}>
                  {new Date(b.date).toLocaleDateString('uk-UA')}
                </div>
              </div>
            ))}
            <div style={{ background: 'rgba(99,255,176,0.04)', border: '1px solid rgba(99,255,176,0.15)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '4px' }}>ЗАГАЛОМ</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--green)' }}>
                {fmt(Object.values(latestByWorker).reduce((s, b) => s + +b.amount_usdt, 0))} USDT
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ ...S.card, padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[['today', 'Сьогодні'], ['week', 'Тиждень'], ['month', 'Місяць'], ['all', 'Всі']].map(([val, label]) => (
              <button key={val} onClick={() => applyPeriod(val)} style={{
                ...S.btnSecondary, padding: '7px 12px', fontSize: '11px',
                color: period === val ? 'var(--green)' : 'var(--text3)',
                borderColor: period === val ? 'rgba(99,255,176,0.4)' : 'rgba(255,255,255,0.08)',
                background: period === val ? 'rgba(99,255,176,0.08)' : 'transparent',
              }}>{label}</button>
            ))}
          </div>
          {profile?.role === 'admin' && (
            <select value={filterWorker} onChange={e => setFilterWorker(e.target.value)} style={{ ...S.select, width: 'auto' }}>
              <option value="all">Всі співробітники</option>
              {workers.map(w => <option key={w}>{w}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Balances table */}
      <div style={S.card}>
        <div style={S.cardTitle}>Історія балансів ({filtered.length})</div>
        {filtered.length === 0
          ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>Немає записів за вибраний період</div>
          : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[
                    'Дата',
                    ...(profile?.role === 'admin' ? ['Співробітник'] : []),
                    'Баланс USDT',
                    'Примітка',
                    ''
                  ].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id}>
                    <td style={S.td}>{new Date(b.date).toLocaleDateString('uk-UA')}</td>
                    {profile?.role === 'admin' && (
                      <td style={{ ...S.td, fontWeight: '600', color: 'var(--text)' }}>{b.worker_name}</td>
                    )}
                    <td style={S.td}>
                      {editingId === b.id ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input
                            type="number"
                            value={editAmount}
                            onChange={e => setEditAmount(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(b.id); if (e.key === 'Escape') setEditingId(null) }}
                            style={{ ...S.input, padding: '4px 8px', fontSize: '12px', width: '100px' }}
                            autoFocus
                          />
                          <button onClick={() => saveEdit(b.id)} style={{ ...S.btnPrimary, padding: '4px 10px', fontSize: '11px' }}>✓</button>
                          <button onClick={() => setEditingId(null)} style={{ ...S.btnSecondary, padding: '4px 8px', fontSize: '11px' }}>✕</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: 'var(--blue)', fontWeight: '700', fontSize: '14px' }}>{fmt(b.amount_usdt)} USDT</span>
                          {b.edited && (
                            <span style={{ fontSize: '9px', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: 'var(--yellow)', padding: '1px 6px', borderRadius: '4px', letterSpacing: '0.5px' }}
                              title={b.edited_at ? `Відредаговано: ${new Date(b.edited_at).toLocaleString('uk-UA')}` : ''}>
                              ✎ відредаговано
                            </span>
                          )}
                          {(profile?.role === 'admin' || b.worker_id === profile?.id) && canEdit(b.date) && (
                            <button
                              onClick={() => { setEditingId(b.id); setEditAmount(b.amount_usdt) }}
                              style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '12px', padding: '2px 4px' }}
                              title="Редагувати (доступно 3 дні)"
                            >✏️</button>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ ...S.td, color: 'var(--text3)', fontSize: '11px' }}>{b.note || '—'}</td>
                    <td style={S.td}>
                      {(profile?.role === 'admin' || b.worker_id === profile?.id) && (
                        <button style={S.btnDanger} onClick={() => deleteBalance(b.id)}>✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
