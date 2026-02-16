import crypto from 'crypto'

// 32 bytes -> 43-ish chars base64url (no padding). Good entropy for magic links.
export function generateAppointmentAccessToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function hashAppointmentAccessToken(token: string): string {
  // Store only hash in DB to reduce impact of accidental leaks.
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}

