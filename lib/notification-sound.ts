/**
 * Короткий звук сповіщення (два тони) через Web Audio API.
 * Викликати при появі нового запису, щоб не пропустити бронювання.
 */
let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    } catch {
      return null
    }
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {})
  }
  return audioContext
}

/**
 * Короткий двотоновий звук (C5 + E5) — помітніший при новому записі.
 * Гучність 0.5 для чіткого сприйняття, не різкий.
 */
export function playNotificationSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(523.25, now)
    osc.frequency.setValueAtTime(659.25, now + 0.1)
    gain.gain.setValueAtTime(0.5, now)
    gain.gain.exponentialRampToValueAtTime(0.02, now + 0.45)
    osc.start(now)
    osc.stop(now + 0.45)
  } catch {
    // ignore
  }
}
