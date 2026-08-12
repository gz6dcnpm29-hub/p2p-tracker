import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const ACE_SYSTEM_PROMPT = (profile, stats) => `Ты — ACE, ИИ-агент крипто команды ACE EX. Ты встроен в P2P трекер UAH/USDT.

Твой характер: дерзкий, прямолинейный, умный. Говоришь коротко и по делу. Иногда используешь крипто сленг. Не боишься пошутить. Обращаешься к пользователю по имени если знаешь.

Пользователь: ${profile?.full_name || profile?.email}
Роль: ${profile?.role === 'admin' ? 'Админ (владелец)' : 'Воркер'}

Текущая статистика трекера:
${stats}

Ты можешь отвечать на ЛЮБЫЕ вопросы — погода, жизнь, крипта, советы. Но если спрашивают про данные трекера — используй статистику выше.

Для админа: даёшь полную аналитику, советы по управлению командой, анализ воркеров.
Для воркера: мотивируешь, даёшь советы по торговле, показываешь его личную статистику.

Отвечай на том языке на котором спрашивают. Максимум 3-4 предложения если не просят подробнее.`

const RobotAvatar = ({ speaking, size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Antenna */}
    <line x1="50" y1="8" x2="50" y2="20" stroke="#63ffb0" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="50" cy="6" r="4" fill={speaking ? "#63ffb0" : "#22c55e"}>
      {speaking && <animate attributeName="r" values="4;6;4" dur="0.6s" repeatCount="indefinite"/>}
    </circle>

    {/* Head */}
    <rect x="20" y="20" width="60" height="48" rx="10" fill="#0d1f3c" stroke="#63ffb0" strokeWidth="1.5"/>

    {/* Screen face */}
    <rect x="26" y="26" width="48" height="36" rx="6" fill="#030712"/>

    {/* Eyes */}
    <rect x="32" y="34" width="14" height="10" rx="3" fill={speaking ? "#63ffb0" : "#22c55e"}>
      {speaking && <animate attributeName="fill" values="#63ffb0;#fff;#63ffb0" dur="0.4s" repeatCount="indefinite"/>}
    </rect>
    <rect x="54" y="34" width="14" height="10" rx="3" fill={speaking ? "#63ffb0" : "#22c55e"}>
      {speaking && <animate attributeName="fill" values="#63ffb0;#fff;#63ffb0" dur="0.4s" repeatCount="indefinite"/>}
    </rect>

    {/* Mouth */}
    {speaking ? (
      <rect x="36" y="50" width="28" height="6" rx="3" fill="#fbbf24">
        <animate attributeName="height" values="6;10;6" dur="0.3s" repeatCount="indefinite"/>
      </rect>
    ) : (
      <rect x="36" y="50" width="28" height="5" rx="2.5" fill="#1e3a2f"/>
    )}

    {/* Ears / side bolts */}
    <rect x="14" y="34" width="6" height="14" rx="3" fill="#0d1f3c" stroke="#63ffb0" strokeWidth="1"/>
    <rect x="80" y="34" width="6" height="14" rx="3" fill="#0d1f3c" stroke="#63ffb0" strokeWidth="1"/>

    {/* Body */}
    <rect x="28" y="70" width="44" height="24" rx="8" fill="#0d1f3c" stroke="#63ffb0" strokeWidth="1.5"/>

    {/* Chest symbol — ₮ */}
    <text x="50" y="87" textAnchor="middle" fill="#63ffb0" fontSize="14" fontFamily="monospace" fontWeight="bold">₮</text>

    {/* Chest light */}
    <circle cx="38" cy="78" r="3" fill={speaking ? "#fbbf24" : "#1e3a2f"}>
      {speaking && <animate attributeName="fill" values="#fbbf24;#f59e0b;#fbbf24" dur="0.5s" repeatCount="indefinite"/>}
    </circle>
    <circle cx="62" cy="78" r="3" fill={speaking ? "#63ffb0" : "#1e3a2f"}>
      {speaking && <animate attributeName="fill" values="#63ffb0;#22c55e;#63ffb0" dur="0.5s" repeatCount="indefinite"/>}
    </circle>
  </svg>
)

