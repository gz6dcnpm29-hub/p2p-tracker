import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { S, fmt, Spinner } from '../components/ui'

const PLATFORMS = ['Binance', 'OKX', 'Bybit', 'HTX', 'KuCoin', 'Gate.io', 'Інше']
const REASONS = [
  'Не оплатив',
  'Заморозка коштів',
  'Шахрайство',
  'Чарджбек',
  'Підозріла активність',
  'Порушення умов',
  'Інше',
]

export default function BanPage() {
  const { profile } = useAuth()
  const [bans, setBans] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [form, setForm] = useState({
    client_name: '',
    reason: '',
    custom_reason: '',
    platform: 'Binance',
    amount: '',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('bans')
      .select('*')
      .order('created_at', { ascending: false })
    setBans(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!form.client_name || !form.reason) return alert('Заповніть імʼя клієнта та причину')
    setSaving(true)
    const { error } = await supabase.from('bans').insert({
      worker_id: profile.id,
      worker_name: profile.full_name || profile.email,
      client_name: form.client_name,
      reason: form.reason === 'Інше' ? form.custom_reason : form.reason,
      platform: form.platform,
      amount: form.amount ? parseFloat(form.amount) : null,
    })
    setSaving(false)
    if (error) return alert('Помилка: ' + error.message)
    setForm({ client_name: '', reason: '', custom_reason: '', platform: 'Binance', amount: '' })
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
    load()
  }

  const deleteBan = async (id) => {
    if (!window.confirm('Видалити з бан-листа?')) return
    await supabase.from('bans').delete().eq('id', id)
    setBans(prev => prev.filter(b => b.id !== id))
  }

  const filtered = bans.filter(b => {
    const searchOk = search === '' ||
      b.client_name.toLowerCase().includes(search.toLowerCase()) ||
      b.reason.toLowerCase().includes(search.toLowerCase()) ||
      b.worker_name.toLowerCase().includes(search.toLowerCase())
    const platformOk = filterPlatform === 'all' || b.platform === filterPlatform
    return searchOk && platformOk
  })

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Spinner size={32} /></div>

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#ef4444', letterSpacing: '1px' }}>
          🚫 БАН-ЛИСТ
        </h1>
        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
          Чорний список клієнтів · {bans.length} записів
        </div>
      </div>

      {/* Add ban form */}
      <div style={{ ...S.card, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.03)' }}>
        <div style={{ ...S.cardTitle, color: '#ef4444' }}>➕ Додати до бан-листа</div>

        {success && (
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#22c55e', fontSize: '12px', marginBottom: '14px' }}>
            ✓ Клієнта додано до бан-листа!
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <div>
            <label style={S.label}>Нік / Імʼя клієнта *</label>
            <input
              value={form.client_name}
              onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))}
              style={S.input}
              placeholder="username або імʼя"
            />
          </div>

          <div>
            <label style={S.label}>Платформа</label>
            <select
              value={form.platform}
              onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}
              style={S.select}
            >
              {PLATFORMS.map(pl => <option key={pl}>{pl}</option>)}
            </select>
          </div>

          <div>
            <label style={S.label}>Сума збитку UAH</label>
            <input
              type="number"
              value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              style={S.input}
              placeholder="необов'язково"
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={S.label}>Причина блокування *</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => setForm(p => ({ ...p, reason: r }))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${form.reason === r ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    background: form.reason === r ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.03)',
                    color: form.reason === r ? '#ef4444' : 'var(--text3)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            {form.reason === 'Інше' && (
              <input
                value={form.custom_reason}
                onChange={e => setForm(p => ({ ...p, custom_reason: e.target.value }))}
                style={S.input}
                placeholder="Вкажіть причину..."
              />
            )}
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <button
            onClick={submit}
            disabled={saving}
            style={{
              ...S.btnPrimary,
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#fff',
            }}
          >
            {saving ? 'ЗБЕРЕЖЕННЯ...' : '🚫 ЗАБЛОКУВАТИ'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ ...S.card, padding: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...S.input, width: '220px' }}
            placeholder="🔍 Пошук по імені, причині..."
          />
          <select
            value={filterPlatform}
            onChange={e => setFilterPlatform(e.target.value)}
            style={{ ...S.select, width: 'auto' }}
          >
            <option value="all">Всі платформи</option>
            {PLATFORMS.map(pl => <option key={pl}>{pl}</option>)}
          </select>
          <div style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: 'auto' }}>
            Знайдено: <span style={{ color: '#ef4444', fontWeight: '700' }}>{filtered.length}</span>
          </div>
        </div>
      </div>

      {/* Ban list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.length === 0 ? (
          <div style={{ ...S.card, textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
            {search ? 'Нічого не знайдено' : 'Бан-лист порожній 🎉'}
          </div>
        ) : filtered.map(b => (
          <div key={b.id} style={{
            ...S.card,
            border: '1px solid rgba(239,68,68,0.2)',
            background: 'rgba(239,68,68,0.03)',
            marginBottom: 0,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
          }}>
            {/* Ban icon */}
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0,
            }}>🚫</div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '15px', fontWeight: '800', color: '#ef4444' }}>
                  {b.client_name}
                </span>
                <span style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#ef4444',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  letterSpacing: '1px',
                }}>
                  {b.platform}
                </span>
                {b.amount && (
                  <span style={{
                    background: 'rgba(251,191,36,0.1)',
                    border: '1px solid rgba(251,191,36,0.2)',
                    color: 'var(--yellow)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                  }}>
                    збиток ₴{fmt(b.amount)}
                  </span>
                )}
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text3)' }}>Причина: </span>
                {b.reason}
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                Додав: <span style={{ color: 'var(--text2)' }}>{b.worker_name}</span>
                <span style={{ margin: '0 8px' }}>·</span>
                {new Date(b.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                <span style={{ margin: '0 4px' }}>о</span>
                {new Date(b.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {/* Delete button */}
            {(profile?.role === 'admin' || b.worker_id === profile?.id) && (
              <button
                onClick={() => deleteBan(b.id)}
                style={{
                  ...S.btnSecondary,
                  padding: '6px 12px',
                  fontSize: '11px',
                  color: '#ef4444',
                  borderColor: 'rgba(239,68,68,0.3)',
                  flexShrink: 0,
                }}
              >
                Розблокувати
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
