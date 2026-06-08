export const fmt = (n, dec = 2) =>
  Number(n).toLocaleString('uk-UA', { minimumFractionDigits: dec, maximumFractionDigits: dec })

export const fmtDate = (iso) =>
  new Date(iso).toLocaleString('uk-UA', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })

export const calcSpread = (buy, sell) =>
  buy && sell ? (((sell - buy) / buy) * 100).toFixed(3) : '—'

export const calcProfit = (buyRate, sellRate, volUah) => {
  if (!buyRate || !sellRate || !volUah) return '—'
  const usdt = volUah / buyRate
  return ((usdt * sellRate) - volUah).toFixed(2)
}

// ─── Common styles ───────────────────────────────────────────
export const S = {
  card: {
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px',
    animation: 'fadeIn 0.3s ease',
  },
  cardTitle: {
    fontSize: '11px',
    letterSpacing: '2px',
    color: 'var(--green)',
    textTransform: 'uppercase',
    marginBottom: '20px',
    fontWeight: '700',
  },
  label: {
    fontSize: '10px',
    color: 'var(--text3)',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginBottom: '6px',
    display: 'block',
  },
  input: {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '10px 12px',
    color: 'var(--text)',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  select: {
    width: '100%',
    background: '#1a2035',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '10px 12px',
    color: 'var(--text)',
    fontSize: '13px',
    outline: 'none',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #63ffb0, #00d4ff)',
    border: 'none',
    borderRadius: '8px',
    padding: '11px 28px',
    color: '#0a0e1a',
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
  btnSecondary: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '10px 20px',
    color: 'var(--text2)',
    fontSize: '12px',
    cursor: 'pointer',
  },
  btnDanger: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '6px',
    padding: '4px 10px',
    color: 'var(--red)',
    fontSize: '11px',
    cursor: 'pointer',
  },
  th: {
    padding: '10px 12px',
    textAlign: 'left',
    fontSize: '10px',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: 'var(--text3)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    color: 'var(--text2)',
    fontSize: '12px',
  },
}

export const BuyBadge = () => (
  <span style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', letterSpacing: '1px' }}>BUY</span>
)

export const SellBadge = () => (
  <span style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', letterSpacing: '1px' }}>SELL</span>
)

export const Spinner = ({ size = 24 }) => (
  <div style={{ width: size, height: size, border: `2px solid rgba(99,255,176,0.2)`, borderTop: `2px solid #63ffb0`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
)
