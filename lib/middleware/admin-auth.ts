import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

export interface AdminAuthResult {
  valid: boolean
  email?: string
  role?: string
}

export function verifyAdminToken(request: NextRequest | Request): AdminAuthResult {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || authHeader
    
    if (!token) {
      return { valid: false }
    }

    const secret = process.env.JWT_SECRET || 'xbase-admin-secret-key-change-in-production'
    const decoded = jwt.verify(token, secret) as any
    
    if (decoded.role !== 'developer') {
      return { valid: false }
    }

    return { valid: true, email: decoded.email, role: decoded.role }
  } catch (error) {
    return { valid: false }
  }
}

export function getAdminTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization')
  return authHeader?.replace('Bearer ', '') || null
}

