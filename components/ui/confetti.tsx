'use client'

import { useEffect, useRef } from 'react'

interface ConfettiProps {
  trigger: boolean
  onComplete?: () => void
}

export function Confetti({ trigger, onComplete }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!trigger || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const colors = ['#8B5CF6', '#A78BFA', '#EC4899', '#3B82F6', '#10B981', '#F59E0B']
    const confetti: Array<{
      x: number
      y: number
      vx: number
      vy: number
      color: string
      size: number
      rotation: number
      rotationSpeed: number
    }> = []

    // Створюємо конфеті
    for (let i = 0; i < 100; i++) {
      confetti.push({
        x: Math.random() * canvas.width,
        y: -10,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      })
    }

    let animationId: number
    let frameCount = 0
    const maxFrames = 120 // ~2 секунди при 60fps

    function animate() {
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      confetti.forEach((particle) => {
        particle.x += particle.vx
        particle.y += particle.vy
        particle.vy += 0.1 // Гравітація
        particle.rotation += particle.rotationSpeed

        ctx.save()
        ctx.translate(particle.x, particle.y)
        ctx.rotate(particle.rotation)
        ctx.fillStyle = particle.color
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size)
        ctx.restore()
      })

      frameCount++

      if (frameCount < maxFrames) {
        animationId = requestAnimationFrame(animate)
      } else {
        if (onComplete) onComplete()
      }
    }

    animate()

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [trigger, onComplete])

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full pointer-events-none z-50"
      style={{ display: trigger ? 'block' : 'none' }}
    />
  )
}

export function triggerConfetti() {
  const event = new CustomEvent('confetti', { detail: true })
  window.dispatchEvent(event)
}