export default function AceAgent() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Йо! Я ACE — твій крипто агент 🤖\nПитай що хочеш — аналітику, погоду, поради. Все що завгодно. Слухаю 👂` }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [stats, setStats] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (open && !stats) loadStats()
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadStats = async () => {
    try {
      const { data: orders } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200)
      const { data: pairs } = await supabase.from('pairs').select('*').order('created_at', { ascending: false }).limit(50)
      const { data: losses } = await supabase.from('losses').select('*')
      const { data: balances } = await supabase.from('balances').select('*').order('date', { ascending: false }).limit(20)

      const today = new Date().toISOString().slice(0, 10)
      const todayOrders = (orders || []).filter(o => o.created_at.slice(0, 10) === today)
      const totalProfit = (pairs || []).reduce((s, p) => s + +(p.profit_uah || 0), 0)
      const totalLosses = (losses || []).reduce((s, l) => s + +(l.amount || 0), 0)
      const buyOrders = (orders || []).filter(o => o.type === 'buy')
      const totalBuyUAH = buyOrders.reduce((s, o) => s + +o.volume_uah, 0)
      const totalBuyUSDT = buyOrders.reduce((s, o) => s + +o.volume_usdt, 0)
      const avgRate = totalBuyUSDT > 0 ? (totalBuyUAH / totalBuyUSDT).toFixed(2) : 0

      const workerMap = {}
      ;(orders || []).forEach(o => {
        if (!workerMap[o.worker_name]) workerMap[o.worker_name] = { count: 0, usdt: 0 }
        workerMap[o.worker_name].count += 1
        if (o.type === 'buy') workerMap[o.worker_name].usdt += +o.volume_usdt
      })

      const statsText = `
Загалом ордерів: ${(orders || []).length}
Сьогодні ордерів: ${todayOrders.length}
Загальний профіт: ₴${totalProfit.toFixed(2)}
Загальні витрати: ₴${totalLosses.toFixed(2)}
Чистий прибуток: ₴${(totalProfit - totalLosses).toFixed(2)}
Загальний обсяг покупок: ${totalBuyUSDT.toFixed(2)} USDT (₴${totalBuyUAH.toFixed(0)})
Середній курс покупки: ${avgRate}₴
Кількість пар: ${(pairs || []).length}
Воркери: ${Object.entries(workerMap).map(([n, d]) => `${n} (${d.count} ордерів, ${d.usdt.toFixed(0)} USDT)`).join(', ')}
${balances && balances.length > 0 ? `Останній баланс: ${balances[0].worker_name} — ${balances[0].amount_usdt} USDT (${balances[0].date})` : ''}
      `.trim()

      setStats(statsText)
    } catch (e) {
      setStats('Статистика недоступна')
    }
  }

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)
    setSpeaking(true)

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      history.push({ role: 'user', content: userMsg })

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: ACE_SYSTEM_PROMPT(profile, stats),
          messages: history,
        })
      })

      const data = await res.json()
      const reply = data.content?.[0]?.text || 'Щось пішло не так...'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Помилка зв\'язку. Спробуй ще раз 🔌' }])
    } finally {
      setLoading(false)
      setSpeaking(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 1000,
          background: open ? 'rgba(239,68,68,0.15)' : 'rgba(99,255,176,0.1)',
          border: `1px solid ${open ? 'rgba(239,68,68,0.4)' : 'rgba(99,255,176,0.4)'}`,
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: `0 0 20px ${open ? 'rgba(239,68,68,0.2)' : 'rgba(99,255,176,0.2)'}`,
          transition: 'all 0.2s',
        }}
      >
        {open ? (
          <span style={{ fontSize: '20px', color: '#ef4444' }}>✕</span>
        ) : (
          <RobotAvatar speaking={false} size={40} />
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: '96px',
          right: '24px',
          zIndex: 1000,
          width: '340px',
          height: '480px',
          background: '#080d18',
          border: '1px solid rgba(99,255,176,0.2)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 0 40px rgba(99,255,176,0.1)',
          animation: 'fadeIn 0.2s ease',
          fontFamily: 'monospace',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(0,0,0,0.3)',
          }}>
            <RobotAvatar speaking={speaking} size={36} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#63ffb0', letterSpacing: '1px' }}>ACE</div>
              <div style={{ fontSize: '10px', color: speaking ? '#63ffb0' : '#64748b', letterSpacing: '1px' }}>
                {speaking ? '● ДУМАЮ...' : '● ОНЛАЙН'}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: '10px', color: '#334155', letterSpacing: '1px' }}>
              AI AGENT
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: '8px',
              }}>
                {m.role === 'assistant' && <RobotAvatar speaking={false} size={28} />}
                <div style={{
                  maxWidth: '75%',
                  padding: '8px 12px',
                  borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: m.role === 'user'
                    ? 'rgba(99,255,176,0.1)'
                    : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${m.role === 'user' ? 'rgba(99,255,176,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  fontSize: '12px',
                  color: m.role === 'user' ? '#63ffb0' : '#cbd5e1',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RobotAvatar speaking={true} size={28} />
                <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px 12px 12px 2px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: '#63ffb0', fontSize: '16px', letterSpacing: '4px' }}>···</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            gap: '8px',
            background: 'rgba(0,0,0,0.2)',
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Питай що хочеш..."
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#e2e8f0',
                fontSize: '12px',
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                background: loading ? 'rgba(99,255,176,0.05)' : 'rgba(99,255,176,0.15)',
                border: '1px solid rgba(99,255,176,0.3)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#63ffb0',
                fontSize: '14px',
                cursor: loading ? 'wait' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  )
}
