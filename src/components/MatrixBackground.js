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
      // Fade effect
      ctx.fillStyle = 'rgba(2, 4, 8, 0.055)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      drops.forEach((y, i) => {
        const char = CRYPTO_CHARS[Math.floor(Math.random() * CRYPTO_CHARS.length)]
        const x = i * fontSize

        // Head of the stream — bright
        const color = colColors[i]
        if (color === 'green') {
          ctx.fillStyle = `rgba(180, 255, 220, ${0.7 + Math.random() * 0.3})`
        } else if (color === 'blue') {
          ctx.fillStyle = `rgba(150, 200, 255, ${0.6 + Math.random() * 0.3})`
        } else {
          ctx.fillStyle = `rgba(255, 210, 100, ${0.6 + Math.random() * 0.3})`
        }
        ctx.font = `bold ${fontSize}px monospace`
        ctx.fillText(char, x, y * fontSize)

        // Trail — dimmer
        if (color === 'green') {
          ctx.fillStyle = `rgba(99, 255, 176, ${0.12 + Math.random() * 0.1})`
        } else if (color === 'blue') {
          ctx.fillStyle = `rgba(96, 165, 250, ${0.1 + Math.random() * 0.1})`
        } else {
          ctx.fillStyle = `rgba(251, 191, 36, ${0.1 + Math.random() * 0.1})`
        }
        ctx.font = `${fontSize}px monospace`
        for (let t = 1; t < 8; t++) {
          const tc = CRYPTO_CHARS[Math.floor(Math.random() * CRYPTO_CHARS.length)]
          ctx.fillText(tc, x, (y - t) * fontSize)
        }

        // Reset when off screen
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0
        }
        drops[i] += 0.5 + Math.random() * 0.3
      })
    }

    const interval = setInterval(draw, 45)

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
        opacity: 0.35,
      }}
    />
  )
}
