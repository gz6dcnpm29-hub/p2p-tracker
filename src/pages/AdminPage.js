import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { S, fmtDate, Spinner } from '../components/ui'

export default function AdminPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('worker')
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState('')
  const [editingName, setEditingName] = useState({})

  const loadUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  const createUser = async () => {
    if (!newEmail || !newPassword || !newName) return setMsg('⚠ Заповніть всі поля')
    setCreating(true)
    setMsg('')

    // Admin creates user via Supabase Admin API (requires service role key on backend)
    // For client-side, we use signUp and then update role
    const { data, error } = await supabase.auth.signUp({
      email: newEmail,
      password: newPassword,
      options: { data: { full_name: newName, role: newRole } }
    })

    if (error) {
      setMsg('❌ Помилка: ' + error.message)
      setCreating(false)
      return
    }

    // Update role in profiles table
    if (data?.user) {
      await supabase.from('profiles').update({ role: newRole, full_name: newName }).eq('id', data.user.id)
    }

    setMsg('✓ Користувача створено! Він може увійти зі своїм паролем.')
    setNewEmail(''); setNewName(''); setNewPassword(''); setNewRole('worker')
    setCreating(false)
    setTimeout(() => loadUsers(), 1000)
  }

  const updateRole = async (id, role) => {
    await supabase.from('profiles').update({ role }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u))
  }

  const updateName = async (id, name) => {
    if (!name.trim()) return
    await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, full_name: name.trim() } : u))
    setEditingName(prev => { const n = {...prev}; delete n[id]; return n })
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Spinner size={32} /></div>

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', letterSpacing: '1px' }}>⚙️ Адмін-панель</h1>
        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>Управління співробітниками та доступом</div>
      </div>

      {/* Create user */}
      <div style={S.card}>
        <div style={S.cardTitle}>Додати співробітника</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={S.label}>Ім'я / Прізвище *</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} style={S.input} placeholder="Іванов Іван" />
          </div>
          <div>
            <label style={S.label}>Email *</label>
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} style={S.input} placeholder="ivan@company.com" type="email" />
          </div>
          <div>
            <label style={S.label}>Пароль *</label>
            <input value={newPassword} onChange={e => setNewPassword(e.target.value)} style={S.input} placeholder="мін. 6 символів" type="password" />
          </div>
          <div>
            <label style={S.label}>Роль</label>
            <select value={newRole} onChange={e => setNewRole(e.target.value)} style={S.select}>
              <option value="worker">Worker (тільки ордери)</option>
              <option value="admin">Admin (повний доступ)</option>
            </select>
          </div>
        </div>

        {msg && (
          <div style={{ background: msg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.startsWith('✓') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '8px', padding: '10px 14px', color: msg.startsWith('✓') ? '#22c55e' : 'var(--red2)', fontSize: '12px', marginBottom: '14px' }}>
            {msg}
          </div>
        )}

        <button style={S.btnPrimary} onClick={createUser} disabled={creating}>
          {creating ? 'СТВОРЕННЯ...' : '+ ДОДАТИ КОРИСТУВАЧА'}
        </button>
      </div>

      {/* Users list */}
      <div style={S.card}>
        <div style={S.cardTitle}>Користувачі ({users.length})</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Ім\'я', 'Email', 'Роль', 'Дата реєстрації', 'Змінити роль'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={S.td}>
                    {editingName[u.id] !== undefined ? (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          value={editingName[u.id]}
                          onChange={e => setEditingName(prev => ({ ...prev, [u.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') updateName(u.id, editingName[u.id]); if (e.key === 'Escape') setEditingName(prev => { const n={...prev}; delete n[u.id]; return n }) }}
                          style={{ ...S.input, padding: '4px 8px', fontSize: '12px', width: '120px' }}
                          autoFocus
                        />
                        <button onClick={() => updateName(u.id, editingName[u.id])} style={{ ...S.btnPrimary, padding: '4px 10px', fontSize: '11px' }}>✓</button>
                        <button onClick={() => setEditingName(prev => { const n={...prev}; delete n[u.id]; return n })} style={{ ...S.btnSecondary, padding: '4px 8px', fontSize: '11px' }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '600', color: 'var(--text)' }}>{u.full_name || '—'}</span>
                        <button
                          onClick={() => setEditingName(prev => ({ ...prev, [u.id]: u.full_name || '' }))}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '12px', padding: '2px 4px' }}
                          title="Редагувати ім'я"
                        >✏️</button>
                      </div>
                    )}
                  </td>
                  <td style={S.td}>{u.email}</td>
                  <td style={S.td}>
                    <span style={{
                      background: u.role === 'admin' ? 'rgba(99,255,176,0.15)' : 'rgba(96,165,250,0.15)',
                      border: `1px solid ${u.role === 'admin' ? 'rgba(99,255,176,0.3)' : 'rgba(96,165,250,0.3)'}`,
                      color: u.role === 'admin' ? 'var(--green)' : 'var(--blue)',
                      padding: '2px 10px', borderRadius: '4px', fontSize: '10px', letterSpacing: '1px',
                    }}>{u.role?.toUpperCase()}</span>
                  </td>
                  <td style={S.td}>{fmtDate(u.created_at)}</td>
                  <td style={S.td}>
                    <select
                      value={u.role}
                      onChange={e => updateRole(u.id, e.target.value)}
                      style={{ ...S.select, width: 'auto', padding: '4px 10px', fontSize: '11px' }}
                    >
                      <option value="worker">worker</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info */}
      <div style={{ ...S.card, background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)' }}>
        <div style={{ ...S.cardTitle, color: 'var(--blue)' }}>Ролі та доступ</div>
        <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: '1.8' }}>
          <div><span style={{ color: 'var(--green)' }}>ADMIN</span> — повний доступ: дашборд з усіма ордерами, статистика по всіх, створення пар, адмін-панель, видалення</div>
          <div style={{ marginTop: '6px' }}><span style={{ color: 'var(--blue)' }}>WORKER</span> — введення ордерів, перегляд тільки своїх ордерів, перегляд пар</div>
        </div>
      </div>
    </div>
  )
}
