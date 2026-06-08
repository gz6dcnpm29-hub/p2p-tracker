import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { S, fmt, Spinner } from '../components/ui'

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function LossesPage() {
  const { profile } = useAuth()
  const [losses, setLosses] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterWorker, setFilterWorker] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [period, setPeriod] = useState('month')
  const [form, setForm] = useState({ amount: '', description: '', date: todayStr() })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const load = useCallback(async () => {
    let query = supabase.from('losses').select('*').order('date', { ascending: false })
    if (profile?.role !== 'admin') {
      query = query.eq('worker_id', profile?.id)
    }
    const { data } = await query
    setLosses(data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => { if (profile) load() }, [profile, load])

  const applyPeriod = (p) => {
    setPeriod(p)
    const t = todayStr()
    if (p === 'today') { setDateFrom(t); setDateTo(t) }
    if (p === 'week') { const d = new Date(); d.setDate(d.getDate() - 7); setDateFrom(d.toISOString().slice(0, 10)); setDateTo(t) }
    if (p === 'month') { const d = new Date(); d.setMonth(d.getMonth() - 1); setDateFrom(d.toISOString().slice(0, 10)); setDateTo(t) }
    if (p === 'all') { setDateFrom(''); setDateTo('') }
    if (p === 'custom') { /* keep */ }
  }

  useEffect(() => { applyPeriod('month') }, [])

  const filtered = losses.filter(l => {
    const d = l.date
    const workerOk = filterWorker === 'all' || l.worker_name === filterWorker
    const fromOk = !dateFrom || d >= dateFrom
    const toOk = !dateTo || d <= dateTo
    return workerOk && fromOk && toOk
  })

  const workers = [...new Set(losses.map(l => l.worker_name))]
  const totalLoss = filtered.reduce((s, l) => s + +l.amount, 0)

  // Per worker stats (admin only)
  const workerStats = workers.map(w => ({
    name: w,
    total: losses.filter(l => l.worker_name === w && (!dateFrom || l.date >= dateFrom) && (!dateTo || l.date <= dateTo)).reduce((s, l) => s + +l.amount, 0),
    count: losses.filter(l => l.worker_name === w && (!dateFrom || l.date >= dateFrom) && (!dateTo || l.date <= dateTo)).length,
  })).sort((a, b) => b.total - a.total)

  const submit = async () => {
    if (!form.amount || !form.description || !form.date) return alert('Заповніть всі поля')
    setSaving(true)
    const { error } = await supabase.from('losses').insert({
      worker_id: profile.id,
      worker_name: profile.full_name || profile.email,
      amount: parseFloat(form.amount),
      description: form.description,
      date: form.date,
    })
    setSaving(false)
    if (error) return alert('Помилка: ' + error.message)
    setForm({ amount: '', description: '', date: todayStr() })
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
    load()
  }

  const deleteLoss = async (id) => {
    if (!window.confirm('Видалити запис?')) return
    await supabase.from('losses').delete().eq('id', id)
    setLosses(prev => prev.filter(l => l.id !== id))
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Spinner size={32} /></div>

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', letterSpacing: '1px' }}>📉 Витрати</h1>
        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
          {profile?.role === 'admin' ? 'Всі витрати співробітників' : 'Мої витрати'}
        </div>
      </div>

      {/* Add loss form */}
      <div style={S.card}>
        <div style={S.cardTitle}>➕ Додати витрату</div>
        {success && (
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#22c55e', fontSize: '12px', marginBottom: '14px' }}>
            ✓ Витрату збережено!
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <div>
            <label style={S.label}>Сума UAH *</label>
            <input
              type="number"
              value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              style={S.input}
              placeholder="500"
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
            <label style={S.label}>Опис витрати *</label>
            <input
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              style={S.input}
              placeholder="Комісія біржі, помилка в ордері, штраф..."
            />
          </div>
        </div>
        <div style={{ marginTop: '16px' }}>
          <button style={S.btnPrimary} onClick={submit} disabled={saving}>
            {saving ? 'ЗБЕРЕЖЕННЯ...' : '✓ ЗБЕРЕГТИ'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ ...S.card, padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[['today', 'Сьогодні'], ['week', 'Тиждень'], ['month', 'Місяць'], ['all', 'Всі'], ['custom', 'Свій період']].map(([val, label]) => (
              <button key={val} onClick={() => applyPeriod(val)} style={{
                ...S.btnSecondary, padding: '7px 12px', fontSize: '11px',
                color: period === val ? 'var(--green)' : 'var(--text3)',
                borderColor: period === val ? 'rgba(99,255,176,0.4)' : 'rgba(255,255,255,0.08)',
                background: period === val ? 'rgba(99,255,176,0.08)' : 'transparent',
              }}>{label}</button>
            ))}
          </div>
          {period === 'custom' && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div><label style={S.label}>Від</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...S.input, width: 'auto', colorScheme: 'dark' }} /></div>
              <div><label style={S.label}>До</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...S.input, width: 'auto', colorScheme: 'dark' }} /></div>
            </div>
          )}
          {profile?.role === 'admin' && (
            <select value={filterWorker} onChange={e => setFilterWorker(e.target.value)} style={{ ...S.select, width: 'auto' }}>
              <option value="all">Всі співробітники</option>
              {workers.map(w => <option key={w}>{w}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '16px' }}>
        <div style={S.card}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Всього витрат</div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--red)' }}>₴{fmt(totalLoss)}</div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>{filtered.length} записів</div>
        </div>
        {profile?.role === 'admin' && workerStats.map((w, i) => (
          <div key={w.name} style={S.card}>
            <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--red)' }}>₴{fmt(w.total)}</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>{w.count} записів</div>
          </div>
        ))}
      </div>

      {/* Losses table */}
      <div style={S.card}>
        <div style={S.cardTitle}>Список витрат ({filtered.length})</div>
        {filtered.length === 0
          ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>Витрат немає за вибраний період</div>
          : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[
                    'Дата',
                    ...(profile?.role === 'admin' ? ['Співробітник'] : []),
                    'Опис',
                    'Сума UAH',
                    ''
                  ].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr key={l.id}>
                    <td style={S.td}>{new Date(l.date).toLocaleDateString('uk-UA')}</td>
                    {profile?.role === 'admin' && (
                      <td style={{ ...S.td, fontWeight: '600', color: 'var(--text)' }}>{l.worker_name}</td>
                    )}
                    <td style={{ ...S.td, color: 'var(--text2)' }}>{l.description}</td>
                    <td style={{ ...S.td, color: 'var(--red)', fontWeight: '700' }}>₴{fmt(l.amount)}</td>
                    <td style={S.td}>
                      {(profile?.role === 'admin' || l.worker_id === profile?.id) && (
                        <button style={S.btnDanger} onClick={() => deleteLoss(l.id)}>✕</button>
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
