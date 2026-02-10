'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/** Глобальний лічильник відкритих модалок — розблоковуємо body тільки коли закрита остання (коректна модалка в модалці). */
let modalLockCount = 0
function applyBodyLock(isFirst: boolean) {
  const html = document.documentElement
  const body = document.body
  const scrollY = window.scrollY ?? window.pageYOffset ?? 0
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

  if (isFirst) body.setAttribute('data-modal-scroll-y', String(scrollY))
  body.style.overflow = 'hidden'
  body.style.touchAction = 'none'
  body.style.overscrollBehavior = 'none'
  body.style.webkitOverflowScrolling = 'auto'
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`
  }
  html.style.overflow = 'hidden'

  // iOS Safari: position:fixed на body запобігає rubber-band і коректно поводиться при ротації
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIOS) {
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
  }
}

function removeBodyLock() {
  const html = document.documentElement
  const body = document.body
  const scrollY = body.getAttribute('data-modal-scroll-y')
  body.removeAttribute('data-modal-scroll-y')

  body.style.overflow = ''
  body.style.touchAction = ''
  body.style.overscrollBehavior = ''
  body.style.paddingRight = ''
  body.style.webkitOverflowScrolling = ''
  html.style.overflow = ''

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIOS) {
    body.style.position = ''
    body.style.top = ''
    body.style.left = ''
    body.style.right = ''
    body.style.width = ''
    const y = scrollY ? parseInt(scrollY, 10) : 0
    window.scrollTo(0, y)
  }
}

interface ModalPortalProps {
  children: React.ReactNode
}

export function ModalPortal({ children }: ModalPortalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    modalLockCount += 1
    const isFirst = modalLockCount === 1
    applyBodyLock(isFirst)

    return () => {
      modalLockCount -= 1
      if (modalLockCount <= 0) {
        modalLockCount = 0
        removeBodyLock()
      }
      setMounted(false)
    }
  }, [])

  if (!mounted) return null

  return createPortal(children, document.body)
}
