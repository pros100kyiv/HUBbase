'use client'

import { useEffect, useRef } from 'react'

interface ConfettiProps {
  trigger?: boolean
  show?: boolean
}

let confettiInstance: (() => void) | null = null

export function triggerConfetti() {
  if (confettiInstance) {
    confettiInstance()
  }
}

export function Confetti({ trigger, show }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    if (!trigger && !show) return
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const confettiPieces: Array<{
      x: number
      y: number
      vx: number
      vy: number
      color: string
      size: number
    }> = []

    const colors = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899']

    // Create confetti pieces
    for (let i = 0; i < 50; i++) {
      confettiPieces.push({
        x: Math.random() * canvas.width,
        y: -10,
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 3 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 5 + 3,
      })
    }

    const animate = () => {
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      let activePieces = 0

      confettiPieces.forEach((piece) => {
        piece.x += piece.vx
        piece.y += piece.vy
        piece.vy += 0.1 // gravity

        if (piece.y < canvas.height) {
          activePieces++
          ctx.fillStyle = piece.color
          ctx.fillRect(piece.x, piece.y, piece.size, piece.size)
        }
      })

      if (activePieces > 0) {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    // Set up confetti trigger
    confettiInstance = () => {
      animate()
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [trigger, show])

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full pointer-events-none z-50"
      style={{ display: trigger || show ? 'block' : 'none' }}
    />
  )
}
