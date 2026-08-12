import { useState, useEffect, useCallback, useRef } from 'react'
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
  const [screenshot, setScreenshot] = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('bans')
      .select('*')
      .order('created_at', { ascending: false })
    setBans(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setScreenshot(file)
    setPreview(URL.createObjectURL(file))
  }

  const submit = async () => {
    if (!form.client_name || !form.reason) return alert('Заповніть імʼя клієнта та причину')
    setSaving(true)

    let screenshot_url = null

    // Upload screenshot if selected
    if (screenshot) {
      const ext = screenshot.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ban-screenshots')
        .upload(fileName, screenshot, { contentType: screenshot.type })

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('ban-screenshots')
          .getPublicUrl(fileName)
        screenshot_url = urlData.publicUrl
      }
    }

    const { error } = await supabase.from('bans').insert({
      worker_id: profile.id,
      worker_name: profile.full_name || profile.email,
      client_name: form.client_name,
      reason: form.reason === 'Інше' ? form.custom_reason : form.reason,
      platform: form.platform,
      amount: form.amount ? parseFloat(form.amount) : null,
      screenshot_url,
    })

    setSaving(false)
    if (error) return alert('Помилка: ' + error.message)
    setForm({ client_name: '', reason: '', custom_reason: '', platform: 'Binance', amount: '' })
    setScreenshot(null)
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
    load()
  }

  const deleteBan = async (id, screenshot_url) => {
    if (!window.confirm('Видалити з бан-листа?')) return
    // Delete screenshot from storage
    if (screenshot_url) {
      const fileName = screenshot_url.split('/').pop()
      await supabase.storage.from('ban-screenshots').remove([fileName])
    }
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
      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <img src={lightbox} alt="screenshot" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px', boxShadow: '0 0 40px rgba(0,0,0,0.8)' }} />
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: '#fff', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>
      )}

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
            <select value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))} style={S.select}>
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
                <button key={r} onClick={() => setForm(p => ({ ...p, reason: r }))} style={{
                  padding: '6px 12px', borderRadius: '6px',
                  border: `1px solid ${form.reason === r ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  background: form.reason === r ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.03)',
                  color: form.reason === r ? '#ef4444' : 'var(--text3)',
                  fontSize: '11px', cursor: 'pointer', transition: 'all 0.15s',
                }}>{r}</button>
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

          {/* Screenshot upload */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={S.label}>Скріншот профілю / QR-код</label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  width: '100px', height: '100px',
                  border: `2px dashed ${preview ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: '8px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', gap: '6px',
                  background: preview ? 'transparent' : 'rgba(255,255,255,0.02)',
                  overflow: 'hidden', flexShrink: 0,
                  transition: 'all 0.2s',
                }}
              >
                {preview ? (
                  <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <>
                    <span style={{ fontSize: '24px' }}>📷</span>
                    <span style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.5px' }}>Додати фото</span>
                  </>
                )}
              </div>
              {preview && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#22c55e' }}>✓ Фото вибрано</span>
                  <button
                    onClick={() => { setScreenshot(null); setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                    style={{ ...S.btnDanger, padding: '4px 10px', fontSize: '11px' }}
                  >Видалити</button>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <button onClick={submit} disabled={saving} style={{
            ...S.btnPrimary,
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: '#fff',
          }}>
            {saving ? 'ЗБЕРЕЖЕННЯ...' : '🚫 ЗАБЛОКУВАТИ'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ ...S.card, padding: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} style={{ ...S.input, width: '220px' }} placeholder="🔍 Пошук..." />
          <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} style={{ ...S.select, width: 'auto' }}>
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
            display: 'flex', alignItems: 'flex-start', gap: '14px',
          }}>
            {/* Screenshot thumbnail */}
            {b.screenshot_url ? (
              <img
                src={b.screenshot_url}
                alt="screenshot"
                onClick={() => setLightbox(b.screenshot_url)}
                style={{
                  width: '64px', height: '64px', objectFit: 'cover',
                  borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)',
                  cursor: 'zoom-in', flexShrink: 0,
                }}
                title="Натисни для перегляду"
              />
            ) : (
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', flexShrink: 0,
              }}>🚫</div>
            )}

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '15px', fontWeight: '800', color: '#ef4444' }}>{b.client_name}</span>
                <span style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', letterSpacing: '1px' }}>
                  {b.platform}
                </span>
                {b.amount && (
                  <span style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', color: 'var(--yellow)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px' }}>
                    збиток ₴{fmt(b.amount)}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text3)' }}>Причина: </span>{b.reason}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                Додав: <span style={{ color: 'var(--text2)' }}>{b.worker_name}</span>
                <span style={{ margin: '0 8px' }}>·</span>
                {new Date(b.created_at).toLocaleDateString('uk-UA')}
                {' о '}
                {new Date(b.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
              {b.screenshot_url && (
                <button onClick={() => setLightbox(b.screenshot_url)} style={{ ...S.btnSecondary, padding: '5px 10px', fontSize: '11px' }}>
                  🔍 Фото
                </button>
              )}
              {(profile?.role === 'admin' || b.worker_id === profile?.id) && (
                <button onClick={() => deleteBan(b.id, b.screenshot_url)} style={{ ...S.btnSecondary, padding: '5px 10px', fontSize: '11px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                  Розблокувати
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
