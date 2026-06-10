import { useEffect, useRef } from 'react'

const CRYPTO_CHARS = '₮$₿ΞΘ◎01010110110100101010110101₮$₿ΞΘ◎₴USDT BTC ETH P2P UAH'

export default function MatrixBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const fontSize = 14
    let columns = Math.floor(canvas.width / fontSize)
    const drops = Array(columns).fill(1).map(() => Math.random() * -100)

    // Column colors — mostly green, some blue, rare yellow
    const colColors = Array(columns).fill(null).map(() => {
      const r = Math.random()
      if (r < 0.75) return 'green'
      if (r < 0.92) return 'blue'
      return 'yellow'
    })

    const draw = () => {
      // Slow fade — longer trails
      ctx.fillStyle = 'rgba(2, 4, 8, 0.04)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      drops.forEach((y, i) => {
        // Only draw every 3rd column for sparseness
        if (i % 3 !== 0) {
          drops[i] += 0.2
          if (drops[i] * fontSize > canvas.height && Math.random() > 0.99) drops[i] = 0
          return
        }

        const char = CRYPTO_CHARS[Math.floor(Math.random() * CRYPTO_CHARS.length)]
        const x = i * fontSize
        const color = colColors[i]

        // Head — subtle glow
        if (color === 'green') {
          ctx.fillStyle = `rgba(99, 255, 176, ${0.25 + Math.random() * 0.15})`
        } else if (color === 'blue') {
          ctx.fillStyle = `rgba(96, 165, 250, ${0.2 + Math.random() * 0.1})`
        } else {
          ctx.fillStyle = `rgba(251, 191, 36, ${0.18 + Math.random() * 0.1})`
        }
        ctx.font = `${fontSize}px monospace`
        ctx.fillText(char, x, y * fontSize)

        // Very dim trail
        ctx.fillStyle = `rgba(99, 255, 176, 0.04)`
        for (let t = 1; t < 5; t++) {
          const tc = CRYPTO_CHARS[Math.floor(Math.random() * CRYPTO_CHARS.length)]
          ctx.fillText(tc, x, (y - t) * fontSize)
        }

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.99) drops[i] = 0
        drops[i] += 0.15 + Math.random() * 0.1
      })
    }

    const interval = setInterval(draw, 60)

    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.18,
      }}
    />
  )
}
