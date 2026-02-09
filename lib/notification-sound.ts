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
  return audioContext
}

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
    osc.frequency.setValueAtTime(659.25, now + 0.12)
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35)
    osc.start(now)
    osc.stop(now + 0.35)
  } catch {
    // ignore
  }
}
