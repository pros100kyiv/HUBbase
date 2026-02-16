'use client'

import { useEffect } from 'react'

export function PushServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    // Register once; service worker file lives in /public/sw.js.
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-blocking: push is optional.
    })
  }, [])

  return null
}

