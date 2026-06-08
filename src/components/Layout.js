import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

export default function Layout() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const logout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navItems = [
    { to: '/', label: '📊 Дашборд', exact: true },
    { to: '/add', label: '➕ Новий ордер' },
    { to: '/orders', label: '📋 Ордери' },
    { to: '/pairs', label: '🔗 Пари / Спред' },
    { to: '/top', label: '🏆 Топ' },
    ...(profile?.role === 'admin' ? [{ to: '/analytics', label: '📈 Аналітика' }, { to: '/admin', label: '⚙️ Адмін' }] : []),
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
        </nav>

        {/* User info */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profile?.full_name || profile?.email}
          </div>
          <div style={{ fontSize: '10px', marginBottom: '10px' }}>
            <span style={{
              background: profile?.role === 'admin' ? 'rgba(99,255,176,0.15)' : 'rgba(96,165,250,0.15)',
              border: `1px solid ${profile?.role === 'admin' ? 'rgba(99,255,176,0.3)' : 'rgba(96,165,250,0.3)'}`,
              color: profile?.role === 'admin' ? 'var(--green)' : 'var(--blue)',
              padding: '2px 8px',
              borderRadius: '4px',
              letterSpacing: '1px',
            }}>{profile?.role?.toUpperCase()}</span>
          </div>
          <button onClick={logout} style={{
            width: '100%',
            padding: '8px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '6px',
            color: 'var(--red2)',
            fontSize: '11px',
            cursor: 'pointer',
            letterSpacing: '1px',
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
