import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { S, Spinner } from '../components/ui'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Невірний email або пароль')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0e1a 0%, #111827 60%, #0d1117 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font)',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(99,255,176,0.15)',
        borderRadius: '16px',
        padding: '40px',
        animation: 'fadeIn 0.4s ease',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--green)', letterSpacing: '3px' }}>⬡ P2P</div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '3px', marginTop: '4px' }}>UAH / USDT TRACKER</div>
        </div>

        <form onSubmit={login}>
          <div style={{ marginBottom: '16px' }}>
            <label style={S.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={S.input}
              placeholder="worker@company.com"
              required
            />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={S.label}>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={S.input}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: 'var(--red2)', fontSize: '12px', marginBottom: '16px' }}>
              ⚠ {error}
            </div>
          )}

          <button type="submit" style={{ ...S.btnPrimary, width: '100%', padding: '13px', fontSize: '13px' }} disabled={loading}>
            {loading ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Spinner size={16} /> ВХІД...</span> : 'УВІЙТИ'}
          </button>
        </form>

        <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '8px', fontSize: '11px', color: 'var(--text3)', lineHeight: '1.6' }}>
          💡 Доступ тільки для авторизованих співробітників.<br />
          Зверніться до адміністратора для отримання облікових даних.
        </div>
      </div>
    </div>
  )
}
