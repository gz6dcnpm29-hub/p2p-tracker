import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { S, Spinner } from '../components/ui'

const PLATFORMS = ['Binance', 'OKX', 'Bybit', 'HTX', 'KuCoin', 'Gate.io', 'Інше']
const empty = { type: 'buy', rate: '', volume_uah: '', volume_usdt: '', platform: 'Binance', note: '' }

export default function AddOrderPage() {
  const { profile } = useAuth()
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const change = (e) => {
    const { name, value } = e.target
    setForm(prev => {
      const u = { ...prev, [name]: value }
      const rate = parseFloat(name === 'rate' ? value : prev.rate)
      const uah = parseFloat(name === 'volume_uah' ? value : prev.volume_uah)
      const usdt = parseFloat(name === 'volume_usdt' ? value : prev.volume_usdt)
      if (name === 'rate' || name === 'volume_uah') {
        if (rate > 0 && uah > 0) u.volume_usdt = (uah / rate).toFixed(4)
      }
      if (name === 'volume_usdt') {
        if (rate > 0 && usdt > 0) u.volume_uah = (usdt * rate).toFixed(2)
      }
      return u
    })
  }

  const submit = async () => {
    if (!form.rate || !form.volume_uah) return alert('Заповніть курс та об\'єм UAH')
    setLoading(true)
    const { error } = await supabase.from('orders').insert({
      worker_id: profile.id,
      worker_name: profile.full_name || profile.email,
      type: form.type,
      rate: parseFloat(form.rate),
      volume_uah: parseFloat(form.volume_uah),
      volume_usdt: parseFloat(form.volume_usdt) || parseFloat(form.volume_uah) / parseFloat(form.rate),
      platform: form.platform,
      note: form.note || null,
    })
    setLoading(false)
    if (error) return alert('Помилка збереження: ' + error.message)
    setForm(empty)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', letterSpacing: '1px' }}>Новий ордер</h1>
        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
          Співробітник: <span style={{ color: 'var(--green)' }}>{profile?.full_name || profile?.email}</span>
        </div>
      </div>

      {success && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#22c55e', fontSize: '12px', marginBottom: '20px', animation: 'fadeIn 0.3s ease' }}>
          ✓ Ордер успішно збережено!
        </div>
      )}

      <div style={S.card}>
        <div style={S.cardTitle}>Деталі ордеру</div>

        {/* Type selector */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          {[['buy', 'КУПІВЛЯ USDT', '#22c55e', 'rgba(34,197,94,0.1)', 'rgba(34,197,94,0.3)'],
            ['sell', 'ПРОДАЖ USDT', '#ef4444', 'rgba(239,68,68,0.1)', 'rgba(239,68,68,0.3)']].map(([val, label, color, bg, border]) => (
            <button
              key={val}
              onClick={() => setForm(p => ({ ...p, type: val }))}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '10px',
                border: `1px solid ${form.type === val ? border : 'var(--border)'}`,
                background: form.type === val ? bg : 'transparent',
                color: form.type === val ? color : 'var(--text3)',
                fontSize: '12px',
                fontWeight: '700',
                letterSpacing: '1px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >{label}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          <div>
            <label style={S.label}>Курс UAH/USDT *</label>
            <input name="rate" type="number" value={form.rate} onChange={change} style={S.input} placeholder="41.50" step="0.01" min="1" />
          </div>
          <div>
            <label style={S.label}>Об'єм UAH *</label>
            <input name="volume_uah" type="number" value={form.volume_uah} onChange={change} style={S.input} placeholder="10000" step="0.01" min="0" />
          </div>
          <div>
            <label style={S.label}>Об'єм USDT (авто)</label>
            <input name="volume_usdt" type="number" value={form.volume_usdt} onChange={change} style={{ ...S.input, color: 'var(--green)' }} placeholder="автоматично" step="0.0001" min="0" />
          </div>
          <div>
            <label style={S.label}>Платформа</label>
            <select name="platform" value={form.platform} onChange={change} style={S.select}>
              {PLATFORMS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={S.label}>Примітка</label>
            <input name="note" value={form.note} onChange={change} style={S.input} placeholder="Необов'язково..." />
          </div>
        </div>

        {/* Preview */}
        {form.rate && form.volume_uah && (
          <div style={{ marginTop: '20px', padding: '14px', background: 'rgba(99,255,176,0.04)', border: '1px solid rgba(99,255,176,0.12)', borderRadius: '8px', display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '4px', letterSpacing: '1px' }}>КУРС</div><div style={{ color: 'var(--yellow)', fontWeight: '700' }}>{form.rate} ₴</div></div>
            <div><div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '4px', letterSpacing: '1px' }}>UAH</div><div style={{ color: 'var(--text)', fontWeight: '700' }}>₴{form.volume_uah}</div></div>
            <div><div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '4px', letterSpacing: '1px' }}>USDT</div><div style={{ color: 'var(--green)', fontWeight: '700' }}>{form.volume_usdt} USDT</div></div>
          </div>
        )}

        <div style={{ marginTop: '20px' }}>
          <button style={S.btnPrimary} onClick={submit} disabled={loading}>
            {loading ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Spinner size={14} /> ЗБЕРЕЖЕННЯ...</span> : '✓ ЗБЕРЕГТИ ОРДЕР'}
          </button>
        </div>
      </div>
    </div>
  )
}
