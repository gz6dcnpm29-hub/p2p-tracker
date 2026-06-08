import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

export default function Layout() {
  const { profile, setProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [onlineWorkers, setOnlineWorkers] = useState([])
  const [statusLoading, setStatusLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  const loadOnlineWorkers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, status, status_updated_at')
      .eq('status', 'online')
    setOnlineWorkers(data || [])
  }

  useEffect(() => {
    if (profile?.role === 'admin') loadOnlineWorkers()
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
      await supabase.from('status_logs').insert({
        worker_id: profile.id,
        worker_name: profile.full_name || profile.email,
        status: newStatus,
      })
      setProfile(prev => ({ ...prev, status: newStatus }))
      if (profile?.role === 'admin') loadOnlineWorkers()
    }
    setStatusLoading(false)
  }

  const logout = async () => {
    await supabase.from('profiles').update({ status: 'offline' }).eq('id', profile.id)
    await supabase.from('status_logs').insert({
      worker_id: profile.id,
      worker_name: profile.full_name || profile.email,
      status: 'offline',
    })
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isOnline = profile?.status === 'online'

  const navItems = [
    { to: '/', label: '📊 Дашборд', exact: true },
    ...(profile?.role !== 'admin' ? [{ to: '/add', label: '➕ Новий ордер' }] : []),
    { to: '/orders', label: '📋 Ордери' },
    ...(profile?.role !== 'admin' ? [{ to: '/report', label: '📋 Мій звіт' }] : []),
    { to: '/losses', label: '📉 Витрати' },
    { to: '/top', label: '🏆 Топ' },
    ...(profile?.role === 'admin' ? [
      { to: '/pairs', label: '🔗 Пари / Спред' },
      { to: '/analytics', label: '📈 Аналітика' },
      { to: '/status-logs', label: '🕐 Журнал онлайну' },
      { to: '/admin', label: '⚙️ Адмін' },
    ] : []),
  ]

  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--green)', letterSpacing: '2px' }}>⬡ P2P</div>
        <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '2px', marginTop: '2px' }}>UAH / USDT TRACKER</div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '10px 10px', flex: 1, overflowY: 'auto' }}>
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
              fontSize: '13px',
              letterSpacing: '0.5px',
              textDecoration: 'none',
              transition: 'all 0.15s',
            })}
          >
            {item.label}
          </NavLink>
        ))}

        {/* Online workers (admin) */}
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
      <div style={{ padding: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
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

        <button onClick={toggleStatus} disabled={statusLoading} style={{
          width: '100%', padding: '10px 8px', marginBottom: '8px',
          background: isOnline ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)',
          border: `1px solid ${isOnline ? 'rgba(34,197,94,0.4)' : 'rgba(100,116,139,0.3)'}`,
          borderRadius: '8px',
          color: isOnline ? '#22c55e' : 'var(--text3)',
          fontSize: '12px', fontWeight: '700', cursor: statusLoading ? 'wait' : 'pointer',
          transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          fontFamily: 'inherit',
        }}>
          {statusLoading ? '...' : isOnline ? '🔋 Я онлайн' : '🪫 Я офлайн'}
        </button>

        <button onClick={logout} style={{
          width: '100%', padding: '8px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '6px', color: 'var(--red2)', fontSize: '11px',
          cursor: 'pointer', letterSpacing: '1px', fontFamily: 'inherit',
        }}>ВИЙТИ</button>
      </div>
    </>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* ── Desktop sidebar ── */}
      <aside style={{
        width: '220px',
        minHeight: '100vh',
        background: 'rgba(0,0,0,0.4)',
        borderRight: '1px solid rgba(99,255,176,0.1)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        // Hide on mobile
        '@media (max-width: 768px)': { display: 'none' },
      }}
      className="desktop-sidebar">
        {sidebarContent}
      </aside>

      {/* ── Mobile header ── */}
      <div className="mobile-header" style={{
        display: 'none',
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(10,14,26,0.97)',
        borderBottom: '1px solid rgba(99,255,176,0.15)',
        padding: '12px 16px',
        alignItems: 'center',
        justifyContent: 'space-between',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--green)', letterSpacing: '2px' }}>⬡ P2P</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Online status dot */}
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? '#22c55e' : '#64748b', boxShadow: isOnline ? '0 0 6px #22c55e' : 'none' }} />
          {/* Burger button */}
          <button onClick={() => setMenuOpen(!menuOpen)} style={{
            background: 'transparent', border: 'none', color: 'var(--text2)',
            fontSize: '20px', cursor: 'pointer', padding: '4px', lineHeight: 1,
          }}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* ── Mobile menu overlay ── */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 150,
            background: 'rgba(0,0,0,0.5)',
            display: 'none',
          }}
          className="mobile-overlay"
        />
      )}

      {/* ── Mobile drawer ── */}
      <div className="mobile-drawer" style={{
        display: 'none',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 200,
        width: '260px',
        background: '#0d1117',
        borderRight: '1px solid rgba(99,255,176,0.15)',
        flexDirection: 'column',
        transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s ease',
        overflowY: 'auto',
      }}>
        {sidebarContent}
      </div>

      {/* ── Main content ── */}
      <main style={{ flex: 1, padding: '24px', overflowX: 'hidden' }}
        className="main-content">
        <Outlet />
      </main>

      {/* ── Responsive styles ── */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-header { display: flex !important; }
          .mobile-drawer { display: flex !important; }
          .mobile-overlay { display: block !important; }
          .main-content {
            padding: 76px 12px 20px !important;
          }
        }
      `}</style>
    </div>
  )
}
