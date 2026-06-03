import { useEffect, useRef } from 'react'

interface AnimatedGridBackgroundProps {
  className?: string
}

export default function AnimatedGridBackground({ className = '' }: AnimatedGridBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      return
    }

    const pointer = { x: -400, y: -400 }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(window.innerWidth * ratio)
      canvas.height = Math.round(window.innerHeight * ratio)
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX
      pointer.y = event.clientY
    }

    const draw = (time: number) => {
      const width = window.innerWidth
      const height = window.innerHeight
      const cell = 34
      const seconds = reducedMotion ? 0 : time / 1000

      context.clearRect(0, 0, width, height)

      for (let y = -cell; y < height + cell; y += cell) {
        for (let x = -cell; x < width + cell; x += cell) {
          const driftX = Math.sin(y * 0.018 + seconds * 0.42) * 5
          const driftY = Math.cos(x * 0.014 + seconds * 0.36) * 4
          const dotX = x + driftX
          const dotY = y + driftY
          const distance = Math.hypot(dotX - pointer.x, dotY - pointer.y)
          const influence = Math.max(0, 1 - distance / 210)
          const size = 0.75 + influence * 2.6
          const opacity = 0.12 + influence * 0.36

          context.beginPath()
          context.fillStyle = `rgba(94, 234, 212, ${opacity})`
          context.arc(dotX, dotY, size, 0, Math.PI * 2)
          context.fill()
        }
      }

      if (!reducedMotion) {
        frame = window.requestAnimationFrame(draw)
      }
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onPointerMove)
    frame = window.requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      window.cancelAnimationFrame(frame)
    }
  }, [])

  return <canvas ref={canvasRef} className={`animated-grid-background ${className}`} aria-hidden="true" />
}
