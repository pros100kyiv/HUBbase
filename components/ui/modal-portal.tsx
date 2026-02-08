'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface ModalPortalProps {
  children: React.ReactNode
}

export function ModalPortal({ children }: ModalPortalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const html = document.documentElement
    const body = document.body
    const prevOverflow = body.style.overflow
    const prevTouchAction = body.style.touchAction
    const prevOverscrollBehavior = body.style.overscrollBehavior

    body.style.overflow = 'hidden'
    body.style.touchAction = 'none'
    body.style.overscrollBehavior = 'none'
    html.style.overflow = 'hidden'

    return () => {
      body.style.overflow = prevOverflow
      body.style.touchAction = prevTouchAction
      body.style.overscrollBehavior = prevOverscrollBehavior
      html.style.overflow = ''
      setMounted(false)
    }
  }, [])

  if (!mounted) return null

  return createPortal(children, document.body)
}
