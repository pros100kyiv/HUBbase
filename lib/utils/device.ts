import crypto from 'crypto'

/**
 * Генерує унікальний ідентифікатор пристрою на основі IP та User-Agent
 */
export function generateDeviceId(ip: string | null, userAgent: string | null): string {
  const data = `${ip || 'unknown'}-${userAgent || 'unknown'}`
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32)
}

/**
 * Отримує IP адресу з запиту
 */
export function getClientIp(request: Request): string | null {
  // Перевіряємо заголовки для отримання реального IP
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  if (realIp) {
    return realIp
  }
  if (cfConnectingIp) {
    return cfConnectingIp
  }
  
  return null
}

/**
 * Отримує User-Agent з запиту
 */
export function getUserAgent(request: Request): string | null {
  return request.headers.get('user-agent')
}

/**
 * Перевіряє, чи пристрій є довіреним
 */
export function isDeviceTrusted(trustedDevicesJson: string | null, deviceId: string): boolean {
  if (!trustedDevicesJson) {
    return false
  }
  
  try {
    const trustedDevices = JSON.parse(trustedDevicesJson) as string[]
    return Array.isArray(trustedDevices) && trustedDevices.includes(deviceId)
  } catch {
    return false
  }
}

/**
 * Додає пристрій до списку довірених
 */
export function addTrustedDevice(trustedDevicesJson: string | null, deviceId: string): string {
  try {
    const trustedDevices = trustedDevicesJson 
      ? (JSON.parse(trustedDevicesJson) as string[])
      : []
    
    if (!Array.isArray(trustedDevices)) {
      return JSON.stringify([deviceId])
    }
    
    if (!trustedDevices.includes(deviceId)) {
      trustedDevices.push(deviceId)
    }
    
    return JSON.stringify(trustedDevices)
  } catch {
    return JSON.stringify([deviceId])
  }
}

