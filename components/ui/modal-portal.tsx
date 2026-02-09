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
    const scrollY = window.scrollY ?? window.pageYOffset ?? 0
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    const prevOverflow = body.style.overflow
    const prevTouchAction = body.style.touchAction
    const prevOverscrollBehavior = body.style.overscrollBehavior
    const prevPaddingRight = body.style.paddingRight

    body.style.overflow = 'hidden'
    body.style.touchAction = 'none'
    body.style.overscrollBehavior = 'none'
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`
    }
    html.style.overflow = 'hidden'

    return () => {
      body.style.overflow = prevOverflow
      body.style.touchAction = prevTouchAction
      body.style.overscrollBehavior = prevOverscrollBehavior
      body.style.paddingRight = prevPaddingRight
      html.style.overflow = ''
      window.scrollTo(0, scrollY)
      setMounted(false)
    }
  }, [])

  if (!mounted) return null

  return createPortal(children, document.body)
}
