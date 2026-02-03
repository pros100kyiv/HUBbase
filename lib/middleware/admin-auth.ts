import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

export interface AdminAuthResult {
  valid: boolean
  email?: string
  role?: string
  permissions?: string[]
  adminId?: string
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
    
    // Перевіряємо роль (developer, SUPER_ADMIN, ADMIN, VIEWER)
    const validRoles = ['developer', 'SUPER_ADMIN', 'ADMIN', 'VIEWER']
    if (!validRoles.includes(decoded.role)) {
      return { valid: false }
    }

    return { 
      valid: true, 
      email: decoded.email, 
      role: decoded.role,
      permissions: decoded.permissions || [],
      adminId: decoded.adminId || null,
    }
  } catch (error) {
    return { valid: false }
  }
}

export function getAdminTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization')
  return authHeader?.replace('Bearer ', '') || null
}

