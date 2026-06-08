import { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase, getProfile } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import OrdersPage from './pages/OrdersPage'
import AddOrderPage from './pages/AddOrderPage'
import PairsPage from './pages/PairsPage'
import AdminPage from './pages/AdminPage'
import AnalyticsPage from './pages/AnalyticsPage'
import TopPage from './pages/TopPage'
import MyReportPage from './pages/MyReportPage'
import Layout from './components/Layout'

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session) {
        const p = await getProfile(session.user.id)
        setProfile(p)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session) {
        const p = await getProfile(session.user.id)
        setProfile(p)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={loadingStyle}>
      <div style={spinnerStyle} />
      <span style={{ color: '#63ffb0', letterSpacing: '3px', fontSize: '13px' }}>ЗАВАНТАЖЕННЯ...</span>
    </div>
  )

  return (
    <AuthContext.Provider value={{ session, profile, setProfile }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!session ? <LoginPage /> : <Navigate to="/" />} />
          <Route path="/" element={session ? <Layout /> : <Navigate to="/login" />}>
            <Route index element={<DashboardPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="add" element={<AddOrderPage />} />
            <Route path="pairs" element={<PairsPage />} />
            <Route path="admin" element={
              profile?.role === 'admin' ? <AdminPage /> : <Navigate to="/" />
            } />
            <Route path="top" element={<TopPage />} />
            <Route path="report" element={<MyReportPage />} />
            <Route path="analytics" element={
              profile?.role === 'admin' ? <AnalyticsPage /> : <Navigate to="/" />
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}

const loadingStyle = {
  minHeight: '100vh',
  background: '#0a0e1a',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '16px',
  fontFamily: "'JetBrains Mono', monospace",
}

const spinnerStyle = {
  width: '32px',
  height: '32px',
  border: '2px solid rgba(99,255,176,0.2)',
  borderTop: '2px solid #63ffb0',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
}
