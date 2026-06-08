import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

export default function Layout() {
  const { profile, setProfile } = useAuth()
  const navigate = useNavigate()
  const [onlineWorkers, setOnlineWorkers] = useState([])
  const [statusLoading, setStatusLoading] = useState(false)

  // Load online workers (for admin)
  const loadOnlineWorkers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, status, status_updated_at')
      .eq('status', 'online')
    setOnlineWorkers(data || [])
  }

  useEffect(() => {
    if (profile?.role === 'admin') loadOnlineWorkers()

    // Realtime updates for status changes
    const channel = supabase.channel('status-channel')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        if (profile?.role === 'admin') loadOnlineWorkers()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile])

  const toggleStatus = async () => {
    const newStatus = profile?.status === 'online' ? 'offline' : 'online'
    setStatusLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus, status_updated_at: new Date().toISOString() })
      .eq('id', profile.id)
    if (!error) {
      setProfile(prev => ({ ...prev, status: newStatus }))
      if (profile?.role === 'admin') loadOnlineWorkers()
    }
    setStatusLoading(false)
  }

  const logout = async () => {
    // Set offline on logout
    await supabase.from('profiles').update({ status: 'offline' }).eq('id', profile.id)
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isOnline = profile?.status === 'online'

  const navItems = [
    { to: '/', label: '📊 Дашборд', exact: true },
    { to: '/add', label: '➕ Новий ордер' },
    { to: '/orders', label: '📋 Ордери' },
    { to: '/report', label: '📋 Мій звіт' },
    { to: '/losses', label: '📉 Витрати' },
    { to: '/top', label: '🏆 Топ' },
    ...(profile?.role === 'admin' ? [
      { to: '/pairs', label: '🔗 Пари / Спред' },
      { to: '/analytics', label: '📈 Аналітика' },
      { to: '/admin', label: '⚙️ Адмін' },
    ] : []),
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: '220px',
        minHeight: '100vh',
        background: 'rgba(0,0,0,0.4)',
        borderRight: '1px solid rgba(99,255,176,0.1)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--green)', letterSpacing: '2px' }}>⬡ P2P</div>
          <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '2px', marginTop: '2px' }}>UAH / USDT TRACKER</div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '12px 10px', flex: 1 }}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              style={({ isActive }) => ({
                display: 'block',
                padding: '10px 12px',
                borderRadius: '8px',
                marginBottom: '2px',
                color: isActive ? 'var(--green)' : 'var(--text3)',
                background: isActive ? 'rgba(99,255,176,0.08)' : 'transparent',
                border: isActive ? '1px solid rgba(99,255,176,0.2)' : '1px solid transparent',
                fontSize: '12px',
                letterSpacing: '0.5px',
                textDecoration: 'none',
                transition: 'all 0.15s',
              })}
            >
              {item.label}
            </NavLink>
          ))}

          {/* Online workers list (admin only) */}
          {profile?.role === 'admin' && (
            <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(99,255,176,0.04)', border: '1px solid rgba(99,255,176,0.1)', borderRadius: '8px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '1px', marginBottom: '8px' }}>
                🔋 ОНЛАЙН ({onlineWorkers.length})
              </div>
              {onlineWorkers.length === 0
                ? <div style={{ fontSize: '11px', color: 'var(--text3)' }}>Нікого немає</div>
                : onlineWorkers.map(w => (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', flexShrink: 0, boxShadow: '0 0 4px #22c55e', animation: 'pulse 2s infinite' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {w.full_name || w.email}
                    </span>
                  </div>
                ))
              }
            </div>
          )}
        </nav>

        {/* User info + status */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profile?.full_name || profile?.email}
          </div>
          <div style={{ fontSize: '10px', marginBottom: '10px' }}>
            <span style={{
              background: profile?.role === 'admin' ? 'rgba(99,255,176,0.15)' : 'rgba(96,165,250,0.15)',
              border: `1px solid ${profile?.role === 'admin' ? 'rgba(99,255,176,0.3)' : 'rgba(96,165,250,0.3)'}`,
              color: profile?.role === 'admin' ? 'var(--green)' : 'var(--blue)',
              padding: '2px 8px', borderRadius: '4px', letterSpacing: '1px',
            }}>{profile?.role?.toUpperCase()}</span>
          </div>

          {/* Status toggle button */}
          <button
            onClick={toggleStatus}
            disabled={statusLoading}
            style={{
              width: '100%',
              padding: '10px 8px',
              marginBottom: '8px',
              background: isOnline ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)',
              border: `1px solid ${isOnline ? 'rgba(34,197,94,0.4)' : 'rgba(100,116,139,0.3)'}`,
              borderRadius: '8px',
              color: isOnline ? '#22c55e' : 'var(--text3)',
              fontSize: '12px',
              fontWeight: '700',
              cursor: statusLoading ? 'wait' : 'pointer',
              letterSpacing: '0.5px',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontFamily: 'inherit',
            }}
          >
            {statusLoading ? '...' : isOnline ? '🔋 Я онлайн' : '🪫 Я офлайн'}
          </button>

          <button onClick={logout} style={{
            width: '100%', padding: '8px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '6px', color: 'var(--red2)',
            fontSize: '11px', cursor: 'pointer', letterSpacing: '1px',
            fontFamily: 'inherit',
          }}>ВИЙТИ</button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: '24px', overflowX: 'hidden' }}>
        <Outlet />
      </main>
    </div>
  )
}
